"use client";

import { ic, type Insp } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";

export function InspectionsTab({ data, maintHrs, aircraft, save }: TabProps) {
  const all = (data.inspections ?? []) as Insp[];
  const active = all.map((i, idx) => ({ i, idx })).filter((x) => !x.i.inactive);

  // "Complied today" — records today's date + current maintenance-clock hours,
  // exactly what the mechanic sign-off captures. Writes through save().
  async function markComplied(idx: number) {
    const next = all.map((insp, k) =>
      k === idx
        ? {
            ...insp,
            lastDate: new Date().toISOString().slice(0, 10),
            lastHobbs: Number(maintHrs.toFixed(1)),
            populated: true,
          }
        : insp,
    );
    await save({ ...data, inspections: next });
  }

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--muted2)" }}>
                  No inspections recorded.
                </td>
              </tr>
            ) : (
              active.map(({ i, idx }) => {
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
                    <td>
                      <button
                        className="action-btn"
                        onClick={() => markComplied(idx)}
                      >
                        Mark Complied
                      </button>
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
