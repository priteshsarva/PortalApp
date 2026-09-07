import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { C, PageHead, Card, Badge, Spinner, ErrorNote, Empty, fmtDate } from "../ui.jsx";
import OrderDetailView from "./OrderDetailView.jsx";

const ORDER_STATUSES = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded"];

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({});

  function load() {
    setError(null);
    api.adminOrders(statusFilter ? { status: statusFilter } : undefined)
      .then((r) => setOrders(r.orders || []))
      .catch(setError);
  }
  useEffect(load, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleOpen(id) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!detail[id]) {
      try { const r = await api.adminOrder(id); setDetail((d) => ({ ...d, [id]: r })); }
      catch (e) { setError(e); }
    }
  }
  async function reloadDetail(id) {
    try { const r = await api.adminOrder(id); setDetail((d) => ({ ...d, [id]: r })); } catch { /* ignore */ }
  }
  async function adminVerify(id, utr) {
    try { await api.adminVerifyOrderPayment(id, utr); reloadDetail(id); load(); } catch (e) { alert(e.message); }
  }
  async function adminStatus(id, status) {
    try { await api.adminSetOrderStatus(id, status); reloadDetail(id); load(); } catch (e) { alert(e.message); }
  }
  async function adminMarkShipped(id) {
    try { await api.adminMarkShipped(id); reloadDetail(id); load(); } catch (e) { alert(e.message); }
  }

  return (
    <div>
      <PageHead title="All orders" sub="Every order across every vendor's storefront." />
      <ErrorNote error={error} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["", ...ORDER_STATUSES].map((s) => (
          <button key={s || "all"} onClick={() => setStatusFilter(s)}
            style={{ border: statusFilter === s ? `1px solid ${C.ink}` : "1px solid #d4d9e3", background: statusFilter === s ? C.ink : "#fff", color: statusFilter === s ? "#fff" : "#42505f", padding: "5px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>
            {s || "all"}
          </button>
        ))}
      </div>

      {!orders ? <Spinner /> : orders.length === 0 ? <Card><Empty msg="No orders yet." /></Card> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {orders.map((o) => (
            <Card key={o.id} style={{ padding: 0, overflow: "hidden" }}>
              <div onClick={() => toggleOpen(o.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", cursor: "pointer" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {o.order_no} <span style={{ fontWeight: 500, color: "#9aa3b2" }}>· {o.store_name || o.slug}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 2 }}>
                    {o.buyer_name} · {o.buyer_phone} · ₹{Number(o.total).toLocaleString("en-IN")} · {fmtDate(o.created_at)}
                  </div>
                </div>
                <Badge status={o.status} />
              </div>
              {openId === o.id && (
                <div style={{ padding: "0 16px 14px", borderTop: "1px solid #eef1f6" }}>
                  {!detail[o.id] ? <Spinner msg="Loading…" /> : (
                    <div style={{ paddingTop: 12 }}>
                      <OrderDetailView data={detail[o.id]} role="admin"
                        onVerify={(utr) => adminVerify(o.id, utr)} onStatus={(s) => adminStatus(o.id, s)}
                        onMarkShipped={() => adminMarkShipped(o.id)} />
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
