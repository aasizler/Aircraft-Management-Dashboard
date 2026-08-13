import { ic, type Insp } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";

export function InspectionsTab({ data, maintHrs, aircraft }: TabProps) {
  const all = (data.inspections ?? []) as Insp[];
  const active = all.filter((i) => !i.inactive);

  return (
    <>
      <div className="tbl-toolbar">
        <span className="mono">
          measured against {aircraft.maint_basis} · {maintHrs.toFixed(1)} hrs
        </span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Inspection</th>
              <th>Last Complied</th>
              <th>Interval</th>
              <th>Next Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted2)" }}>
                  No inspections recorded.
                </td>
              </tr>
            ) : (
              active.map((i, idx) => {
                const st = ic(i, maintHrs);
                const cls =
                  st.s === "overdue" ? "overdue" : st.s === "warn" ? "warn" : "ok";
                const label =
                  st.s === "overdue" ? "OVERDUE" : st.s === "warn" ? "DUE SOON" : "OK";
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{i.name}</td>
                    <td className="mono">
                      {i.lastDate ?? "—"}
                      {i.lastHobbs != null ? ` · ${i.lastHobbs} hrs` : ""}
                    </td>
                    <td className="mono">
                      {i.intervalHrs
                        ? `${i.intervalHrs} hrs`
                        : i.intervalDays
                          ? `${i.intervalDays} days`
                          : "—"}
                    </td>
                    <td className="mono">{st.nl}</td>
                    <td>
                      <span className={`badge ${cls}`}>{label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
