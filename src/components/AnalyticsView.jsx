// Shared analytics renderer — the KPI cards, revenue chart, funnel, order-status
// breakdown and top-products list. Fed a computed analytics object (from either
// the per-store or the admin-combined endpoint). Range picking + export live in
// the caller.
import React from "react";
import { C } from "../ui.jsx";

export const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
export const num = (n) => (Number(n) || 0).toLocaleString("en-IN");
export const dur = (s) => {
  s = Math.max(0, Math.round(Number(s) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
};

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
    ["Page views", k.pageviews], ["Conversion %", k.conversion_rate], ["Cancelled", k.cancelled],
    ["Avg visit (sec)", data.engagement?.avg_session_sec], ["Avg time on page (sec)", data.engagement?.avg_page_sec],
    ["Bounce %", data.engagement?.bounce_pct], [],
    ["Journey", "Count"],
    ["Product views", data.funnel?.view_item], ["Added to cart", data.funnel?.add_to_cart],
    ["Started checkout", data.funnel?.begin_checkout], ["Bought", data.funnel?.purchase], [],
    ["Date", "Revenue", "Orders", "Visitors"],
    ...(data.series || []).map((r) => [r.d, r.revenue, r.orders, r.sessions]), [],
    ["Product", "Sold", "Revenue", "Orders"],
    ...(data.top_products || []).map((p) => [p.name, p.units, p.revenue, p.orders]), [],
    ["Search term", "Searches"],
    ...(data.top_searches || []).map((s) => [s.q, s.n]), [],
    ["Page", "Views", "Visitors"],
    ...(data.top_pages || []).map((p) => [p.path, p.views, p.visitors]), [],
    ["Click", "Count"],
    ...(data.top_clicks || []).map((c) => [c.label, c.n]), [],
    ["Shown product", "Impressions"],
    ...(data.top_impressions || []).map((p) => [p.name || `${p.db_name}/${p.product_id}`, p.impressions]),
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
  const e = data.engagement || {};
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Stat label="Revenue" value={inr(k.revenue)} sub={`${inr(k.net_revenue)} after cancels`} />
        <Stat label="Orders" value={num(k.orders)} sub={`${num(k.units)} items`} />
        <Stat label="Avg order" value={inr(k.aov)} />
        <Stat label="Visitors" value={num(k.sessions)} sub={`${num(k.pageviews)} views`} />
        <Stat label="Conversion" value={`${k.conversion_rate || 0}%`} />
        <Stat label="Avg visit" value={dur(e.avg_session_sec)} sub={`${dur(e.avg_page_sec)} / page`} />
        <Stat label="Bounce" value={`${e.bounce_pct || 0}%`} />
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginTop: 18 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Top pages</div>
          <RankList rows={(data.top_pages || []).map((p) => ({ label: p.path, a: `${num(p.views)} views`, b: `${num(p.visitors)} visitors` }))} empty="No page views in range." />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Top clicks</div>
          <RankList rows={(data.top_clicks || []).map((c) => ({ label: c.label, a: `${num(c.n)} clicks` }))} empty="No clicks tracked yet." />
        </div>
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, margin: "18px 0 8px" }}>Most-shown products (impressions)</div>
      <RankList rows={(data.top_impressions || []).map((p) => ({ label: p.name || `${p.db_name}/${p.product_id}`, a: `${num(p.impressions)} shown` }))} empty="No impressions in range." />

      <div style={{ fontWeight: 600, fontSize: 13, margin: "18px 0 8px" }}>Top searches</div>
      {(data.top_searches || []).length === 0
        ? <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>No searches in range.</div>
        : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.top_searches.map((s) => (
              <span key={s.q} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "#f4f6fa", border: "1px solid #e6e9f0", borderRadius: 999, padding: "4px 10px" }}>
                {s.q}<span style={{ color: "#8a93a3", fontWeight: 600 }}>{num(s.n)}</span>
              </span>
            ))}
          </div>
        )}
    </>
  );
}

// Compact ranked list: label on the left, one or two small stats on the right.
function RankList({ rows, empty }) {
  if (!rows || rows.length === 0) return <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>{empty}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 12.5, padding: "4px 0", borderBottom: "1px solid #f0f2f6" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</span>
          <span style={{ color: "#6b7688", whiteSpace: "nowrap", flexShrink: 0 }}>{r.a}{r.b ? ` · ${r.b}` : ""}</span>
        </div>
      ))}
    </div>
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
    { label: "Impressions", n: funnel.impression || 0 },
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
