// Shared analytics renderer — the KPI cards, revenue chart, funnel, order-status
// breakdown and top-products list. Fed a computed analytics object (from either
// the per-store or the admin-combined endpoint). Range picking + export live in
// the caller.
import React from "react";
import { C } from "../ui.jsx";

export const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
export const num = (n) => (Number(n) || 0).toLocaleString("en-IN");

// Download an analytics object as a CSV (KPIs + funnel + daily series + top
// products). Works in the portal's real browser (unlike sandboxed artifacts).
export function exportAnalyticsCsv(data, nameHint = "analytics") {
  if (!data) return;
  const k = data.kpis || {};
  const rows = [
    ["Range", `${data.range?.from} to ${data.range?.to}`], [],
    ["Metric", "Value"],
    ["Revenue", k.revenue], ["Net revenue", k.net_revenue], ["Orders", k.orders],
    ["Items sold", k.units], ["Avg order value", k.aov], ["Visitors", k.sessions],
    ["Page views", k.pageviews], ["Conversion %", k.conversion_rate], ["Cancelled", k.cancelled], [],
    ["Journey", "Count"],
    ["Product views", data.funnel?.view_item], ["Added to cart", data.funnel?.add_to_cart],
    ["Started checkout", data.funnel?.begin_checkout], ["Bought", data.funnel?.purchase], [],
    ["Date", "Revenue", "Orders", "Visitors"],
    ...(data.series || []).map((r) => [r.d, r.revenue, r.orders, r.sessions]), [],
    ["Product", "Sold", "Revenue", "Orders"],
    ...(data.top_products || []).map((p) => [p.name, p.units, p.revenue, p.orders]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${nameHint}-analytics-${data.range?.from}_${data.range?.to}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AnalyticsView({ data }) {
  if (!data) return null;
  const k = data.kpis || {};
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Stat label="Revenue" value={inr(k.revenue)} sub={`${inr(k.net_revenue)} after cancels`} />
        <Stat label="Orders" value={num(k.orders)} sub={`${num(k.units)} items`} />
        <Stat label="Avg order" value={inr(k.aov)} />
        <Stat label="Visitors" value={num(k.sessions)} sub={`${num(k.pageviews)} views`} />
        <Stat label="Conversion" value={`${k.conversion_rate || 0}%`} />
        <Stat label="Cancelled" value={num(k.cancelled)} />
      </div>

      <SeriesChart series={data.series || []} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginTop: 18 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Shopper journey</div>
          <Funnel funnel={data.funnel || {}} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Order status</div>
          {(data.status_breakdown || []).length === 0
            ? <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>No orders in range.</div>
            : data.status_breakdown.map((s) => (
              <div key={s.status} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", textTransform: "capitalize" }}>
                <span>{s.status}</span><span style={{ color: "#6b7688" }}>{num(s.count)} · {inr(s.total)}</span>
              </div>
            ))}
        </div>
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, margin: "18px 0 8px" }}>Best-selling products</div>
      {(data.top_products || []).length === 0
        ? <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>No sales in range.</div>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.top_products.map((p) => (
              <div key={`${p.db_name}-${p.product_id}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, fontSize: 12.5, padding: "4px 0", borderBottom: "1px solid #f0f2f6" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                <span style={{ color: "#6b7688" }}>{num(p.units)} sold</span>
                <span style={{ fontWeight: 600 }}>{inr(p.revenue)}</span>
              </div>
            ))}
          </div>
        )}
    </>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div style={{ border: "1px solid #e6e9f0", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "#8a93a3", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1b2230" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9aa3b2", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Revenue bars with per-day tooltip. No charting dependency.
function SeriesChart({ series }) {
  if (!series.length) return <div style={{ fontSize: 12.5, color: "#9aa3b2", padding: "16px 0" }}>No activity in this range yet.</div>;
  const maxRev = Math.max(1, ...series.map((r) => Number(r.revenue)));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: series.length > 40 ? 1 : 3, height: 130 }}>
        {series.map((b) => (
          <div key={b.d} title={`${b.d}: ${inr(b.revenue)} · ${b.orders} orders · ${b.sessions} visitors`}
            style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
            <div style={{ width: "100%", height: `${(Number(b.revenue) / maxRev) * 100}%`, minHeight: Number(b.revenue) ? 3 : 0, background: C.lime, borderRadius: "3px 3px 0 0" }} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: "#9aa3b2", marginTop: 4, textAlign: "center" }}>Daily revenue — hover a bar for orders &amp; visitors</div>
    </div>
  );
}

function Funnel({ funnel }) {
  const steps = [
    { label: "Product views", n: funnel.view_item || 0 },
    { label: "Added to cart", n: funnel.add_to_cart || 0 },
    { label: "Started checkout", n: funnel.begin_checkout || 0 },
    { label: "Bought", n: funnel.purchase || 0 },
  ];
  const max = Math.max(1, ...steps.map((s) => s.n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map((s) => (
        <div key={s.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
            <span>{s.label}</span><span style={{ color: "#6b7688" }}>{num(s.n)}</span>
          </div>
          <div style={{ height: 8, background: "#eef1f6", borderRadius: 4 }}>
            <div style={{ width: `${(s.n / max) * 100}%`, height: "100%", background: C.ink, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
