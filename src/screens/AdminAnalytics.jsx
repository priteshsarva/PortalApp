// Admin analytics: the whole platform combined, plus a per-store table you can
// drill into for one store's full report.
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../api.js";
import { C, PageHead, Card, Btn, Badge, Spinner, ErrorNote } from "../ui.jsx";
import AnalyticsView, { inr, num, exportAnalyticsCsv } from "../components/AnalyticsView.jsx";

const RANGES = [{ k: "7", label: "7 days" }, { k: "30", label: "30 days" }, { k: "90", label: "90 days" }];

export default function AdminAnalytics() {
  const [days, setDays] = useState("30");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [store, setStore] = useState(null); // { id, store_name } when drilled in

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - (Number(days) - 1) * 864e5);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [days]);

  useEffect(() => {
    setData(null); setError(null);
    api.adminAnalytics(range).then(setData).catch(setError);
  }, [range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  if (store) return <StoreDrill store={store} range={range} onBack={() => setStore(null)} />;

  return (
    <div>
      <PageHead title="Analytics" sub="Everything across all your stores, combined — plus each store on its own." />

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        {RANGES.map((r) => (
          <button key={r.k} onClick={() => setDays(r.k)}
            style={{ border: days === r.k ? `1px solid ${C.ink}` : "1px solid #d4d9e3", background: days === r.k ? C.ink : "#fff", color: days === r.k ? "#fff" : "#42505f", padding: "5px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer" }}>
            {r.label}
          </button>
        ))}
        <Btn tone="ghost" small onClick={() => data && exportAnalyticsCsv(data, "all-stores")} disabled={!data}>Download CSV</Btn>
        <Btn tone="ghost" small onClick={() => window.print()} disabled={!data}>Save PDF</Btn>
      </div>

      <ErrorNote error={error} />
      {!data ? <Spinner /> : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>All stores combined</div>
            <AnalyticsView data={data} />
          </Card>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>By store</div>
            {(data.stores || []).length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>No stores yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, fontSize: 11, color: "#8a93a3", padding: "0 2px" }}>
                  <span>Store</span><span>Visitors</span><span>Orders</span><span>Revenue</span>
                </div>
                {data.stores.map((s) => (
                  <button key={s.id} onClick={() => setStore(s)}
                    style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center", textAlign: "left", border: "1px solid #eef1f6", borderRadius: 10, padding: "10px 12px", background: "#fff", cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                      <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.store_name}</span>
                      <Badge status={s.status} />
                    </span>
                    <span style={{ fontSize: 13 }}>{num(s.sessions)}</span>
                    <span style={{ fontSize: 13 }}>{num(s.orders)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{inr(s.revenue)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StoreDrill({ store, range, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setData(null); setError(null);
    api.adminSiteAnalytics(store.id, range).then(setData).catch(setError);
  }, [store.id, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#6b7688", fontSize: 13, padding: 0, marginBottom: 14 }}>
        <ArrowLeft size={15} /> All stores
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1b2230" }}>{store.store_name}</h1>
        <Badge status={store.status} />
        <Btn tone="ghost" small onClick={() => data && exportAnalyticsCsv(data, store.slug || "store")} disabled={!data}>Download CSV</Btn>
      </div>
      <ErrorNote error={error} />
      {!data ? <Spinner /> : <Card><AnalyticsView data={data} /></Card>}
    </div>
  );
}
