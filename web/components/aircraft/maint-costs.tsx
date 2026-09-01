"use client";

import { useState } from "react";
import {
  fmtMoney, MAINT_CAT_HEX, MAINT_CAT_LABELS, MAINT_CAT_OPTIONS, monthLabel, readMonthly, today,
  type MaintCategory, type MaintCost, type V1Aircraft,
} from "@/lib/aircraft";
import { Modal } from "@/components/ui/modal";
import { Confirm } from "@/components/ui/confirm";
import { Donut, LabeledBarChart } from "@/components/ui/charts";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { ReceiptScan } from "./receipt-scan";
import type { PendingAction } from "./detail-client";

const CATS = Object.keys(MAINT_CAT_LABELS) as MaintCategory[];

/**
 * Maintenance Cost Tracker + Expense Analytics, ported from v1's renderMaint(),
 * openMaintModal(), saveMaint(), deleteMaint(), exportMaintExcel() and
 * renderExpenseCharts(). None of it survived the first port — N137BF already
 * has five cost entries (including a scanned fuel receipt) sitting unread in
 * aircraft.data.maintCosts.
 */
export function MaintCosts({
  data, save, reg, consumeAction,
}: {
  data: V1Aircraft;
  save: (next: V1Aircraft) => Promise<void>;
  reg: string;
  consumeAction: (...want: PendingAction[]) => boolean;
}) {
  const entries = (data.maintCosts ?? []) as MaintCost[];
  const toast = useToast();
  const [open, setOpen] = useState(() => consumeAction("log-cost"));
  const [busy, setBusy] = useState(false);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [f, setF] = useState({
    date: today(), cost: "", cat: "inspection" as MaintCategory, desc: "", shop: "",
  });

  const total = entries.reduce((s, e) => s + (Number(e.cost) || 0), 0);

  // Newest first. The table rendered entries in raw array order, which is
  // insertion order for anything imported — so a 2025 receipt could sit above a
  // 2026 one. Delete indexes into the ORIGINAL array, so carry that index along
  // rather than sorting the array itself.
  const ordered = entries
    .map((e, i) => [e, i] as const)
    .sort((a, b) => (b[0].date ?? "").localeCompare(a[0].date ?? ""));

  async function submit() {
    const cost = Number(f.cost);
    if (!cost) { toast("Enter an amount.", "warn"); return; }
    setBusy(true);
    const entry: MaintCost = {
      date: f.date, cost, cat: f.cat,
      desc: f.desc.trim(), shop: f.shop.trim(),
    };
    await save({ ...data, maintCosts: [entry, ...entries] });
    setBusy(false);
    setOpen(false);
    setF({ date: today(), cost: "", cat: "inspection", desc: "", shop: "" });
    toast(`${fmtMoney(cost)} logged`, "ok");
  }

  async function remove(idx: number) {
    await save({ ...data, maintCosts: entries.filter((_, k) => k !== idx) });
    setConfirmIdx(null);
    toast("Cost entry deleted", "ok");
  }

  // v1 exported .xls via an HTML table; a real CSV is more portable and opens
  // in Excel and Sheets alike.
  function exportCsv() {
    if (!entries.length) { toast("Nothing to export.", "warn"); return; }
    const rows = [
      ["Date", "Category", "Description", "Shop", "Amount"],
      ...entries.map((e) => [
        e.date,
        MAINT_CAT_LABELS[e.cat] ?? e.cat,
        e.desc ?? "",
        e.shop ?? "",
        String(e.cost),
      ]),
      [], ["Total", "", "", "", String(total.toFixed(2))],
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reg}-maintenance-costs.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported maintenance costs", "ok");
  }

  // ── Analytics ────────────────────────────────────────────────────────────
  const byMonthMap: Record<string, number> = {};
  entries.forEach((e) => {
    const m = (e.date ?? "").slice(0, 7);
    if (m) byMonthMap[m] = (byMonthMap[m] ?? 0) + (Number(e.cost) || 0);
  });
  const months = Object.entries(byMonthMap).sort().slice(-6);

  const byCatMap: Record<string, number> = {};
  entries.forEach((e) => {
    byCatMap[e.cat] = (byCatMap[e.cat] ?? 0) + (Number(e.cost) || 0);
  });
  const catSlices = Object.entries(byCatMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, value]) => ({
      label: MAINT_CAT_LABELS[cat as MaintCategory] ?? cat,
      value,
      color: MAINT_CAT_HEX[cat as MaintCategory] ?? "#888",
    }));

  // Cost per flight hour, month by month, using the recorded monthly hours.
  const hoursByMonth = readMonthly(data.monthlyHours, 6);
  const cph = hoursByMonth.map((h) => {
    const spend = byMonthMap[h.month] ?? 0;
    return h.hours > 0 ? spend / h.hours : 0;
  });

  const year = new Date().getFullYear();
  const ytd = entries
    .filter((e) => (e.date ?? "").startsWith(String(year)))
    .reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const ytdByCat = Object.entries(
    entries
      .filter((e) => (e.date ?? "").startsWith(String(year)))
      .reduce<Record<string, number>>((acc, e) => {
        acc[e.cat] = (acc[e.cat] ?? 0) + (Number(e.cost) || 0);
        return acc;
      }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const totalHours = hoursByMonth.reduce((s, m) => s + m.hours, 0);

  return (
    <>
      <div style={{ marginTop: 20, borderTop: "1px solid var(--border2)", paddingTop: 16 }}>
        <div className="section-hd">
          <span className="section-label">Maintenance Costs</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {entries.length > 0 && (
              <span className="mono">Total: {fmtMoney(total)}</span>
            )}
            <button className="btn sm" onClick={exportCsv}>Export</button>
            <button className="btn sm primary" onClick={() => setOpen(true)}>Log Cost</button>
            <ReceiptScan data={data} save={save} />
          </div>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon="cash"
            title="No costs recorded"
            body="Fuel, parts and shop invoices land here, and drive the cost-per-hour figures below."
            action={{ label: "Log cost", onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Category</th><th>Description</th>
                  <th>Shop</th><th>Amount</th><th></th>
                </tr>
              </thead>
              <tbody>
                {ordered.map(([e, i]) => {
                  const hex = MAINT_CAT_HEX[e.cat] ?? "#888";
                  return (
                    <tr key={i}>
                      <td className="mono">{e.date}</td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: hex + "22", color: hex, borderColor: hex + "44" }}
                        >
                          {MAINT_CAT_LABELS[e.cat] ?? e.cat}
                        </span>
                      </td>
                      <td className="wrap-cell" style={{ fontSize: 12 }}>{e.desc || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--muted2)" }}>{e.shop || "—"}</td>
                      <td className="mono" style={{ color: "var(--ok)", fontWeight: 600 }}>
                        {fmtMoney(Number(e.cost) || 0)}
                      </td>
                      <td>
                        <button className="action-btn del" onClick={() => setConfirmIdx(i)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, borderTop: "1px solid var(--border2)", paddingTop: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Expense Analytics</div>
        <div className="two-col" style={{ marginTop: 0 }}>
          <div className="panel">
            <div className="panel-title">Monthly Spend</div>
            <LabeledBarChart
              labels={months.map((m) => monthLabel(m[0]))}
              data={months.map((m) => m[1])}
              color="var(--accent)"
              format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))}
            />
          </div>
          <div className="panel">
            <div className="panel-title">By Category</div>
            <Donut slices={catSlices} />
          </div>
        </div>
        <div className="two-col">
          <div className="panel">
            <div className="panel-title">Cost per Flight Hour</div>
            <LabeledBarChart
              labels={hoursByMonth.map((m) => monthLabel(m.month))}
              data={cph}
              color="#34d399"
              format={(v) => `$${v.toFixed(0)}`}
            />
          </div>
          <div className="panel">
            <div className="panel-title">Year-to-Date</div>
            {ytd === 0 ? (
              <div className="chart-empty">No data</div>
            ) : (
              <div style={{ padding: "4px 0" }}>
                <div className="stat-val" style={{ fontSize: 26 }}>{fmtMoney(ytd)}</div>
                <div className="stat-sub" style={{ marginBottom: 12 }}>
                  spent in {year}
                  {totalHours > 0 && ` · ${fmtMoney(ytd / totalHours)}/hr`}
                </div>
                {ytdByCat.map(([cat, v]) => (
                  <div className="progress-row" key={cat} style={{ marginBottom: 10 }}>
                    <div className="progress-label">
                      <span>{MAINT_CAT_LABELS[cat as MaintCategory] ?? cat}</span>
                      <span>{fmtMoney(v)}</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(v / ytd) * 100}%`,
                          background: MAINT_CAT_HEX[cat as MaintCategory] ?? "#888",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {open && (
        <Modal title="Log Maintenance Cost" onClose={() => setOpen(false)}>
          <div className="form-grid">
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="form-row">
              <label>Amount ($)</label>
              <input type="number" step="0.01" value={f.cost} onChange={(e) => setF((p) => ({ ...p, cost: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div className="form-row">
            <label>Category</label>
            <select value={f.cat} onChange={(e) => setF((p) => ({ ...p, cat: e.target.value as MaintCategory }))}>
              {CATS.map((c) => <option key={c} value={c}>{MAINT_CAT_OPTIONS[c]}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Description</label>
            <input value={f.desc} onChange={(e) => setF((p) => ({ ...p, desc: e.target.value }))} placeholder="What was done..." />
          </div>
          <div className="form-row">
            <label>Shop / Vendor</label>
            <input value={f.shop} onChange={(e) => setF((p) => ({ ...p, shop: e.target.value }))} placeholder="Shop name or self" />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {confirmIdx != null && (
        <Confirm
          message={
            <>Delete the {fmtMoney(Number(entries[confirmIdx]?.cost) || 0)} entry
            from {entries[confirmIdx]?.date}?</>
          }
          onConfirm={() => remove(confirmIdx)}
          onCancel={() => setConfirmIdx(null)}
        />
      )}
    </>
  );
}
