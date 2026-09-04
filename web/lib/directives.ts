"use client";

import { AIRCRAFT_DB, ENGINE_DB } from "./reference-data";

/**
 * Airworthiness Directives for the makes in your hangar, from the Federal
 * Register's public API.
 *
 * Why this source and not the FAA's own: the Federal Register publishes every
 * AD as a Rule, its API needs no key, and it answers with
 * `access-control-allow-origin: *` — so the browser calls it directly and this
 * costs no server and no secret. The FAA's DRS has richer metadata but no
 * documented public API to read it with.
 *
 * Manufacturer SERVICE BULLETINS are deliberately absent. There is no API for
 * them: each manufacturer publishes to its own site in its own format and most
 * gate them behind a customer login. Guessing at scraped URLs would produce a
 * feature that breaks silently, which is worse than not having it — the
 * Documents tab links out to the right publisher instead.
 */

const API = "https://www.federalregister.gov/api/v1/documents.json";

export type Directive = {
  /** FR document number — stable, and what "seen" state is keyed on. */
  id: string;
  title: string;
  date: string;
  url: string;
  /** Which search term found it, i.e. the make it belongs to. */
  maker: string;
  /**
   * "Proposed Rule" is an NPRM — the FAA intends to mandate this, but has not
   * yet. Showing one identically to a final rule tells an owner something is
   * required when it is not, so it is labelled.
   */
  proposed: boolean;
  /** Full text, for pulling out the bulletins it cites. */
  textUrl: string | null;
  /** Registrations in the hangar this maker covers. */
  affects: string[];
};

/**
 * How the FAA names a manufacturer is not how the catalogue does, and it has
 * changed over time — Beech and Cessna ADs are filed under Textron Aviation
 * now but under their own names historically, so both have to be searched.
 */
const MAKER_TERMS: Record<string, string[]> = {
  Beechcraft: ["Textron Aviation", "Beech Aircraft"],
  Cessna: ["Textron Aviation", "Cessna Aircraft"],
  Cirrus: ["Cirrus Design Corporation"],
  Piper: ["Piper Aircraft"],
  Mooney: ["Mooney"],
  Diamond: ["Diamond Aircraft"],
  Pilatus: ["Pilatus Aircraft"],
  Socata: ["Socata", "Daher"],
  Daher: ["Daher"],
  Robinson: ["Robinson Helicopter"],
  Embraer: ["Embraer"],
  Learjet: ["Learjet"],
  Bombardier: ["Bombardier"],
  Dassault: ["Dassault Aviation"],
  Gulfstream: ["Gulfstream Aerospace"],
  Hawker: ["Textron Aviation", "Hawker Beechcraft"],
  Eclipse: ["Eclipse Aerospace"],
  "Honda Aircraft": ["Honda Aircraft"],
  "Airbus Helicopters": ["Airbus Helicopters"],
};

/** Engine makers, matched off the engine's own manufacturer in ENGINE_DB. */
const ENGINE_TERMS: Record<string, string[]> = {
  Continental: ["Continental Aerospace Technologies", "Teledyne Continental"],
  Lycoming: ["Lycoming Engines"],
  "Williams International": ["Williams International"],
  "Pratt & Whitney Canada": ["Pratt & Whitney Canada"],
  Honeywell: ["Honeywell International"],
  "Rolls-Royce": ["Rolls-Royce"],
  "General Electric": ["General Electric"],
  "GE Honda": ["GE Honda Aero Engines"],
};

/** Catalogue lookup for a v1 free-text type string, e.g. "Cirrus SR22T". */
function makerOf(type: string | null | undefined): string | null {
  const t = (type ?? "").trim().toUpperCase();
  if (!t) return null;
  const hit = AIRCRAFT_DB.find(
    (a) => t === `${a.mfr} ${a.model}`.toUpperCase() || t.startsWith(a.mfr.toUpperCase()),
  );
  return hit?.mfr ?? null;
}

function engineMakerOf(engineType: string | null | undefined): string | null {
  const e = (engineType ?? "").trim().toUpperCase();
  if (!e) return null;
  const hit = ENGINE_DB.find((x) => x.model.toUpperCase() === e || x.id.toUpperCase() === e);
  return hit?.mfr ?? null;
}

export type Craft = { reg: string; type: string | null; engineType?: string | null };

/**
 * Beech and Cessna both file under Textron now, so both search the same term
 * and every Textron AD came back tagged to both aircraft. Most such ADs name
 * the original certificate holder in the title — "(Type Certificate Previously
 * Held by Cessna Aircraft Company)" — so when a legacy make IS named, the AD
 * belongs only to aircraft of that make. A bare "Textron Aviation Inc." names
 * no one and stays on both, which is the honest answer.
 */
const LEGACY = ["cessna", "beech", "hawker", "mooney", "piper"];

function narrow(title: string, regs: string[], fleet: Craft[]): string[] {
  const t = title.toLowerCase();
  const named = LEGACY.filter((m) => t.includes(m));
  if (!named.length) return regs;
  return regs.filter((r) => {
    const mk = (makerOf(fleet.find((c) => c.reg === r)?.type) ?? "").toLowerCase();
    // The catalogue says "Beechcraft" where the FAA says "Beech", so match on
    // containment — comparing the whole name against the token list silently
    // matched nothing and every AD stayed tagged to every aircraft.
    const token = LEGACY.find((n) => mk.includes(n));
    // No legacy make of its own — an engine AD reaching it through its engine —
    // so there is nothing to exclude it on.
    return !token || named.includes(token);
  });
}

/** Search terms for a hangar, each mapped to the registrations it covers. */
export function termsFor(fleet: Craft[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (term: string, reg: string) => {
    const list = out.get(term) ?? [];
    if (!list.includes(reg)) list.push(reg);
    out.set(term, list);
  };
  for (const c of fleet) {
    for (const t of MAKER_TERMS[makerOf(c.type) ?? ""] ?? []) add(t, c.reg);
    for (const t of ENGINE_TERMS[engineMakerOf(c.engineType) ?? ""] ?? []) add(t, c.reg);
  }
  return out;
}

/**
 * The word a title must contain for a hit to really be about this maker. A
 * term search matches any document MENTIONING the maker, so an AD for Diamond
 * airframes surfaces under "Lycoming Engines" and would otherwise be filed
 * against a Bonanza.
 */
const KEYWORD: Record<string, string> = {
  "Textron Aviation": "textron", "Beech Aircraft": "beech", "Cessna Aircraft": "cessna",
  "Cirrus Design Corporation": "cirrus", "Piper Aircraft": "piper", Mooney: "mooney",
  "Diamond Aircraft": "diamond", "Pilatus Aircraft": "pilatus", Socata: "socata", Daher: "daher",
  "Robinson Helicopter": "robinson", Embraer: "embraer", Learjet: "learjet",
  Bombardier: "bombardier", "Dassault Aviation": "dassault", "Gulfstream Aerospace": "gulfstream",
  "Hawker Beechcraft": "hawker", "Eclipse Aerospace": "eclipse", "Honda Aircraft": "honda",
  "Airbus Helicopters": "airbus",
  "Continental Aerospace Technologies": "continental", "Teledyne Continental": "continental",
  "Lycoming Engines": "lycoming", "Williams International": "williams",
  "Pratt & Whitney Canada": "pratt", "Honeywell International": "honeywell",
  "Rolls-Royce": "rolls-royce", "General Electric": "general electric",
  "GE Honda Aero Engines": "ge honda",
};

/** How far back the rail looks. Older than this is history, not news. */
const MONTHS_BACK = 24;

async function search(term: string, signal: AbortSignal) {
  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS_BACK);
  const q = new URLSearchParams();
  q.set("conditions[term]", `"${term}"`);
  q.set("conditions[publication_date][gte]", since.toISOString().slice(0, 10));
  q.append("conditions[agencies][]", "federal-aviation-administration");
  q.set("per_page", "20");
  q.set("order", "newest");
  for (const f of ["title", "publication_date", "document_number", "html_url", "type", "raw_text_url"]) {
    q.append("fields[]", f);
  }
  const res = await fetch(`${API}?${q}`, { signal });
  if (!res.ok) throw new Error(`Federal Register ${res.status}`);
  const json = (await res.json()) as {
    results?: {
      title: string; publication_date: string; document_number: string;
      html_url: string; type?: string; raw_text_url?: string | null;
    }[];
  };
  // Two filters, both needed. The first drops proposed rules and certification
  // notices; the second drops ADs for OTHER manufacturers that merely name this
  // one — usually an engine maker cited in an airframe AD.
  const kw = KEYWORD[term];
  return (json.results ?? []).filter(
    (r) =>
      r.title.startsWith("Airworthiness Directives") &&
      (!kw || r.title.toLowerCase().includes(kw)),
  );
}

/**
 * Every AD touching this hangar, newest first. One request per search term,
 * run together; a term that fails is skipped rather than failing the set,
 * because a partial list is still useful and a blank panel is not.
 */
export async function fetchDirectives(fleet: Craft[], signal: AbortSignal): Promise<Directive[]> {
  const terms = termsFor(fleet);
  if (!terms.size) return [];

  const settled = await Promise.allSettled(
    [...terms.keys()].map(async (t) => ({ term: t, rows: await search(t, signal) })),
  );

  const byId = new Map<string, Directive>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const regs = terms.get(s.value.term) ?? [];
    for (const r of s.value.rows) {
      // Beech and Cessna both search "Textron Aviation", so the same AD can
      // arrive twice — merge the registrations rather than listing it twice.
      const scoped = narrow(r.title, regs, fleet);
      if (!scoped.length) continue;
      const prev = byId.get(r.document_number);
      if (prev) {
        for (const reg of scoped) if (!prev.affects.includes(reg)) prev.affects.push(reg);
        continue;
      }
      byId.set(r.document_number, {
        id: r.document_number,
        title: r.title.replace(/^Airworthiness Directives;\s*/, ""),
        date: r.publication_date,
        url: r.html_url,
        maker: s.value.term,
        proposed: r.type === "Proposed Rule",
        textUrl: r.raw_text_url ?? null,
        affects: [...scoped],
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
}

// ── "Seen" state ────────────────────────────────────────────────────────────
// Advisory only, so this is a per-browser convenience and not a record: an
// acknowledgement that belonged to the aircraft would have to live in the
// database and be attributable to a person.

const SEEN_KEY = "aerotrack:ad-seen";

export function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function saveSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-500)));
  } catch {
    /* private window or storage disabled — the panel still works, it just
       forgets what you have read. */
  }
}


// ── Where the manufacturers publish ─────────────────────────────────────────

export type Publisher = { name: string; role: string; url: string };

/**
 * Front doors only, and on purpose. Deep publication paths move, and several
 * of these sites answer 404 to anything that is not an interactive browser —
 * every specific path tried resolved that way, while every root resolved 200.
 * A link that lands somewhere real beats a precise one that rots.
 */
const PUBLISHER: Record<string, { name: string; url: string }> = {
  Cirrus: { name: "Cirrus Aircraft", url: "https://cirrusaircraft.com/" },
  Beechcraft: { name: "Textron Aviation", url: "https://txtav.com/" },
  Cessna: { name: "Textron Aviation", url: "https://txtav.com/" },
  Hawker: { name: "Textron Aviation", url: "https://txtav.com/" },
  Piper: { name: "Piper Aircraft", url: "https://www.piper.com/" },
  Mooney: { name: "Mooney International", url: "https://mooney.com/" },
  Diamond: { name: "Diamond Aircraft", url: "https://www.diamondaircraft.com/" },
  Pilatus: { name: "Pilatus Aircraft", url: "https://www.pilatus-aircraft.com/" },
  Socata: { name: "Daher", url: "https://www.daher.com/" },
  Daher: { name: "Daher", url: "https://www.daher.com/" },
  Robinson: { name: "Robinson Helicopter", url: "https://robinsonheli.com/" },
  Embraer: { name: "Embraer", url: "https://www.embraer.com/" },
  Bombardier: { name: "Bombardier", url: "https://bombardier.com/" },
  Learjet: { name: "Bombardier", url: "https://bombardier.com/" },
  Dassault: { name: "Dassault Falcon", url: "https://www.dassaultfalcon.com/" },
  Gulfstream: { name: "Gulfstream", url: "https://www.gulfstream.com/" },
  "Honda Aircraft": { name: "Honda Aircraft", url: "https://www.hondajet.com/" },
  "Airbus Helicopters": { name: "Airbus Helicopters", url: "https://www.airbus.com/" },
};

const ENGINE_PUBLISHER: Record<string, { name: string; url: string }> = {
  Continental: { name: "Continental Aerospace", url: "https://www.continental.aero/" },
  Lycoming: { name: "Lycoming", url: "https://www.lycoming.com/" },
  "Williams International": { name: "Williams International", url: "https://www.williams-int.com/" },
  "Pratt & Whitney Canada": { name: "Pratt & Whitney Canada", url: "https://www.prattwhitney.com/" },
  Honeywell: { name: "Honeywell Aerospace", url: "https://aerospace.honeywell.com/" },
  "Rolls-Royce": { name: "Rolls-Royce", url: "https://www.rolls-royce.com/" },
  "General Electric": { name: "GE Aerospace", url: "https://www.geaerospace.com/" },
  "GE Honda": { name: "GE Honda Aero Engines", url: "https://www.gehonda.com/" },
};

/** Publishers worth offering for one aircraft, airframe first. */
export function publishersFor(
  type: string | null | undefined,
  engineType: string | null | undefined,
): Publisher[] {
  const out: Publisher[] = [];
  const air = PUBLISHER[makerOf(type) ?? ""];
  if (air) out.push({ ...air, role: "Airframe" });
  const eng = ENGINE_PUBLISHER[engineMakerOf(engineType) ?? ""];
  if (eng && eng.url !== air?.url) out.push({ ...eng, role: "Engine" });
  // The one place that carries directives AND the FAA's own advisory bulletins,
  // which no manufacturer site does.
  out.push({
    name: "FAA Dynamic Regulatory System",
    role: "ADs and SAIBs",
    url: "https://drs.faa.gov/",
  });
  return out;
}


// ── Bulletins an AD cites ───────────────────────────────────────────────────

/**
 * The one route to real service bulletin NUMBERS from an open source.
 *
 * A directive names the manufacturer document it was prompted by — "Cirrus
 * Service Bulletin SB2X-76-05" — in its full text, though not in its abstract.
 * So the bulletins that matter most, the ones the FAA thought worth mandating,
 * can be surfaced by name even though no bulletin feed exists.
 *
 * The limit is worth being clear about: this only ever finds bulletins an AD
 * already cites. A bulletin the manufacturer issued on its own, which is most
 * of them, is not here and cannot be.
 *
 * On demand only — each document is ~26KB of plain text.
 */
export async function citedBulletins(d: Directive, signal: AbortSignal): Promise<string[]> {
  // Through our own route: the Federal Register's full-text path sends no CORS
  // header, so a direct fetch from here fails and looks like "none cited".
  const res = await fetch(`/api/ad-bulletins/${d.id}`, { signal });
  if (!res.ok) throw new Error(`bulletin scan ${res.status}`);
  const json = (await res.json()) as { refs?: string[] };
  return json.refs ?? [];
}
