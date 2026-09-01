"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { PhotoView } from "@/components/ui/photo-view";
import { useToast } from "@/components/ui/toast";
import { describeSize, prepareImage, tileImage, SUPPORTED_IMAGE_TYPES } from "@/lib/image";
import { invokeEdge } from "@/lib/edge";
import {
  MAINT_CAT_OPTIONS, today,
  type MaintCategory, type MaintCost, type V1Aircraft,
} from "@/lib/aircraft";

const CATS = Object.keys(MAINT_CAT_OPTIONS) as MaintCategory[];

type ReceiptOut = {
  amount?: number; date?: string; vendor?: string;
  category?: string; description?: string;
  /** "receipt" (till roll) or "invoice" (multi-line, columns, fees). */
  doc_type?: string;
  /** 0..1 — the model's certainty about the DIGITS of `amount`. */
  amount_confidence?: number;
};

/**
 * Scan Receipt, ported from v1's openReceiptModal / handleReceiptFile /
 * compressReceiptImage / scanReceiptWithAI / showReceiptWarning /
 * saveFromReceipt.
 *
 * The parse itself moved server-side (supabase/functions/receipt-scan): v1 put
 * the user's Anthropic key in localStorage and called the API straight from the
 * browser, which leaks the key to anyone who opens devtools.
 */
export function ReceiptScan({
  data,
  save,
}: {
  data: V1Aircraft;
  save: (next: V1Aircraft) => Promise<void>;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; size: string } | null>(null);
  const [f, setF] = useState({
    date: today(), cost: "", cat: "other" as MaintCategory, desc: "", shop: "",
  });

  function reset() {
    setF({ date: today(), cost: "", cat: "other", desc: "", shop: "" });
    setWarn(null);
    setPreview(null);
    setScanning(false);
  }

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setWarn("That file is over 10MB — try a smaller photo.");
      return;
    }
    setWarn(null);
    setScanning(true);
    setPreview(null);

    const isPdf = file.type.includes("pdf");
    let base64: string;
    let mimeType: string;

    if (isPdf) {
      base64 = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = (e) => res(String(e.target?.result ?? "").split(",")[1] ?? "");
        r.readAsDataURL(file);
      });
      mimeType = "application/pdf";
    } else {
      // Downscale + orient before upload — see lib/image.ts for why 1568/0.92.
      const img = await prepareImage(file);
      if (!SUPPORTED_IMAGE_TYPES.includes(img.mime)) {
        setScanning(false);
        setWarn(
          `This browser couldn't read that ${img.mime.split("/")[1]?.toUpperCase() || "image"} file. Try a JPEG, PNG or PDF — on iPhone, share it as a photo rather than the original file.`,
        );
        return;
      }
      base64 = img.data;
      mimeType = img.mime;
      setPreview({ src: img.preview, size: describeSize(img) });
    }

    // ONE call by default — v1's shape, ~7x cheaper than always tiling, and on a
    // five-receipt sample it read 4 of 5 totals right on every attempt.
    //
    // The fifth was a multi-line FBO invoice: $181.35 read as $181.55 on three
    // runs of four. That error is SYSTEMATIC, not noise, so asking again the
    // same way returns the same wrong number — the second look has to change
    // the input, not resample it. So when the model flags the total as small
    // print or column-set (or calls the document an invoice), we re-read it
    // from native-resolution tiles, where those digits are legible.
    const { data: out, error } = await invokeEdge<ReceiptOut>("receipt-scan", {
      base64,
      mimeType,
    });

    if (error) {
      setScanning(false);
      setWarn(`Receipt scan failed: ${error}`);
      return;
    }

    const r = out ?? {};
    let amount = r.amount;
    let corrected: { from: number; to: number } | null = null;

    const risky =
      !isPdf &&
      amount != null &&
      (r.doc_type?.toLowerCase() === "invoice" || (r.amount_confidence ?? 1) < 0.9);

    if (risky) {
      const tiles = (await tileImage(file)) ?? [];
      if (tiles.length > 1) {
        const tiled = await Promise.all(
          tiles.map((t) =>
            invokeEdge<ReceiptOut>("receipt-scan", { base64: t.data, mimeType: t.mime }),
          ),
        );
        const seen = tiled
          .filter((t) => !t.error && typeof t.data?.amount === "number")
          .map((t) => t.data!.amount!);

        // Tiles read digits well but lose the layout — one tile of that invoice
        // returned `8` (a line item) and another `7555` (a unit price with the
        // decimal lost). So a tile never picks the total; it may only correct
        // the total the full frame already chose, and only when it is within 1%
        // — the signature of one misread digit in the same number.
        if (seen.length && !seen.includes(amount!)) {
          const near = seen.filter(
            (c) => Math.abs(c - amount!) / Math.max(Math.abs(c), Math.abs(amount!)) < 0.01,
          );
          if (near.length) {
            const tally = new Map<number, number>();
            for (const c of near) tally.set(c, (tally.get(c) ?? 0) + 1);
            const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
            corrected = { from: amount!, to: best };
            amount = best;
          }
        }
      }
    }

    setScanning(false);
    setF({
      date: r.date || today(),
      cost: amount != null ? String(amount) : "",
      cat: (CATS.includes(r.category as MaintCategory) ? r.category : "other") as MaintCategory,
      desc: r.description ?? "",
      shop: r.vendor ?? "",
    });
    if (corrected) {
      setWarn(
        `Read $${corrected.from} at first, corrected to $${corrected.to} on a closer look. Worth checking against the photo.`,
      );
    }
    toast("Receipt parsed — check the values before saving", "ok");
  }

  async function submit() {
    const cost = Number(f.cost);
    if (!cost) { setWarn("Enter an amount."); return; }
    setBusy(true);
    const entry: MaintCost = {
      date: f.date || today(), cost, cat: f.cat,
      desc: f.desc.trim(), shop: f.shop.trim(),
    };
    await save({ ...data, maintCosts: [entry, ...((data.maintCosts ?? []) as MaintCost[])] });
    setBusy(false);
    setOpen(false);
    reset();
    toast("Cost saved from receipt", "ok");
  }

  return (
    <>
      <button className="btn sm" onClick={() => { reset(); setOpen(true); }}>
        <Icon name="camera" />Scan Receipt
      </button>

      {open && (
        <Modal title="Scan Receipt" onClose={() => { setOpen(false); reset(); }}>
          <div
            className="pdf-drop"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="pdf-drop-icon"><Icon name="camera" size={26} /></div>
            <div className="pdf-drop-title">
              {preview ? "Drop another receipt or click to browse" : "Drop a receipt or click to browse"}
            </div>
            <div className="pdf-drop-sub">Photo or PDF — the total, date, vendor and category are read automatically</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {preview && !scanning && (
            <PhotoView
              src={preview.src}
              alt="Receipt as read"
              caption={`Tap to enlarge and check the total · ${preview.size}`}
            />
          )}

          {scanning && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
              <div className="receipt-spinner" />
              <span style={{ fontSize: 13, color: "var(--muted2)" }}>
                Reading receipt with AI…
              </span>
            </div>
          )}

          {warn && <div className="auth-err">{warn}</div>}

          <div className="form-grid">
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="form-row">
              <label>Amount ($)</label>
              <input type="number" step="0.01" value={f.cost} onChange={(e) => setF((p) => ({ ...p, cost: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div className="form-row">
            <label>Category</label>
            <select value={f.cat} onChange={(e) => setF((p) => ({ ...p, cat: e.target.value as MaintCategory }))}>
              {CATS.map((c) => <option key={c} value={c}>{MAINT_CAT_OPTIONS[c]}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Description</label>
            <input value={f.desc} onChange={(e) => setF((p) => ({ ...p, desc: e.target.value }))} placeholder="What was done..." />
          </div>
          <div className="form-row">
            <label>Shop / Vendor</label>
            <input value={f.shop} onChange={(e) => setF((p) => ({ ...p, shop: e.target.value }))} placeholder="Shop name or self" />
          </div>

          <div className="form-actions">
            <button className="btn-cancel" onClick={() => { setOpen(false); reset(); }}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy || scanning}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
