// Admin: review parcel-photo proof and approve shipment legs. Approving releases
// that leg's held wallet share to the seller. Also a purge-preview to download
// photos before the 60-day auto-delete.
import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Badge, Spinner, ErrorNote, Empty, fmtDate } from "../ui.jsx";
import OrderDetailView from "./OrderDetailView.jsx";

const LEG = { wholesaler_to_retailer: "Wholesaler → Retailer", retailer_to_customer: "Retailer → Customer", wholesaler_to_customer: "Wholesaler → Customer" };

export default function AdminShipments() {
  const [tab, setTab] = useState("review");
  return (
    <div>
      <PageHead title="Shipments" sub="Approve parcel proof to release held funds. Photos auto-delete after 60 days." />
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["review", "To review"], ["all", "All"], ["purge", "Photo backup"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: tab === k ? "1px solid #16361b" : "1px solid #d4d9e3", background: tab === k ? "#16361b" : "#fff", color: tab === k ? "#C8FF3D" : "#42505f", padding: "5px 14px", borderRadius: 999, fontSize: 12.5, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {tab === "purge" ? <PurgeBackup /> : <List status={tab === "review" ? "submitted" : ""} />}
    </div>
  );
}

function List({ status }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({});
  function load() { setRows(null); api.adminShipments(status || undefined).then((r) => setRows(r.shipments || [])).catch(setError); }
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  async function toggleOrder(s) {
    if (openId === s.id) { setOpenId(null); return; }
    setOpenId(s.id);
    if (!detail[s.id]) { try { const r = await api.adminOrder(s.order_id); setDetail((d) => ({ ...d, [s.id]: r })); } catch (e) { alert(e.message); } }
  }
  async function act(s, next) {
    let note;
    if (next === "rejected") { note = window.prompt("Reason for rejection:", "") ?? ""; }
    setBusy(s.id);
    try {
      const r = await api.adminUpdateShipment(s.id, { status: next, note });
      if (next === "approved" && r.released?.length) alert(`Released ₹${r.released.reduce((a, x) => a + Number(x.amount), 0).toLocaleString("en-IN")} to the seller's wallet.`);
      load();
    } catch (e) { alert(e.message); } finally { setBusy(null); }
  }
  if (!rows) return <Card><Spinner /></Card>;
  if (error) return <Card><ErrorNote error={error} /></Card>;
  if (!rows.length) return <Card><Empty msg="Nothing here." /></Card>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((s) => (
        <Card key={s.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.order_no} <span style={{ fontWeight: 500, color: "#6b7688" }}>· {LEG[s.leg] || s.leg}</span></div>
              <div style={{ fontSize: 12, color: "#6b7688", marginTop: 2 }}>{s.shipped_by_email || ""}{s.courier ? ` · ${s.courier}` : ""}{s.tracking_no ? ` · ${s.tracking_no}` : ""} · {fmtDate(s.created_at)}</div>
            </div>
            <Badge status={s.status === "approved" ? "active" : s.status === "rejected" ? "rejected" : "pending"} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
            {(s.photos || []).map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ width: 70, height: 70, borderRadius: 8, overflow: "hidden", border: "1px solid #e6e9f0" }}>
                <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
              </a>
            ))}
            {!(s.photos || []).length && <span style={{ fontSize: 12, color: "#9aa3b2" }}>Photos purged</span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {s.status === "submitted" && (
              <>
                <Btn small tone="lime" disabled={busy === s.id} onClick={() => act(s, "approved")}>Approve &amp; release funds</Btn>
                <Btn small tone="ghost" disabled={busy === s.id} onClick={() => act(s, "rejected")}>Reject</Btn>
              </>
            )}
            <Btn small tone="ghost" onClick={() => toggleOrder(s)}>{openId === s.id ? "Hide order" : "View order"}</Btn>
          </div>
          {s.note && <div style={{ fontSize: 12, color: "#8a6100", marginTop: 6 }}>Note: {s.note}</div>}
          {openId === s.id && (
            <div style={{ marginTop: 12, borderTop: "1px solid #eef1f6", paddingTop: 12 }}>
              {!detail[s.id] ? <Spinner msg="Loading…" /> : <OrderDetailView data={detail[s.id]} role="admin" />}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function PurgeBackup() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.adminPurgePreview(7).then(setData).catch(setError); }, []);
  if (error) return <Card><ErrorNote error={error} /></Card>;
  if (!data) return <Card><Spinner /></Card>;
  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Photos deleting within 7 days</div>
      <div style={{ fontSize: 12.5, color: "#6b7688", marginBottom: 12 }}>
        {data.files.length} photo(s) across {data.shipments} shipment(s). Open each to download for your local backup before they're auto-deleted.
      </div>
      {!data.files.length ? <Empty msg="Nothing scheduled to purge." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.files.map((f, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, borderBottom: "1px solid #f2f4f8", padding: "5px 0" }}>
              <a href={f.url} target="_blank" rel="noreferrer" style={{ color: "#3b6fd8" }}>{f.order_no} · {LEG[f.leg] || f.leg}</a>
              <span style={{ color: "#9aa3b2" }}>deletes {fmtDate(f.purge_after)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
