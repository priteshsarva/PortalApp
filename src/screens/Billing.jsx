import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../api.js";
import { C, PageHead, Card, Btn, Badge, Spinner, ErrorNote, Empty, fmtDate, Field, inputStyle } from "../ui.jsx";
import { upiLink, payWhatsAppUrl } from "../lib/upi.js";

const money = (inv) => `${inv.currency || "INR"} ${Number(inv.amount || 0).toLocaleString("en-IN")}`;
const isUnpaid = (s) => s === "created" || s === "pending";

export default function Billing() {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [note, setNote] = useState("");
  const [upi, setUpi] = useState(null);       // platform UPI { upi_id, upi_name, whatsapp }
  const [upiFor, setUpiFor] = useState(null); // invoice currently paying by UPI

  async function load() {
    setError(null);
    try { setInvoices((await api.invoices()).invoices || []); }
    catch (e) { setError(e); }
    try { const info = await api.paymentInfo(); setUpi(info.upi && info.upi.upi_id ? info.upi : null); }
    catch { /* UPI optional */ }
  }

  // First load, and if we just came back from the gateway (?paid=<id>), verify it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paidId = params.get("paid");
    (async () => {
      if (paidId) {
        setNote("Confirming your payment…");
        try {
          const r = await api.verifyInvoice(paidId);
          setNote(r.paid ? "Payment confirmed — your shop is active." : "Payment not confirmed yet. If you paid, it may take a moment.");
        } catch { setNote(""); }
        // clean the URL so a refresh doesn't re-verify
        window.history.replaceState({}, "", window.location.pathname);
      }
      load();
    })();
  }, []);

  async function pay(inv) {
    setBusyId(inv.id); setError(null);
    try {
      const { payment_url } = await api.payInvoice(inv.id);
      if (payment_url) window.location.href = payment_url;  // hand off to the gateway
      else { setError(new Error("Could not start payment — no payment URL returned.")); setBusyId(null); }
    } catch (e) { setError(e); setBusyId(null); }
  }

  return (
    <div>
      <PageHead title="Billing" sub="Your invoices. Pay online to activate or renew a shop." />
      {note && (
        <div style={{ background: "#eef7ee", border: "1px solid #cbe5cb", color: "#2c6e2c", padding: "10px 14px", borderRadius: 9, marginBottom: 14, fontSize: 13 }}>{note}</div>
      )}
      <ErrorNote error={error} />

      {!invoices ? <Spinner /> : invoices.length === 0 ? (
        <Card><Empty msg="No invoices yet. Once a shop is approved, its invoice appears here." /></Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f7f8fb", color: "#6b7688", textAlign: "left" }}>
                <th style={th}>Invoice</th><th style={th}>Shop</th><th style={th}>Amount</th>
                <th style={th}>Period</th><th style={th}>Due</th><th style={th}>Status</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderTop: "1px solid #eef1f6" }}>
                  <td style={td}><span style={{ fontWeight: 600 }}>{inv.invoice_no || `#${inv.id}`}</span></td>
                  <td style={td}>{inv.domain || "—"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{money(inv)}</td>
                  <td style={{ ...td, color: "#6b7688", fontSize: 12 }}>
                    {inv.period_start ? `${fmtDate(inv.period_start)} → ${fmtDate(inv.period_end)}` : "—"}
                  </td>
                  <td style={{ ...td, color: "#6b7688" }}>{inv.due_date ? fmtDate(inv.due_date) : "—"}</td>
                  <td style={td}><Badge status={inv.status} /></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {inv.status === "paid"
                      ? <span style={{ color: "#2c6e2c", fontSize: 12, fontWeight: 600 }}>Paid</span>
                      : isUnpaid(inv.status)
                        ? <div style={{ display: "inline-flex", gap: 6 }}>
                            <Btn small tone="lime" onClick={() => pay(inv)} disabled={busyId === inv.id}>
                              {busyId === inv.id ? "Starting…" : "Pay now"}
                            </Btn>
                            {upi && <Btn small onClick={() => setUpiFor(inv)}>Pay by UPI</Btn>}
                          </div>
                        : <span style={{ color: "#9aa3b2", fontSize: 12 }}>{inv.status}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {upiFor && upi && (
        <UpiPayModal invoice={upiFor} upi={upi} onClose={() => setUpiFor(null)}
          onClaimed={() => { setUpiFor(null); setNote("Thanks — we'll confirm your payment shortly and activate your shop."); load(); }} />
      )}
    </div>
  );
}

// Manual UPI payment for a plan invoice: scan/pay to the platform VPA, then send
// the screenshot on WhatsApp. We confirm it by hand (no auto-verification).
function UpiPayModal({ invoice, upi, onClose, onClaimed }) {
  const [qr, setQr] = useState("");
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const invoiceNo = invoice.invoice_no || `#${invoice.id}`;
  const amount = Number(invoice.amount || 0);
  const link = upiLink({ upiId: upi.upi_id, upiName: upi.upi_name, amount, ref: invoiceNo });
  const waUrl = payWhatsAppUrl({ whatsapp: upi.whatsapp, invoiceNo, amount, utr: utr.trim() });

  useEffect(() => { QRCode.toDataURL(link, { width: 420, margin: 2 }).then(setQr).catch(() => setQr("")); }, [link]);

  async function iPaid() {
    setBusy(true);
    try { await api.claimInvoiceUpi(invoice.id, utr.trim() || undefined); } catch { /* non-blocking */ }
    window.open(waUrl, "_blank");
    setBusy(false);
    onClaimed();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,20,30,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: 380, maxWidth: "100%", textAlign: "center", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Pay invoice {invoiceNo}</div>
        <div style={{ fontSize: 12.5, color: "#6b7688", margin: "2px 0 10px" }}>Scan or tap to pay, then send us the screenshot.</div>
        <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>₹{amount.toLocaleString("en-IN")}</div>
        {qr
          ? <img src={qr} alt="Scan to pay" style={{ width: 200, height: 200, border: "1px solid #e6e9f0", borderRadius: 12, padding: 6 }} />
          : <div style={{ color: "#9aa3b2", fontSize: 13, padding: 20 }}>Preparing QR…</div>}
        <div style={{ fontSize: 12, color: "#6b7688", margin: "8px 0 4px" }}>Scan with any UPI app — amount &amp; reference are pre-filled</div>

        <a href={link} style={{ display: "block", background: C.ink, color: "#fff", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 600, textDecoration: "none", margin: "10px 0" }}>📲 Pay in your UPI app</a>

        <div style={{ border: "1px solid #e6e9f0", borderRadius: 10, padding: 11, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#8a93a3", fontWeight: 700 }}>OR PAY TO THIS UPI ID</div>
          <div style={{ fontSize: 15, fontWeight: 700, margin: "3px 0" }}>{upi.upi_id}</div>
          <button type="button" onClick={() => { try { navigator.clipboard.writeText(upi.upi_id); } catch { /* ignore */ } }}
            style={{ background: "none", border: "none", color: "#3b6fd8", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>Copy UPI ID</button>
        </div>

        <Field label="UTR / reference number (optional)">
          <input style={inputStyle} value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12-digit ref from your UPI app" />
        </Field>

        <button type="button" onClick={iPaid} disabled={busy}
          style={{ display: "block", width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginTop: 8, opacity: busy ? 0.7 : 1 }}>
          📲 I've paid — send screenshot on WhatsApp
        </button>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#9aa3b2", fontSize: 12.5, cursor: "pointer", marginTop: 12 }}>Close</button>
      </div>
    </div>
  );
}

const th = { padding: "10px 14px", fontWeight: 600, fontSize: 12 };
const td = { padding: "10px 14px" };
