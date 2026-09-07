"use client";

// SVG chart primitives replacing v1's canvas bChart() and the d3 expense
// charts. Kept dependency-free and theme-reactive (currentColor / CSS vars).

/** Bar chart with readable (non-stretched) value + axis labels. */
export function LabeledBarChart({
  labels,
  data,
  color = "var(--accent)",
  height = 150,
  format = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1)),
}: {
  labels: string[];
  data: number[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
}) {
  if (!data.length || data.every((d) => !d)) {
    return <div className="chart-empty">No data yet.</div>;
  }
  const max = Math.max(...data, 1);
  return (
    <div className="bars" style={{ height }}>
      {data.map((v, i) => (
        <div className="bar-col" key={i}>
          <div className="bar-val">{v ? format(v) : ""}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                height: `${(v / max) * 100}%`,
                background: color,
                // A zero month should read as empty, not as a flat rule.
                minHeight: v > 0 ? 2 : 0,
              }}
              title={`${labels[i]}: ${format(v)}`}
            />
          </div>
          <div className="bar-lbl">{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}

/** Donut for expense-by-category. */
export function Donut({
  slices,
  size = 150,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return <div className="chart-empty">No data yet.</div>;

  const r = size / 2 - 4;
  const cx = size / 2, cy = size / 2;
  const inner = r * 0.58;

  const p = (rad: number, ang: number) =>
    `${cx + rad * Math.cos(ang)} ${cy + rad * Math.sin(ang)}`;

  // Cumulative start angle per slice, derived without mutating anything during
  // render (a running accumulator trips the compiler's immutability rule).
  const starts = slices.reduce<number[]>(
    (acc, s, i) => [...acc, acc[i] + (s.value / total) * Math.PI * 2],
    [-Math.PI / 2],
  );

  const arcs = slices.map((s, i) => {
    const a0 = starts[i];
    const a1 = starts[i + 1];
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return {
      ...s,
      d: `M ${p(r, a0)} A ${r} ${r} 0 ${large} 1 ${p(r, a1)} L ${p(inner, a1)} A ${inner} ${inner} 0 ${large} 0 ${p(inner, a0)} Z`,
    };
  });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} role="img">
        {arcs.map((s) => (
          <path key={s.label} d={s.d} fill={s.color} stroke="var(--bg2)" strokeWidth={1.5}>
            <title>{`${s.label}: ${Math.round((s.value / total) * 100)}%`}</title>
          </path>
        ))}
      </svg>
      <div className="donut-legend">
        {slices.map((s) => (
          <div className="donut-key" key={s.label}>
            <span className="donut-sw" style={{ background: s.color }} />
            <span className="donut-lbl">{s.label}</span>
            <span className="donut-pct">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tiny inline sparkline — v1's _sparkline(). */
export function Sparkline({ vals, color = "var(--accent)" }: { vals: number[]; color?: string }) {
  if (!vals.length || vals.every((v) => !v)) return null;
  const max = Math.max(...vals, 1);
  const w = 60, h = 16;
  const step = vals.length > 1 ? w / (vals.length - 1) : w;
  const pts = vals.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
