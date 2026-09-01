"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { PhotoView } from "@/components/ui/photo-view";
import { describeSize, locateFromTiles, prepareImage, tileImage, SUPPORTED_IMAGE_TYPES, type Box } from "@/lib/image";
import { invokeEdge } from "@/lib/edge";
import type { AircraftRow } from "@/lib/aircraft";
import type { MeterKind } from "@/lib/types";

const KINDS: MeterKind[] = ["hobbs", "tach", "flight", "total"];
type Values = Partial<Record<MeterKind, number>>;

type Reading = { label?: string; value?: number; key?: string };

/** apply_meter_reading()'s needs_confirmation payload. */
type BigJump = {
  threshold: number;
  meters: { meter: string; current: number; read: number; delta: number }[];
};
type OcrOut = {
  values?: Record<string, number>;
  readings?: Reading[];
  notes?: string;
  confidence?: number;
};

/**
 * The model has, across runs, returned `engine`, `engine_hours` and
 * `total_hours` for the same panel. Those aren't MeterKinds, so they used to be
 * dropped silently and the confirm screen came up empty. Normalise instead.
 *
 * ENGINE HOURS maps to hobbs: on a glass panel it is accumulated engine run
 * time, which is what a Hobbs meter counts.
 */
const KEY_ALIASES: Record<string, MeterKind> = {
  hobbs: "hobbs", engine: "hobbs", engine_hours: "hobbs", enginehours: "hobbs",
  eng: "hobbs", eng_hrs: "hobbs", engine_time: "hobbs",
  tach: "tach", tach_time: "tach", tachtime: "tach", recording_tach: "tach",
  flight: "flight", flight_time: "flight", flighttime: "flight",
  flt: "flight", flt_time: "flight", air_time: "flight",
  total: "total", total_hours: "total", totalhours: "total",
  total_time: "total", tt: "total", airframe: "total",
};

function normalizeValues(raw: Record<string, number> | undefined): Values {
  const out: Values = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const kind = KEY_ALIASES[k.toLowerCase().replace(/[\s-]+/g, "_")];
    if (kind && out[kind] == null) out[kind] = v;
  }
  return out;
}

export function MeterCapture({ aircraft }: { aircraft: AircraftRow }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"pick" | "scanning" | "confirm">("pick");
  const [raw, setRaw] = useState<Values>({});
  const [vals, setVals] = useState<Values>({});
  const [notes, setNotes] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ src: string; size: string } | null>(null);
  /** Where each reading sits in the photo, so inspect opens on the digits. */
  const [regions, setRegions] = useState<{ label: string; box: Box }[]>([]);
  /** The label printed next to each value, so the mapping is visible not guessed. */
  const [labels, setLabels] = useState<Record<string, string>>({});
  /** Set when the server wants a human to vouch for an unusually large jump. */
  const [bigJump, setBigJump] = useState<BigJump | null>(null);
  /** The saved meter_readings row, reused across the confirm round-trip. */
  const [readingId, setReadingId] = useState<string | null>(null);

  function reset() {
    setPhase("pick");
    setRaw({});
    setVals({});
    setNotes("");
    setErr(null);
    setPhoto(null);
    setLabels({});
    setRegions([]);
    setBigJump(null);
    setReadingId(null);
  }

  async function scan(file: File) {
    // Guard before the FileReader: decoding a huge file to a data URL is what
    // would actually blow up, and compression can't help until it's decoded.
    if (file.size > 25 * 1024 * 1024) {
      setErr("That photo is over 25MB — take it at a lower resolution.");
      return;
    }
    setPhase("scanning");
    setErr(null);
    setPhoto(null);
    try {
      // Downscale + orient before upload: a raw 12MP phone photo is ~4MB and
      // base64 inflates it by a third, for pixels the API discards anyway.
      const img = await prepareImage(file);
      if (!SUPPORTED_IMAGE_TYPES.includes(img.mime)) {
        setErr(
          `This browser couldn't read that ${img.mime.split("/")[1]?.toUpperCase() || "file"}. Take the photo as a JPEG, or share it as a photo rather than the original file.`,
        );
        setPhase("pick");
        return;
      }
      setPhoto({ src: img.preview, size: describeSize(img) });

      // Read native-resolution tiles in parallel. Tiles with no meter in them
      // come back empty, which is exactly what merging wants.
      const tiles = (await tileImage(file)) ?? [];
      if (!tiles.length) {
        setErr("Could not process that photo — try a different one.");
        setPhase("pick");
        return;
      }

      const results = await Promise.all(
        tiles.map((t) =>
          invokeEdge<OcrOut>("meter-ocr", {
            image: t.data,
            media_type: t.mime,
          }).then((r) => ({ ...r, tile: t })),
        ),
      );

      const failed = results.filter((r) => r.error);
      if (failed.length === results.length) {
        setErr(failed[0]?.error ?? "Meter read failed.");
        setPhase("pick");
        return;
      }

      // Merge: tally each key's readings across tiles. The same number usually
      // appears in two overlapping tiles, so agreement is a real check — and
      // disagreement is surfaced rather than silently resolved.
      const votes = new Map<MeterKind, Map<number, number>>();
      const seenLabels: Record<string, string> = {};
      const boxesByKind = new Map<MeterKind, Box[]>();
      for (const r of results) {
        if (r.error || !r.data) continue;
        const vals = normalizeValues(r.data.values);
        for (const [kind, value] of Object.entries(vals) as [MeterKind, number][]) {
          const tally = votes.get(kind) ?? new Map<number, number>();
          tally.set(value, (tally.get(value) ?? 0) + 1);
          votes.set(kind, tally);
          boxesByKind.set(kind, [...(boxesByKind.get(kind) ?? []), r.tile.box]);
        }
        for (const rd of r.data.readings ?? []) {
          if (!rd.key || !rd.label) continue;
          const kind = KEY_ALIASES[rd.key.toLowerCase().replace(/[\s-]+/g, "_")];
          if (kind) seenLabels[kind] = rd.label;
        }
      }

      const merged: Values = {};
      const conflicts: string[] = [];
      const unconfirmed: string[] = [];
      const multiTile = tiles.length > 1;
      for (const [kind, tally] of votes) {
        const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
        const [value, votesFor] = ranked[0];

        // A number seen in exactly one section of a multi-tile scan is the
        // signature of a misread: tiles overlap, so a real meter almost always
        // lands in two. Measured on a G3X panel photo, every correct reading
        // appeared twice and every phantom once — an airspeed placard read as
        // "hobbs 89", the heading read as "tach 14". Left in, a phantom meter
        // with no prior value sails through apply_meter_reading's first-reading
        // path unchecked, so don't prefill it — say so and let the user type it.
        if (multiTile && votesFor < 2) {
          unconfirmed.push(kind);
          continue;
        }

        merged[kind] = value;
        if (ranked.length > 1) {
          conflicts.push(`${kind}: tiles read ${ranked.map(([v]) => v).join(" vs ")}`);
        }
      }

      if (!Object.keys(merged).length) {
        setErr("No meter reading found in that photo — try again, closer and square to the face.");
        setPhase("pick");
        return;
      }

      setRaw(merged);
      setVals(merged);
      setLabels(seenLabels);
      // One zoom target per reading — tiles that both saw a number intersect
      // right where that number is.
      setRegions(
        (Object.keys(merged) as MeterKind[])
          .map((kind) => {
            const box = locateFromTiles(boxesByKind.get(kind) ?? []);
            return box ? { label: seenLabels[kind] ?? kind, box } : null;
          })
          .filter((r): r is { label: string; box: Box } => !!r),
      );
      // A tile can fail on its own (a transient upstream 502, say). The merge
      // absorbs that, but it means fewer independent reads backed this number,
      // so say so rather than presenting it as equally verified.
      const note: string[] = [];
      if (conflicts.length) note.push(`Tiles disagreed — check carefully. ${conflicts.join("; ")}`);
      if (unconfirmed.length) {
        note.push(
          `A possible ${unconfirmed.join(" and ")} reading showed up in only one part of the photo, so it was left blank — check the photo and enter it if it's real.`,
        );
      }
      if (failed.length) note.push(`${failed.length} of ${results.length} tiles failed to read.`);
      setNotes(note.join(" "));
      setPhase("confirm");
    } catch (e) {
      setErr((e as Error).message || String(e));
      setPhase("pick");
    }
  }

  /**
   * Commit the reading. The server re-validates: a first reading is accepted as
   * the baseline, an ordinary advance applies straight away, and a jump past
   * the threshold comes back as `needs_confirmation` with the numbers so we can
   * ask about that specific meter rather than refusing the capture.
   */
  async function apply(confirmLarge = false) {
    setBusy(true);
    setErr(null);
    const supabase = createClient();

    // Reuse the row on the confirm round-trip — re-inserting would orphan the
    // first reading and lose the flag the server just set on it.
    let id = readingId;
    if (!id) {
      const final: Values = {};
      for (const k of KINDS) if (vals[k] != null) final[k] = vals[k];
      const { data: row, error } = await supabase
        .from("meter_readings")
        .insert({
          aircraft_id: aircraft.id,
          org_id: aircraft.org_id,
          values_raw: raw,
          values_final: final,
          status: "pending",
        })
        .select("id")
        .single();
      if (error || !row) {
        setErr(error?.message ?? "could not save reading");
        setBusy(false);
        return;
      }
      id = row.id as string;
      setReadingId(id);
    }

    const { data: result, error: rpcErr } = await supabase.rpc("apply_meter_reading", {
      p_reading: id,
      p_confirm: confirmLarge,
    });
    setBusy(false);
    if (rpcErr) {
      setErr(rpcErr.message);
      return;
    }

    if (result && result.ok === false) {
      if (result.reason === "needs_confirmation") {
        setBigJump(result as BigJump);
        return;
      }
      setErr(
        result.reason === "below_current"
          ? `That reads ${result.read}, below the current ${result.meter} of ${result.current}. Meters don't run backwards — check the photo, or update the hours directly if the meter was replaced.`
          : `Rejected: ${result.reason}`,
      );
      return;
    }

    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)}>
        <Icon name="camera" />Meter Photo
      </button>

      {open && (
        <Modal
          title="Capture Meter Photo"
          onClose={() => {
            setOpen(false);
            reset();
          }}
        >
          {phase === "pick" && (
            <>
              <div
                className="pdf-drop"
                onClick={() => inputRef.current?.click()}
              >
                <div className="pdf-drop-icon"><Icon name="camera" size={26} /></div>
                <div className="pdf-drop-title">Photograph the meter</div>
                <div className="pdf-drop-sub">
                  Hobbs, tach, or flight timer — click to choose a photo
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
                />
              </div>
              {err && <div className="auth-err">{err}</div>}
            </>
          )}

          {phase === "scanning" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div className="receipt-spinner" style={{ margin: "0 auto 14px" }} />
              <div className="mono">Reading the meter…</div>
            </div>
          )}

          {phase === "confirm" && bigJump && (
            <>
              <div className="meter-jump">
                <div className="meter-jump-hd">Bigger jump than expected</div>
                <ul className="meter-jump-list">
                  {bigJump.meters.map((m) => (
                    <li key={m.meter}>
                      <b>{m.meter}</b> {m.current} → {m.read}
                      <span className="meter-jump-delta">+{m.delta} hrs</span>
                    </li>
                  ))}
                </ul>
                <div className="meter-jump-note">
                  That is more than {bigJump.threshold} hours since the last reading. If the
                  aircraft really flew that much, go ahead — otherwise check the photo, since a
                  single misread digit lands here.
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-cancel" onClick={() => setBigJump(null)}>
                  Back to the numbers
                </button>
                <button className="btn-save" onClick={() => apply(true)} disabled={busy}>
                  {busy ? "Applying…" : "Yes, that's correct"}
                </button>
              </div>
            </>
          )}

          {phase === "confirm" && !bigJump && (
            <>
              {photo && (
                <PhotoView
                  src={photo.src}
                  alt="Meter photo as read"
                  regions={regions}
                  caption={`Tap to inspect the digits · ${photo.size}`}
                />
              )}
              {notes && <div className="meter-warn">{notes}</div>}
              <div className="form-grid">
                {KINDS.filter((k) => vals[k] != null || raw[k] != null).map((k) => (
                  <div className="form-row" key={k}>
                    <label>
                      {k}
                      {labels[k] && <span className="meter-src">{labels[k]}</span>}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vals[k] ?? ""}
                      onChange={(e) =>
                        setVals((p) => ({ ...p, [k]: Number(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </div>
              {err && <div className="auth-err">{err}</div>}
              <div className="form-actions">
                <button className="btn-cancel" onClick={reset}>Retake</button>
                <button className="btn-save" onClick={() => apply()} disabled={busy}>
                  {busy ? "Applying…" : "Confirm & Update Hours"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
