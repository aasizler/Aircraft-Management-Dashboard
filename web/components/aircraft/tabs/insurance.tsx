import type { TabProps } from "../detail-client";

type Pilot = {
  name?: string;
  cert?: string;
  tt?: string | number;
  intype?: string | number;
  medical?: string;
  ratings?: string;
};

export function InsuranceTab({ data }: TabProps) {
  const ins = (data.insurance ?? {}) as Record<string, unknown>;
  const pilots = (ins.pilots as Pilot[]) ?? [];

  const fields: [string, unknown][] = [
    ["Carrier", ins.carrier],
    ["Policy #", ins.policy],
    ["Coverage", ins.coverage],
    ["Premium", ins.premium],
    ["Effective", ins.effective],
    ["Expires", ins.expires],
  ];

  return (
    <div className="two-col">
      <div className="panel">
        <div className="panel-title">Policy</div>
        {fields.every(([, v]) => v == null || v === "") ? (
          <div style={{ color: "var(--muted2)", fontSize: 13 }}>
            No policy details.
          </div>
        ) : (
          fields.map(([label, val]) => (
            <div className="ins-field" key={label}>
              <span className="ins-field-label">{label}</span>
              <span className="ins-field-value">
                {val != null && val !== "" ? String(val) : "—"}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Named Pilots</div>
        {pilots.length === 0 ? (
          <div style={{ color: "var(--muted2)", fontSize: 13 }}>
            No named pilots.
          </div>
        ) : (
          pilots.map((p, idx) => (
            <div className="pilot-card" key={idx}>
              <div>
                <div className="pilot-card-name">{p.name ?? "—"}</div>
                <div className="pilot-card-meta">
                  {p.cert ? `${p.cert}` : ""}
                  {p.ratings ? ` · ${p.ratings}` : ""}
                  {p.tt ? ` · ${p.tt} TT` : ""}
                  {p.medical ? ` · ${p.medical}` : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
