// Admin Wallet — the platform's money position + the payment-verification queue.
// This is where the admin confirms platform-held payments (after checking the
// bank statement) and sees what's collected, held, owed, and earned.
import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Badge, Spinner, ErrorNote, Empty, fmtDate } from "../ui.jsx";
import OrderDetailView from "./OrderDetailView.jsx";

const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function AdminWallet() {
  const [sum, setSum] = useState(null);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({});

  function load() {
    setError(null);
    api.adminMoneySummary().then(setSum).catch(setError);
    api.adminPaymentsToVerify().then((r) => setOrders(r.orders || [])).catch(setError);
  }
  useEffect(load, []);

  async function toggle(id) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!detail[id]) { try { const r = await api.adminOrder(id); setDetail((d) => ({ ...d, [id]: r })); } catch (e) { setError(e); } }
  }
  async function verify(id, utr) {
    try { await api.adminVerifyOrderPayment(id, utr); const r = await api.adminOrder(id); setDetail((d) => ({ ...d, [id]: r })); load(); }
    catch (e) { alert(e.message); }
  }
  async function setStatus(id, s) {
    try { await api.adminSetOrderStatus(id, s); const r = await api.adminOrder(id); setDetail((d) => ({ ...d, [id]: r })); load(); }
    catch (e) { alert(e.message); }
  }
  async function markShipped(id) {
    try { await api.adminMarkShipped(id); const r = await api.adminOrder(id); setDetail((d) => ({ ...d, [id]: r })); load(); }
    catch (e) { alert(e.message); }
  }

  const kpi = (label, val, sub, color) => (
    <Card style={{ flex: "1 1 160px", minWidth: 150 }}>
      <div style={{ fontSize: 11, color: "#6b7688", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || "#1b2230", marginTop: 2 }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: "#8a93a3", marginTop: 2 }}>{sub}</div>}
    </Card>
  );

  return (
    <div>
      <PageHead title="Wallet" sub="Platform money — collect, hold, release and pay out. Confirm platform-held payments here." />
      <ErrorNote error={error} />

      {!sum ? <Spinner /> : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          {kpi("Collected", money(sum.collected), `${sum.verified_orders} verified orders`)}
          {kpi("Platform earnings", money(sum.platform_earnings), `fee ${money(sum.platform_fees)} + gateway ${money(sum.gateway_fees)}`, "#14663a")}
          {kpi("Held (pending shipment)", money(sum.held), "vendor money reserved", "#8a6100")}
          {kpi("Owed to vendors", money(sum.vendor_available), "withdrawable balances")}
          {kpi("Paid out", money(sum.paid_out))}
          {kpi("Pending payouts", money(sum.pending_payouts), `${sum.pending_payouts_count} request(s)`, sum.pending_payouts_count ? "#8a6100" : "#1b2230")}
        </div>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eef1f6" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Payments to verify</div>
          {sum && <Badge status={sum.awaiting_verification ? "pending" : "active"} />}
        </div>
        {!orders ? <Spinner /> : orders.length === 0 ? <Empty msg="Nothing awaiting verification." /> : (
          <div>
            {orders.map((o) => (
              <div key={o.id} style={{ borderBottom: "1px solid #eef1f6" }}>
                <div onClick={() => toggle(o.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{o.order_no} <span style={{ fontWeight: 500, color: "#9aa3b2" }}>· {o.buyer_name}</span></div>
                    <div style={{ fontSize: 12, color: "#6b7688", marginTop: 2 }}><span style={{ color: "#3b6fd8", fontWeight: 600 }}>{o.store_name}</span> · {money(o.total)} · {fmtDate(o.created_at)}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: o.payment_status === "claimed" ? "#fff6e5" : "#f1f3f7", color: o.payment_status === "claimed" ? "#8a6100" : "#6b7688" }}>
                    {o.payment_status === "claimed" ? "Buyer says paid" : "Unpaid"}
                  </span>
                </div>
                {openId === o.id && (
                  <div style={{ padding: "0 16px 16px" }}>
                    {!detail[o.id] ? <Spinner msg="Loading…" /> : (
                      <OrderDetailView data={detail[o.id]} role="admin" onVerify={(utr) => verify(o.id, utr)} onStatus={(s) => setStatus(o.id, s)} onMarkShipped={() => markShipped(o.id)} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
