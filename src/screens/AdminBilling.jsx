// Admin billing — confirm invoices vendors paid by UPI (manual reconcile) and
// see the full invoice ledger. Confirming marks the invoice paid and
// activates/extends the vendor's shop; Pay0 invoices still auto-confirm on their
// own, so this is mainly for UPI/manual payments.
import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Badge, Spinner, ErrorNote, Empty, fmtDate } from "../ui.jsx";

const money = (inv) => `${inv.currency || "INR"} ${Number(inv.amount || 0).toLocaleString("en-IN")}`;
const FILTERS = [["pending", "Awaiting confirmation"], ["created", "Unpaid"], ["paid", "Paid"], ["", "All"]];

export default function AdminBilling() {
  const [invoices, setInvoices] = useState(null);
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    setInvoices(null); setError(null);
    api.adminInvoices(status || undefined).then((r) => setInvoices(r.invoices || [])).catch(setError);
  }
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirm(inv) {
    const utr = window.prompt(`Confirm payment for ${inv.invoice_no || "#" + inv.id} (${money(inv)}).\n\nUTR / reference (optional):`, inv.utr || "");
    if (utr === null) return; // cancelled
    setBusyId(inv.id);
    try { await api.adminMarkInvoicePaid(inv.id, utr.trim() || undefined); load(); }
    catch (e) { alert(e.message); } finally { setBusyId(null); }
  }

  return (
    <div>
      <PageHead title="Billing" sub="Confirm UPI/manual payments and review invoices. Confirming activates the vendor's shop." />
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {FILTERS.map(([s, label]) => (
          <button key={s || "all"} onClick={() => setStatus(s)}
            style={{ border: status === s ? "1px solid #16361b" : "1px solid #d4d9e3", background: status === s ? "#16361b" : "#fff", color: status === s ? "#C8FF3D" : "#42505f", padding: "5px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>
      <ErrorNote error={error} />

      {!invoices ? <Spinner /> : invoices.length === 0 ? (
        <Card><Empty msg="No invoices in this view." /></Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f7f8fb", color: "#6b7688", textAlign: "left" }}>
                <th style={th}>Invoice</th><th style={th}>Client</th><th style={th}>Shop</th>
                <th style={th}>Amount</th><th style={th}>Via</th><th style={th}>UTR</th>
                <th style={th}>Status</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderTop: "1px solid #eef1f6" }}>
                  <td style={td}><span style={{ fontWeight: 600 }}>{inv.invoice_no || `#${inv.id}`}</span>
                    <div style={{ fontSize: 11, color: "#9aa3b2" }}>{fmtDate(inv.created_at)}</div></td>
                  <td style={td}>{inv.user_name || inv.user_email || "—"}</td>
                  <td style={td}>{inv.domain || "—"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{money(inv)}</td>
                  <td style={{ ...td, color: "#6b7688" }}>{inv.gateway || "—"}</td>
                  <td style={{ ...td, color: "#6b7688", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{inv.utr || "—"}</td>
                  <td style={td}><Badge status={inv.status} /></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {inv.status === "paid"
                      ? <span style={{ color: "#2c6e2c", fontSize: 12, fontWeight: 600 }}>Paid</span>
                      : <Btn small tone="lime" onClick={() => confirm(inv)} disabled={busyId === inv.id}>
                          {busyId === inv.id ? "Confirming…" : "Confirm payment"}
                        </Btn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const th = { padding: "10px 14px", fontWeight: 600, fontSize: 12 };
const td = { padding: "10px 14px" };
