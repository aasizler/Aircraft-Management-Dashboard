import type { SchedEvent } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";

const TYPE_COLOR: Record<string, string> = {
  flight: "var(--accent)",
  maintenance: "var(--warn)",
  inspection: "var(--danger)",
  reservation: "var(--ok)",
};

export function ScheduleTab({ data }: TabProps) {
  const events = (data.schedule ?? []) as SchedEvent[];

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panel-title">Upcoming</div>
      {events.length === 0 ? (
        <div className="sched-empty">Nothing scheduled.</div>
      ) : (
        events.map((e, idx) => (
          <div className="sched-event" key={e.id ?? idx}>
            <span
              className="sched-type-dot"
              style={{ background: TYPE_COLOR[e.type ?? ""] ?? "var(--muted)" }}
            />
            <div>
              <div className="sched-title">{e.title ?? e.type ?? "Event"}</div>
              <div className="sched-meta">
                {e.start ?? ""}
                {e.end ? ` → ${e.end}` : ""}
                {e.pilot ? ` · ${e.pilot}` : ""}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
