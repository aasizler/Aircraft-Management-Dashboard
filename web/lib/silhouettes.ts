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
const TWIN = new Set(["BE55", "BE56", "BE58", "BE60", "BE65", "BE76", "BE95", "PA23", "PA27", "PA30", "PA31", "PA34", "PA39", "PA44", "PA60", "PAT4", "C303", "C310", "C320", "C335", "C337", "C340", "C401", "C402", "C404", "C411", "C414", "C421", "C425", "C441", "DA42", "DA62", "AEST", "BE10", "BE18", "BE20", "BE30", "B350", "BE99", "BE9L", "BE9T", "C90", "C12", "SW2", "SW3", "SW4", "MU2", "P180", "PAY1", "PAY2", "PAY3", "PAY4", "DHC6", "DH8A", "DH8B", "DH8C", "DH8D", "AT43", "AT45", "AT72", "AT75", "AT76", "E110", "E120", "JS31", "JS32", "JS41", "SF34", "D228", "D328", "PC6", "TBM7", "TBM8", "TBM9", "PC12", "C208", "C08T", "KODI", "M600", "P46T", "EPIC"]);

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
  if (category === "A3" || category === "A4" || category === "A5") return "airliner";
  if (JET.has(t)) return "jet";
  if (TWIN.has(t)) return "twin";
  if (t) return "single";
  for (const [re, s] of WORDS) if (typed && re.test(typed)) return s;
  return "single";
}

/** Nose-up silhouettes, 100×100. */
export const SILHOUETTE: Record<Shape, string> = {
  // The v1 shape: straight wing, fixed tail.
  single: "M50,2 C46,2 44,5 44,14 L41,36 L4,54 L4,63 L41,55 L42,74 L32,79 L32,86 L50,81 L68,86 L68,79 L58,74 L59,55 L96,63 L96,54 L59,36 L56,14 C56,5 54,2 50,2Z",
  // Same planform with a nacelle on each wing.
  twin: "M50,2 C46,2 44,5 44,14 L41,36 L30,40 L30,30 C30,26 25,26 25,30 L25,42 L4,54 L4,63 L25,58 L25,64 C25,68 30,68 30,64 L30,57 L41,55 L42,74 L32,79 L32,86 L50,81 L68,86 L68,79 L58,74 L59,55 L70,57 L70,64 C70,68 75,68 75,64 L75,58 L96,63 L96,54 L75,42 L75,30 C75,26 70,26 70,30 L70,40 L59,36 L56,14 C56,5 54,2 50,2Z",
  // Swept wing, rear nacelles, T-tail.
  jet: "M50,2 C47,2 45,6 45,16 L44,42 L8,66 L8,72 L44,58 L44,72 L38,74 L38,80 L44,79 L44,84 L30,88 L30,93 L50,90 L70,93 L70,88 L56,84 L56,79 L62,80 L62,74 L56,72 L56,58 L92,72 L92,66 L56,42 L55,16 C55,6 53,2 50,2Z",
  // Swept wing with underwing engines, low tail.
  airliner: "M50,1 C46,1 44,5 44,14 L43,38 L28,46 L28,36 C28,32 22,32 22,36 L22,49 L3,60 L3,66 L22,61 L22,66 C22,70 28,70 28,66 L28,60 L43,56 L43,78 L32,86 L32,92 L50,88 L68,92 L68,86 L57,78 L57,56 L72,60 L72,66 C72,70 78,70 78,66 L78,61 L97,66 L97,60 L78,49 L78,36 C78,32 72,32 72,36 L72,46 L57,38 L56,14 C56,5 54,1 50,1Z",
  // Cabin, tail boom, rotor disc as a ring.
  heli: "M50,22 C42,22 38,28 38,36 L38,50 C38,56 42,60 47,60 L47,84 L36,88 L36,92 L64,92 L64,88 L53,84 L53,60 C58,60 62,56 62,50 L62,36 C62,28 58,22 50,22Z M50,5 A36,36 0 1,0 50.01,5Z M50,9 A32,32 0 1,1 49.99,9Z",
};
