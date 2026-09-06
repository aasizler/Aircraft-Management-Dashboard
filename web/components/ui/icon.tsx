/**
 * The app's icon set: strokes on a 24px grid, currentColor, no fills.
 *
 * Deliberately small — a whole icon package to draw twenty-eight glyphs does not
 * earn its bundle. It replaces the emoji the UI used to carry, which rendered at
 * a different size, weight and colour on every platform: part of why buttons of
 * the same class measured 32, 50 and 68px tall.
 *
 * Geometry is the reviewed replacement set recorded in ICON_SHEET.md at the repo
 * root; that file is the spec, this is the implementation of it. Two glyphs need
 * more than one element — hangar has an aircraft inside it drawn at thinner
 * weights, fleet is the plane twice under transforms — so each entry is JSX
 * rather than a lone path string.
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

const GLYPHS: Record<IconName, React.ReactNode> = {
  // More space between the ordering lines and arrow.
  sort: <path d="M3.5 6h10M3.5 12h7M3.5 18h4M18 5v14m-3-3 3 3 3-3" />,
  // A regular eight-tooth cog with a calmer, balanced outline.
  settings: <path d="M19.14 10.48L21.36 10.35L21.36 13.65L19.14 13.52L18.12 15.98L19.78 17.45L17.45 19.78L15.98 18.12L13.52 19.14L13.65 21.36L10.35 21.36L10.48 19.14L8.02 18.12L6.55 19.78L4.22 17.45L5.88 15.98L4.86 13.52L2.64 13.65L2.64 10.35L4.86 10.48L5.88 8.02L4.22 6.55L6.55 4.22L8.02 5.88L10.48 4.86L10.35 2.64L13.65 2.64L13.52 4.86L15.98 5.88L17.45 4.22L19.78 6.55L18.12 8.02ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />,
  // Align the arrow with the door opening; keep the familiar meaning.
  logout: <path d="M9 3.5H5a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 5 20.5h4M10 12h10.5m-4-4 4 4-4 4" />,
  // Inset the second figure so the group has breathing room.
  users: <path d="M13 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM3 20v-2a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v2M17 4a3.5 3.5 0 0 1 0 7M19 14a4 4 0 0 1 2 3.5V20" />,
  // A softer almond shape with more consistent outer margins.
  eye: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />,
  // A gently tapered bin and two simple internal ribs.
  trash: <path d="M3.5 6h17M8.5 6V3.5h7V6M5.5 6l.7 13a1.5 1.5 0 0 0 1.5 1.5h8.6a1.5 1.5 0 0 0 1.5-1.5l.7-13M10 10v6.5M14 10v6.5" />,
  // Retain the familiar share tray; balance arrow and container.
  share: <path d="M4 12v7a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-7M12 15V3m-4 4 4-4 4 4" />,
  // Separate the nib and end cap for a clearer pencil silhouette.
  pencil: <path d="M15.5 4.5a2.8 2.8 0 0 1 4 4L8 20l-5 1 1-5L15.5 4.5ZM13.5 6.5l4 4M4 16l4 4" />,
  // Simpler walls and a symmetrical receiving notch.
  inbox: <path d="M3 13l3-8h12l3 8v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19v-6ZM3 13h5l2 3h4l2-3h5" />,
  // An access card with a person stepping out through the corner: the card
  // stays, you leave. Deliberately not the logout doorway — this is "Leave
  // aircraft", a danger row that hands back a share you cannot restore.
  exit: <path d="M12 4H4.5A2 2 0 0 0 2.5 6v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M13 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7.5 17v-.5A3.5 3.5 0 0 1 11 13h0a3.5 3.5 0 0 1 3.5 3.5v.5M15.5 8.5 21 3m-5 0h5v5" />,
  // A clear diagonal seam and a separate baseline.
  eraser: <path d="M4 13.5l9-9a2 2 0 0 1 2.8 0l4.7 4.7a2 2 0 0 1 0 2.8l-8 8H8l-4-3.7a2 2 0 0 1 0-2.8ZM9 8.5l7.5 7.5M12.5 20H21" />,
  // Keep the familiar symbol; slightly reduce its visual footprint.
  power: <path d="M12 3v9M6.3 5.7a8.5 8.5 0 1 0 11.4 0" />,
  // Softer outline version of the King Air hangar: matching outer line weight, round caps, five feathered blades, short winglets and simple landing gear. Cockpit windows, filled fuselage and hub rings removed.
  hangar: (
    <>
      <path d="M2 22V9Q24-5 46 9v13h-3V10.5H5V22Z" />
      <g strokeWidth="1.1">
        <path d="M24 13v3.5M21.5 13.5h5M9 17l.6 1.3 12.8.9M25.6 19.2l12.8-.9L39 17" />
        <ellipse cx="24" cy="18.3" rx="1.6" ry="1.8" />
        <path d="M24 20.1v1.7M17 19.5v1.8M31 19.5v1.8" />
      </g>
      <g strokeWidth=".8">
        <path d="M17 18.3L17.00 15.80" />
        <path d="M17 18.3L19.38 17.53" />
        <path d="M17 18.3L18.47 20.32" />
        <path d="M17 18.3L15.53 20.32" />
        <path d="M17 18.3L14.62 17.53" />
        <path d="M31 18.3L31.00 15.80" />
        <path d="M31 18.3L33.38 17.53" />
        <path d="M31 18.3L32.47 20.32" />
        <path d="M31 18.3L29.53 20.32" />
        <path d="M31 18.3L28.62 17.53" />
      </g>
    </>
  ),
  // Replace the paper plane with an actual aircraft seen from above.
  plane: <path d="M12 2.5c-.8 0-1.4 1-1.4 2.2v4.5L3 13v2l7.6-2v5l-2.8 2v1l4.2-1 4.2 1v-1l-2.8-2v-5l7.6 2v-2l-7.6-3.8V4.7c0-1.2-.6-2.2-1.4-2.2Z" />,
  // Two matching aircraft, separated enough to remain distinct.
  fleet: (
    <>
      <g transform="translate(0 0) scale(.65)">
        <path d="M12 2.5c-.8 0-1.4 1-1.4 2.2v4.5L3 13v2l7.6-2v5l-2.8 2v1l4.2-1 4.2 1v-1l-2.8-2v-5l7.6 2v-2l-7.6-3.8V4.7c0-1.2-.6-2.2-1.4-2.2Z" />
      </g>
      <g transform="translate(13 8) scale(.65)">
        <path d="M12 2.5c-.8 0-1.4 1-1.4 2.2v4.5L3 13v2l7.6-2v5l-2.8 2v1l4.2-1 4.2 1v-1l-2.8-2v-5l7.6 2v-2l-7.6-3.8V4.7c0-1.2-.6-2.2-1.4-2.2Z" />
      </g>
    </>
  ),
  // A clearer side profile descending toward a runway.
  landing: <path d="M3 21h18M3.5 13.5l2.5 2 13.5 2a1.8 1.8 0 0 0 .5-3.6l-4.8-.8-5.2-6.6-2-.3 2.7 6.1-3.7-.6-2.5-3-1.5-.2.5 5Z" />,
  // Preserve the broadcast symbol with more regular spacing.
  signal: <path d="M5 5a10 10 0 0 0 0 14M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8M19 5a10 10 0 0 1 0 14M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />,
  // Keep the warning triangle; balance its margins and exclamation.
  alert: <path d="M10.7 4a1.5 1.5 0 0 1 2.6 0l8 14a1.5 1.5 0 0 1-1.3 2.3H4a1.5 1.5 0 0 1-1.3-2.3l8-14ZM12 9v4.5M12 17h.01" />,
  // Keep this familiar prohibition symbol; extra aircraft detail would crowd it.
  grounded: <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM5.6 5.6l12.8 12.8" />,
  // A softer teardrop contour for oil added.
  droplet: <path d="M12 3C10 6 5 10.6 5 14a7 7 0 0 0 14 0c0-3.4-5-8-7-11Z" />,
  // A broader open jaw makes the maintenance tool easier to recognize.
  wrench: <path d="M14 4a5.5 5.5 0 0 0-6.5 7L3.8 15.7a3 3 0 0 0 4.3 4.2l4.7-4.7A5.5 5.5 0 0 0 20 8l-3.5 3-3-1-1-3L16 3.5" />,
  // Restore the original wide body (x=1 to 23), with rounded corners, a centered lens, and the shared 1.7-unit stroke.
  camera: <path d="M7 6l2-3h6l2 3h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4ZM16 13.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />,
  // Open up the nested bends so the attachment mark feels less tangled.
  paperclip: <path d="M9 16l7-7a2.1 2.1 0 0 0-3-3l-8 8a4.2 4.2 0 0 0 6 6l9-9a6 6 0 0 0-8.5-8.5L3 11" />,
  // A light optical adjustment; the existing shape already works.
  check: <path d="M4 12.5l5 5L20 6.5" />,
  // Replace full-height inner rules with quiet denomination marks.
  cash: <path d="M3 6h18v12H3ZM14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM6 12h.01M18 12h.01" />,
  // Add a sparse date grid; inspect it at 13 px before adopting.
  calendar: <path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />,
  // Balance the folded corner and shorten the lower text rule.
  file: <path d="M13.5 3H6a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-10l-6-6ZM13.5 3v6h6M8.5 13h7M8.5 17h5" />,
  // Retain the plain shield so it does not imply an extra verified status.
  shield: <path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" />,
};

/**
 * Glyphs are square on a 24 grid, bar the ones whose composition is not: a
 * formation needs room across, and the hangar has an aeroplane parked in it.
 * A wide glyph keeps the 24 height and takes its width from the box, so it
 * lines up with square icons on the same row.
 */
const WIDE: Partial<Record<IconName, number>> = { hangar: 48, fleet: 30 };

export function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  const box = WIDE[name] ?? 24;
  return (
    <svg
      className="icon"
      viewBox={`0 0 ${box} 24`}
      width={(size * box) / 24}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[name]}
    </svg>
  );
}
