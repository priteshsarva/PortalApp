// Admin billing — confirm invoices vendors paid by UPI (manual reconcile) and
// see the full invoice ledger. Confirming marks the invoice paid and
// activates/extends the vendor's shop; Pay0 invoices still auto-confirm on their
// own, so this is mainly for UPI/manual payments.
import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Badge, Spinner, ErrorNote, Empty, fmtDate } from "../ui.jsx";

const money = (inv) => `${inv.currency || "INR"} ${Number(inv.amount || 0).toLocaleString("en-IN")}`;
const rupees = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const FILTERS = [["pending", "Awaiting confirmation"], ["created", "Unpaid"], ["paid", "Paid"], ["", "All"]];

export default function AdminBilling() {
  const [tab, setTab] = useState("invoices");
  return (
    <div>
      <PageHead title="Billing" sub="Confirm invoice payments and process vendor payouts." />
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["invoices", "Invoices"], ["payouts", "Payouts"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: tab === k ? "1px solid #16361b" : "1px solid #d4d9e3", background: tab === k ? "#16361b" : "#fff", color: tab === k ? "#C8FF3D" : "#42505f", padding: "5px 14px", borderRadius: 999, fontSize: 12.5, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {tab === "invoices" ? <Invoices /> : <Payouts />}
    </div>
  );
}

function Payouts() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("requested");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const P = [["requested", "Requested"], ["processing", "Processing"], ["paid", "Paid"], ["cancelled", "Cancelled"], ["", "All"]];
  function load() { setRows(null); api.adminPayouts(status || undefined).then((r) => setRows(r.payouts || [])).catch(setError); }
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(p, next) {
    let utr, note;
    if (next === "paid") { utr = window.prompt(`Mark ${rupees(p.amount)} to ${p.user_email} as PAID.\nUTR / reference (optional):`, ""); if (utr === null) return; }
    if (next === "cancelled") { note = window.prompt("Cancel reason (optional):", "") ?? ""; }
    setBusy(p.id);
    try { await api.adminUpdatePayout(p.id, { status: next, utr: utr || undefined, note }); load(); }
    catch (e) { alert(e.message); } finally { setBusy(null); }
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {P.map(([s, label]) => (
          <button key={s || "all"} onClick={() => setStatus(s)}
            style={{ border: status === s ? "1px solid #16361b" : "1px solid #d4d9e3", background: status === s ? "#16361b" : "#fff", color: status === s ? "#C8FF3D" : "#42505f", padding: "5px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      <ErrorNote error={error} />
      {!rows ? <Spinner /> : rows.length === 0 ? <Card><Empty msg="No payouts in this view." /></Card> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((p) => (
            <Card key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{rupees(p.amount)} <span style={{ fontWeight: 500, color: "#9aa3b2" }}>· {p.user_name || p.user_email}</span></div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 2 }}>
                    {p.method.toUpperCase()}: {p.method === "upi" ? (p.destination?.upi || "—") : JSON.stringify(p.destination)} · {fmtDate(p.created_at)}
                    {p.utr ? ` · UTR ${p.utr}` : ""} · wallet {rupees(p.wallet_available)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Badge status={p.status === "paid" ? "active" : p.status === "cancelled" ? "rejected" : "pending"} />
                  {p.status === "requested" && <Btn small onClick={() => act(p, "processing")} disabled={busy === p.id}>Mark processing</Btn>}
                  {(p.status === "requested" || p.status === "processing") && <>
                    <Btn small tone="lime" onClick={() => act(p, "paid")} disabled={busy === p.id}>Mark paid</Btn>
                    <Btn small tone="ghost" onClick={() => act(p, "cancelled")} disabled={busy === p.id}>Cancel</Btn>
                  </>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Invoices() {
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
