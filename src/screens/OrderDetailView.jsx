// Detailed order view (WooCommerce-style), shared by the admin and vendor order
// screens. Two columns: items + money on the left, order/customer/payment/
// fulfilment/shipments on the right. Role gates the actions and the charge
// breakdown:
//   admin  — sees & verifies everything (platform-held payments), full split.
//   vendor — sees their sale + margin + charges; verifies only direct-mode.
// Data comes from GET .../orders/:id -> { order, items, shipments }.
import React, { useState } from "react";
import { Badge, Btn, fmtDate } from "../ui.jsx";

const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const LEG_LABEL = { wholesaler_to_retailer: "Wholesaler → retailer", retailer_to_customer: "Retailer → customer", wholesaler_to_customer: "Wholesaler → customer" };
const ORDER_STATUSES = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded"];

export default function OrderDetailView({ data, role = "vendor", onVerify, onStatus, onShip, onMarkShipped, busy }) {
  const { order, items = [], shipments = [] } = data || {};
  const [status, setStatus] = useState(order?.status || "pending");
  if (!order) return null;

  const isAdmin = role === "admin";
  const snap = (it) => { try { return typeof it.snapshot === "string" ? JSON.parse(it.snapshot) : (it.snapshot || {}); } catch { return {}; } };
  const paid = order.payment_status === "verified";
  const addr = order.address || {};

  // money breakdown (server froze the split at verify time)
  const subtotal = Number(order.subtotal ?? order.total);
  const costTotal = items.reduce((s, it) => s + Number(it.cost_price || 0) * Number(it.qty), 0);
  const rows = [
    ["Items subtotal", money(subtotal)],
    order.share_wholesaler ? ["Wholesaler payout (cost)", money(order.share_wholesaler)] : null,
    order.platform_fee ? ["Platform fee", "− " + money(order.platform_fee)] : null,
    order.gateway_fee ? ["Gateway fee", "− " + money(order.gateway_fee)] : null,
    order.share_retailer != null ? ["Retailer net (margin)", money(order.share_retailer)] : null,
  ].filter(Boolean);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
      {/* LEFT: items + money */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={box}>
          <div style={hd}>Items</div>
          {items.map((it) => {
            const sp = snap(it);
            return (
              <div key={it.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #f2f4f8" }}>
                <div style={{ width: 46, height: 46, borderRadius: 6, background: "#f2f4f8", flexShrink: 0, overflow: "hidden" }}>
                  {(it.image_url || sp.thumbnail) && <img src={it.image_url || sp.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{it.product_name}</div>
                  <div style={{ fontSize: 11.5, color: "#6b7688", marginTop: 2 }}>
                    {it.size ? `Size ${it.size} · ` : ""}{sp.sku ? `SKU ${sp.sku} · ` : ""}
                    {(sp.primary_cat || it.db_name)}{sp.sub ? ` / ${sp.sub}` : ""}
                    {it.db_name === "wholesale" ? " · wholesale" : ""}
                  </div>
                  <div style={{ fontSize: 11.5, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {it.page_url && <a href={it.page_url} target="_blank" rel="noreferrer" style={{ color: "#3b6fd8", textDecoration: "none" }}>store page ↗</a>}
                    {it.product_url && <a href={it.product_url} target="_blank" rel="noreferrer" style={{ color: "#6b7688", textDecoration: "underline" }}>source ↗</a>}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12.5, whiteSpace: "nowrap" }}>
                  <div>{money(it.unit_price)} × {it.qty}</div>
                  <div style={{ fontWeight: 700 }}>{money(it.line_total)}</div>
                  {it.cost_price != null && <div style={{ fontSize: 11, color: "#8a6100", marginTop: 2 }}>cost {money(it.cost_price)}</div>}
                  {it.cost_price != null && <div style={{ fontSize: 11, color: "#14663a" }}>margin {money((Number(it.unit_price) - Number(it.cost_price)) * Number(it.qty))}</div>}
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 12, marginLeft: "auto", width: "min(320px, 100%)" }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#42505f", padding: "3px 0" }}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15, borderTop: "1px solid #e6e9f0", marginTop: 6, paddingTop: 6 }}>
              <span>Order total</span><span>{money(order.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginTop: 4, color: paid ? "#14663a" : "#8a6100" }}>
              <span>{paid ? "Paid" : "Pending payment"}</span><span>{paid ? money(order.total) : money(order.total)}</span>
            </div>
            {isAdmin && costTotal > 0 && (
              <div style={{ fontSize: 11, color: "#8a93a3", marginTop: 6 }}>Total supplier cost: {money(costTotal)}</div>
            )}
          </div>
        </div>

        {/* Shipments / fulfilment proof */}
        <div style={box}>
          <div style={hd}>Fulfilment</div>
          {(() => {
            // Only call it a wholesaler route if the order actually has wholesale
            // items. A retailer's own (platform) products = the retailer ships.
            const hasWholesale = items.some((it) => it.cost_price != null || it.db_name === "wholesale");
            const route = order.fulfilment_mode === "direct_to_customer" && hasWholesale ? "Wholesaler ships directly to the customer"
              : hasWholesale ? "Wholesaler → you → customer"
              : "You ship to the customer";
            return <div style={{ fontSize: 12, color: "#6b7688", marginBottom: 8 }}>Route: {route}</div>;
          })()}
          {/* Ship actions. Vendor uploads proof; admin can mark shipped directly. */}
          {(() => {
            const verified = order.payment_status === "verified";
            const custLeg = order.fulfilment_mode === "direct_to_customer" ? "wholesaler_to_customer" : "retailer_to_customer";
            const custShip = shipments.find((s) => s.leg === custLeg);
            const done = order.status === "completed" || (custShip && custShip.status === "approved");
            if (!verified) return <div style={{ fontSize: 12, color: "#8a6100", marginBottom: 10 }}>Awaiting payment verification before shipping.</div>;
            if (done) return <div style={{ fontSize: 12.5, color: "#14663a", fontWeight: 600, marginBottom: 10 }}>✓ Shipped &amp; fulfilled</div>;
            return (
              <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {role === "vendor" && onShip && order.fulfilment_mode !== "direct_to_customer" && (
                  custShip && custShip.status === "submitted"
                    ? <span style={{ fontSize: 12, color: "#8a6100" }}>Proof submitted — awaiting admin approval.</span>
                    : <Btn small tone="lime" disabled={busy} onClick={() => onShip("retailer_to_customer")}>📦 Mark shipped — upload proof</Btn>
                )}
                {role === "vendor" && order.fulfilment_mode === "direct_to_customer" && (
                  <span style={{ fontSize: 12, color: "#2b5bb5" }}>The wholesaler ships this order directly.</span>
                )}
                {role === "admin" && onMarkShipped && (
                  <Btn small disabled={busy} onClick={() => { if (confirm("Mark this order shipped and release all held funds to the seller(s)?")) onMarkShipped(); }}>Mark shipped (no proof)</Btn>
                )}
              </div>
            );
          })()}
          {shipments.length === 0 ? <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>{order.status === "completed" ? "Marked fulfilled — no parcel photos on file." : "No shipments submitted yet."}</div> : shipments.map((s) => (
            <div key={s.id} style={{ border: "1px solid #eef1f6", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span style={{ fontWeight: 600 }}>{LEG_LABEL[s.leg] || s.leg}</span>
                <Badge status={s.status === "approved" ? "active" : s.status === "rejected" ? "rejected" : "pending"} />
              </div>
              <div style={{ fontSize: 11.5, color: "#6b7688", marginTop: 2 }}>{s.courier || "courier —"} {s.tracking_no ? `· ${s.tracking_no}` : ""} · {fmtDate(s.created_at)}</div>
              {Array.isArray(s.photos) && s.photos.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {s.photos.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ width: 40, height: 40, borderRadius: 5, overflow: "hidden", border: "1px solid #e6e9f0" }}>
                      <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: order meta + actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={box}>
          <div style={hd}>Order {order.order_no}</div>
          <div style={{ fontSize: 12, color: "#6b7688" }}>Placed {fmtDate(order.created_at)}</div>
          <div style={{ display: "flex", gap: 8, margin: "8px 0" }}><Badge status={statusTone(order.status)} />
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: paid ? "#e8f7ee" : "#fff6e5", color: paid ? "#14663a" : "#8a6100" }}>
              {order.payment_status === "verified" ? "Paid" : order.payment_status === "claimed" ? "Payment claimed" : "Unpaid"}
            </span>
          </div>
          {/* status control */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={sel}>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Btn small disabled={busy || status === order.status} onClick={() => onStatus && onStatus(status)}>Update</Btn>
          </div>
        </div>

        {/* payment + verify */}
        <div style={box}>
          <div style={hd}>Payment</div>
          <div style={{ fontSize: 12.5, color: "#42505f" }}>
            Mode: {order.payout_mode || "—"}<br />
            {order.payment_utr ? <>UTR: <strong>{order.payment_utr}</strong><br /></> : null}
            Status: {order.payment_status}
          </div>
          {/* Platform-held payments are verified by the ADMIN (checks the platform
              bank statement); the vendor verifies only their own direct payments. */}
          {order.payment_status !== "verified" && onVerify && (isAdmin || order.payout_mode === "direct") ? (
            <Btn tone="lime" small style={{ marginTop: 8 }} disabled={busy}
              onClick={() => { const utr = window.prompt("Confirm payment received.\nUTR / reference (optional):", order.payment_utr || "") ?? undefined; if (utr !== undefined) onVerify(utr || undefined); }}>
              Verify payment
            </Btn>
          ) : order.payment_status !== "verified" && !isAdmin && order.payout_mode === "platform" ? (
            <div style={{ fontSize: 11.5, color: "#8a6100", marginTop: 8 }}>Payment is collected by the platform — the admin verifies it, then your share is credited.</div>
          ) : null}
          {order.payment_status === "claimed" && <div style={{ fontSize: 11.5, color: "#8a6100", marginTop: 6 }}>Buyer says they've paid — check the statement, then verify.</div>}
        </div>

        <div style={box}>
          <div style={hd}>Customer</div>
          <div style={{ fontSize: 12.5, color: "#42505f", lineHeight: 1.6 }}>
            <strong>{order.buyer_name}</strong><br />
            {order.buyer_email && <>{order.buyer_email}<br /></>}
            {order.buyer_phone && <>📞 {order.buyer_phone}<br /></>}
          </div>
          <div style={{ ...hd, marginTop: 12 }}>Shipping</div>
          <div style={{ fontSize: 12.5, color: "#42505f", lineHeight: 1.6 }}>
            {[addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ") || "—"}
          </div>
          {order.note && <><div style={{ ...hd, marginTop: 12 }}>Note</div><div style={{ fontSize: 12.5, color: "#42505f" }}>{order.note}</div></>}
        </div>
      </div>
    </div>
  );
}

function statusTone(s) {
  if (s === "completed") return "active";
  if (s === "cancelled" || s === "refunded") return "rejected";
  if (s === "processing") return "active";
  return "pending";
}
const box = { border: "1px solid #eef1f6", borderRadius: 10, padding: 14, background: "#fff" };
const hd = { fontWeight: 700, fontSize: 13.5, marginBottom: 8 };
const sel = { border: "1px solid #d4d9e3", borderRadius: 8, padding: "6px 9px", fontSize: 12.5, textTransform: "capitalize" };
