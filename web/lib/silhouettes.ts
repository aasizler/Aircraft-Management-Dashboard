/**
 * Aircraft silhouettes for the live marker, chosen from the feed's ICAO type
 * designator and emitter category, with the owner's typed description as the
 * fallback. ADS-B Exchange draws dozens of shapes; five cover what a hangar
 * holds: a single, a twin, a business jet, an airliner and a helicopter.
 * Every path is nose-up in a 100×100 box, so the marker's rotation applies
 * unchanged.
 */
export type Shape = "single" | "twin" | "jet" | "airliner" | "heli";

const HELI = new Set(["R22", "R44", "R66", "H500", "H269", "AS50", "AS55", "AS65", "EC20", "EC30", "EC35", "EC45", "EC55", "EC75", "B06", "B407", "B412", "B429", "B505", "S76", "S92", "A109", "A119", "A139", "A169", "H60", "UH1", "BK17", "MD52", "MD60", "H125", "H130", "H135", "H145", "H160", "H175", "G2CA", "EXEC", "ROTO"]);
const JET = new Set(["SF50", "C25A", "C25B", "C25C", "C25M", "C500", "C501", "C510", "C525", "C550", "C551", "C560", "C56X", "C650", "C680", "C68A", "C700", "C750", "CL30", "CL35", "CL60", "GALX", "G150", "G280", "GLF2", "GLF3", "GLF4", "GLF5", "GLF6", "GL5T", "GL7T", "GLEX", "FA10", "FA20", "FA50", "FA7X", "FA8X", "F2TH", "F900", "E50P", "E55P", "E545", "E550", "HA4T", "HDJT", "PRM1", "LJ23", "LJ24", "LJ25", "LJ31", "LJ35", "LJ40", "LJ45", "LJ55", "LJ60", "LJ75", "BE40", "H25A", "H25B", "H25C", "ASTR", "WW24", "SBR1", "PC24", "EA50", "CJ1", "CJ2", "CJ3", "CJ4"]);
// Twins only. Single-engine turboprops (PC-12, TBM, Caravan, Kodiak, M600)
// draw as singles: the twin's two nacelles would be a lie.
const TWIN = new Set(["BE55", "BE56", "BE58", "BE60", "BE65", "BE76", "BE95", "PA23", "PA27", "PA30", "PA31", "PA34", "PA39", "PA44", "PA60", "PAT4", "C303", "C310", "C320", "C335", "C337", "C340", "C401", "C402", "C404", "C411", "C414", "C421", "C425", "C441", "DA42", "DA62", "AEST", "BE10", "BE18", "BE20", "BE30", "B350", "BE99", "BE9L", "BE9T", "C90", "C12", "SW2", "SW3", "SW4", "MU2", "P180", "PAY1", "PAY2", "PAY3", "PAY4", "DHC6", "DH8A", "DH8B", "DH8C", "DH8D", "AT43", "AT45", "AT72", "AT75", "AT76", "E110", "E120", "JS31", "JS32", "JS41", "SF34", "D228", "D328"]);

/** Owner-typed descriptions, when the feed has no designator. */
const WORDS: [RegExp, Shape][] = [
  [/heli|robinson|bell 4|eurocopter|airbus h1|rotor/i, "heli"],
  [/vision|citation|phenom|learjet|gulfstream|challenger|falcon|hawker|honda ?jet|eclipse|jet/i, "jet"],
  [/boeing|airbus|737|a320|a321|embraer 1|crj/i, "airliner"],
  [/baron|seneca|seminole|twin|310|340|402|414|421|king air|conquest|navajo|aerostar|da42|da62|caravan|pc-?12|tbm|meridian|m600|kodiak|pilatus/i, "twin"],
];

export function shapeFor(type: string | null | undefined, category: string | null | undefined, typed: string | null | undefined): Shape {
  const t = (type ?? "").toUpperCase();
  if (category === "A7" || HELI.has(t)) return "heli";
  // Known designators first: a Citation reporting A3 is still a business jet.
  if (JET.has(t)) return "jet";
  if (TWIN.has(t)) return "twin";
  if (category === "A3" || category === "A4" || category === "A5") return "airliner";
  if (t) return "single";
  for (const [re, s] of WORDS) if (typed && re.test(typed)) return s;
  return "single";
}

/** Nose-up silhouettes, 100×100 — the redrawn set from AIRCRAFT_SILHOUETTES.md. */
export const SILHOUETTE: Record<Shape, string> = {
  single: "M50,8 C54 8 56 13 56 20 L56 35 L93 38 Q96 38 96 41 L96 49 Q96 51 93 52 L58 54 C56 61 54 69 53 76 L68 81 L68 87 L53 85 L52 91 Q51 94 50 94 Q49 94 48 91 L47 85 L32 87 L32 81 L47 76 C46 69 44 61 42 54 L7 52 Q4 51 4 49 L4 41 Q4 38 7 38 L44 35 L44 20 C44 13 46 8 50 8 Z",
  twin: "M50,4 C54 4 56 10 56 17 L57 36 L67 38 L67 27 C67 23 69 21 72 21 C75 21 77 23 77 27 L77 39 L93 41 Q96 41 96 44 L96 50 Q96 52 93 53 L77 54 L76 59 Q72 63 68 59 L67 54 L57 55 L54 78 L71 84 L71 90 L53 88 L52 94 Q51 96 50 96 Q49 96 48 94 L47 88 L29 90 L29 84 L46 78 L43 55 L33 54 L32 59 Q28 63 24 59 L23 54 L7 53 Q4 52 4 50 L4 44 Q4 41 7 41 L23 39 L23 27 C23 23 25 21 28 21 C31 21 33 23 33 27 L33 38 L43 36 L44 17 C44 10 46 4 50 4 Z",
  jet: "M50,3 C53 5 55 11 55 19 L56 33 L92 54 Q94 55 94 57 L94 62 L56 49 L55 65 L61 65 L61 64 Q61 61 65 61 Q69 61 69 65 L69 76 Q69 79 65 79 L55 76 L54 82 L69 89 L69 94 L52 90 L50 97 L48 90 L31 94 L31 89 L46 82 L45 76 L35 79 Q31 79 31 76 L31 65 Q31 61 35 61 Q39 61 39 64 L39 65 L45 65 L44 49 L6 62 L6 57 Q6 55 8 54 L44 33 L45 19 C45 11 47 5 50 3 Z",
  airliner: "M50,3 C54 3 57 10 57 18 L57 34 L65 39 L65 33 Q65 29 69 29 Q73 29 73 33 L73 44 L94 58 L96 55 L98 56 L98 65 Q98 68 95 67 L73 57 L73 61 Q69 65 65 61 L65 54 L57 51 L56 78 L71 87 L71 93 L54 88 L52 96 Q51 98 50 98 Q49 98 48 96 L46 88 L29 93 L29 87 L44 78 L43 51 L35 54 L35 61 Q31 65 27 61 L27 57 L5 67 Q2 68 2 65 L2 56 L4 55 L6 58 L27 44 L27 33 Q27 29 31 29 Q35 29 35 33 L35 39 L43 34 L43 18 C43 10 46 3 50 3 Z",
  heli: "M50 7 A36 36 0 0 1 53 78.875 L53 87 L65 90 L65 94 L53 92 L52 97 L48 97 L47 92 L35 94 L35 90 L47 87 L47 78.875 A36 36 0 0 1 50 7 Z M50 12 A31 31 0 0 1 53 73.854 L53 58 C61 56 63 48 62 36 C61 28 56 23 50 23 C44 23 39 28 38 36 C37 48 39 56 47 58 L47 73.854 A31 31 0 0 1 50 12 Z",
};
