/**
 * The app's icon set: strokes on a 24px grid, currentColor, no fills.
 *
 * Hand-drawn and deliberately small — a whole icon package to draw twenty
 * glyphs does not earn its bundle. It replaces the emoji the UI used to carry,
 * which rendered at a different size, weight and colour on every platform: part
 * of why buttons of the same class measured 32, 50 and 68px tall.
 *
 * Used where a glyph earns its place — a repeated action, a status, a row in a
 * timeline — not as decoration on every label.
 */
export type IconName =
  // menus
  | "sort" | "settings" | "logout" | "users" | "eye"
  | "trash" | "share" | "pencil" | "inbox" | "exit"
  | "eraser" | "power"
  // actions and status
  | "hangar" | "plane" | "fleet" | "landing" | "signal" | "alert" | "grounded"
  | "droplet" | "wrench" | "camera" | "paperclip" | "check" | "cash"
  | "calendar" | "file" | "shield";

const PATHS: Record<IconName, string> = {
  sort:      "M4 6h10M4 12h7M4 18h4M17 8v10m0 0l-3-3m3 3l3-3",
  settings:  "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9h-.2a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1A1.7 1.7 0 0011 3.5v-.2a2 2 0 114 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.6 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z",
  logout:    "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  users:     "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  eye:       "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z",
  trash:     "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6",
  share:     "M4 12v8a1 1 0 001 1h14a1 1 0 001-1v-8M16 6l-4-4-4 4M12 2v14",
  pencil:    "M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  inbox:     "M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.8 4H7.2a2 2 0 00-1.7 1.1z",
  exit:      "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  eraser:    "M4 15l7-7a2 2 0 013 0l4 4a2 2 0 010 3l-5 5H8l-4-4a2 2 0 010-1zM9 21h11",
  power:     "M12 3v9M18.4 6.6a9 9 0 11-12.8 0",
  // An arched hangar with an aircraft tail inside — the hangar, not a house.
  hangar:    "M2 21V11l10-6 10 6v10M2 21h20M8 21v-6a4 4 0 018 0v6",
  plane:     "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  // The plane above at half size, twice, held apart on its own 45 deg axis:
  // the same aeroplane, more than one of it.
  fleet:     "M22 1.8L16.5 7.3M22 1.8L18.5 11.8L16.5 7.3L12 5.3ZM11.8 12L6.3 17.5M11.8 12L8.3 22L6.3 17.5L1.8 15.5Z",
  landing:   "M3 21h18M6 16l13-2.6a2 2 0 10-1-3.7l-4 .8-5.5-4.6L7 6.3l3 4.9-3.6.7-2-2-1.2.3 1.6 4z",
  signal:    "M4.9 19.1a10 10 0 010-14.2M7.8 16.2a6 6 0 010-8.4M16.2 7.8a6 6 0 010 8.4M19.1 4.9a10 10 0 010 14.2M12.5 12a.5.5 0 11-1 0 .5.5 0 011 0z",
  alert:     "M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01",
  grounded:  "M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8",
  droplet:   "M12 2.7l5.7 5.7a8 8 0 11-11.4 0z",
  wrench:    "M14.7 6.3a4 4 0 015.4 5.4l-1.4-1.4-2.6.7.7-2.6-2.1-2.1zM14.7 6.3L4.6 16.4a2 2 0 102.8 2.8L17.5 9.1",
  camera:    "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z",
  paperclip: "M21.4 11.1l-9.2 9.2a6 6 0 01-8.5-8.5l9.2-9.2a4 4 0 015.7 5.7l-9.2 9.2a2 2 0 01-2.8-2.8l8.5-8.5",
  check:     "M20 6L9 17l-5-5",
  cash:      "M2 7h20v10H2zM12 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5M6 7v10M18 7v10",
  calendar:  "M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M8 2v4M16 2v4",
  file:      "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6",
  shield:    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

export function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
