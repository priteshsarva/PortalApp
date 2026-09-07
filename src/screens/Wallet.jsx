// Vendor wallet: available/held balances, ledger, payout details + terms, and
// request-payout. Money lands here when shipment proof is approved on
// platform-mode orders; you withdraw it once you're over the threshold.
import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Badge, Spinner, ErrorNote, Empty, Field, inputStyle, fmtDate } from "../ui.jsx";

const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const LEDGER_LABEL = { hold: "On hold (pending shipment)", release: "Released to balance", payout: "Paid out", refund: "Refunded", fee: "Fee", adjust: "Adjustment" };

export default function Wallet() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [upi, setUpi] = useState("");

  function load() {
    setError(null);
    api.wallet().then((r) => {
      setData(r);
      setUpi(r.wallet.payout_upi || "");
    }).catch(setError);
  }
  useEffect(load, []);

  async function saveDetails() {
    setBusy(true); setMsg(""); setError(null);
    try { await api.savePayoutDetails({ payout_upi: upi.trim() }); setMsg("Payout details saved."); load(); }
    catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function acceptTerms() {
    setBusy(true); setError(null);
    try { await api.acceptPayoutTerms(); load(); } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function requestPayout() {
    setBusy(true); setMsg(""); setError(null);
    try { await api.requestPayout({ method: "upi" }); setMsg("Payout requested — you'll be notified when it's processed."); load(); }
    catch (e) { setError(e); } finally { setBusy(false); }
  }

  if (error && !data) return <div><PageHead title="Wallet" /><ErrorNote error={error} /></div>;
  if (!data) return <div><PageHead title="Wallet" /><Spinner /></div>;

  const w = data.wallet;
  const pending = data.pending?.[0];
  const canRequest = !pending && Number(w.available) >= Number(w.payout_threshold) && w.terms_accepted_at && (w.payout_upi || upi);

  return (
    <div>
      <PageHead title="Wallet" sub="Your earnings from platform-held orders. Funds are released as shipments are confirmed." />
      <ErrorNote error={error} />
      {msg && <div style={{ background: "#eef7ee", border: "1px solid #cbe5cb", color: "#2c6e2c", padding: "9px 13px", borderRadius: 9, marginBottom: 14, fontSize: 13 }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Card><div style={{ fontSize: 12, color: "#6b7688", fontWeight: 700 }}>AVAILABLE</div><div style={{ fontSize: 30, fontWeight: 800, color: "#14663a" }}>{money(w.available)}</div><div style={{ fontSize: 11.5, color: "#8a93a3" }}>Withdrawable now</div></Card>
        <Card><div style={{ fontSize: 12, color: "#6b7688", fontWeight: 700 }}>ON HOLD</div><div style={{ fontSize: 30, fontWeight: 800, color: "#8a6100" }}>{money(w.held)}</div><div style={{ fontSize: 11.5, color: "#8a93a3" }}>Releases when shipments are confirmed</div></Card>
      </div>

      {/* Payout terms gate */}
      {data.terms_text && !w.terms_accepted_at && (
        <Card style={{ marginBottom: 14, background: "#fff8e6", border: "1px solid #f0d98a" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Payout terms</div>
          <div style={{ fontSize: 13, color: "#42505f", whiteSpace: "pre-wrap", marginBottom: 10 }}>{data.terms_text}</div>
          <Btn tone="lime" onClick={acceptTerms} disabled={busy}>I accept the payout terms</Btn>
        </Card>
      )}

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Payout details</div>
        <Field label="Payout UPI ID"><input style={inputStyle} value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="you@okhdfcbank" /></Field>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <Btn onClick={saveDetails} disabled={busy}>Save details</Btn>
          {w.terms_accepted_at
            ? <Btn tone="lime" onClick={requestPayout} disabled={busy || !canRequest}>Request payout of {money(w.available)}</Btn>
            : <span style={{ fontSize: 12, color: "#8a6100" }}>Accept the payout terms above to withdraw.</span>}
        </div>
        {pending && <div style={{ fontSize: 12.5, color: "#42505f", marginTop: 8 }}>Payout of <strong>{money(pending.amount)}</strong> is <Badge status={pending.status === "processing" ? "active" : "pending"} /> {pending.status}.</div>}
        {!pending && w.terms_accepted_at && Number(w.available) < Number(w.payout_threshold) && (
          <div style={{ fontSize: 12, color: "#8a93a3", marginTop: 8 }}>You can request a payout once your available balance reaches {money(w.payout_threshold)}.</div>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Payout history</div>
        {!data.payouts?.length ? <Empty msg="No payouts yet." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.payouts.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#42505f", borderBottom: "1px solid #f2f4f8", padding: "6px 0" }}>
                <span>{fmtDate(p.created_at)} · {p.method.toUpperCase()}{p.utr ? ` · UTR ${p.utr}` : ""}</span>
                <span><strong>{money(p.amount)}</strong> · {p.status}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Earnings by order</div>
        <div style={{ fontSize: 12, color: "#6b7688", marginBottom: 10 }}>Your share per order — held until the shipment is confirmed, then released to your available balance.</div>
        {!data.by_order?.length ? <Empty msg="No order earnings yet." /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 460 }}>
              <thead><tr style={{ color: "#6b7688", textAlign: "left" }}>
                <th style={{ padding: "6px 8px" }}>Order</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Your share</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Released</th><th style={{ padding: "6px 8px", textAlign: "right" }}>On hold</th>
              </tr></thead>
              <tbody>
                {data.by_order.map((g) => (
                  <tr key={g.order_no} style={{ borderTop: "1px solid #f2f4f8" }}>
                    <td style={{ padding: "7px 8px", fontWeight: 600 }}>{g.order_no} <span style={{ fontWeight: 400, color: "#9aa3b2" }}>· {g.order_status}</span></td>
                    <td style={{ padding: "7px 8px", textAlign: "right" }}>{money(g.held)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: "#14663a" }}>{money(g.released)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: g.outstanding > 0 ? "#8a6100" : "#9aa3b2" }}>{money(g.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Ledger</div>
        {!data.ledger?.length ? <Empty msg="No transactions yet." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.ledger.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#42505f", padding: "5px 0", borderBottom: "1px solid #f7f8fb" }}>
                <span>{fmtDate(l.created_at)} · {LEDGER_LABEL[l.type] || l.type}{l.note ? ` · ${l.note}` : ""}</span>
                <span style={{ color: l.type === "payout" || l.type === "fee" ? "#b23a48" : "#14663a" }}>{money(l.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
