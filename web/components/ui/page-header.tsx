// Page title + "Today is …" line, ported from v1's #hangar-date / #detail-date.
// Rendered from a server component so the date is formatted once, with no
// client clock read and no hydration mismatch.
export function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="page-hd"
      style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}
    >
      <div>
        <div className="page-title">{title}</div>
        <div className="page-sub">{sub ?? `Today is ${today}`}</div>
      </div>
      {right}
    </div>
  );
}
