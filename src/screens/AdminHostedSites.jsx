import React, { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Badge, Spinner, ErrorNote, Empty, fmtDate, storeUrl } from "../ui.jsx";

export default function AdminHostedSites() {
  const [sites, setSites] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // id currently acting on

  function load() {
    api.adminHostedSites().then((r) => setSites(r.sites || [])).catch(setError);
    api.adminPlans().then((r) => setPlans((r.plans || []).filter((p) => p.active))).catch(() => {});
  }
  useEffect(load, []);

  async function act(id, fn, ...args) {
    setBusy(id);
    try { await fn(...args); load(); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  }

  async function remove(id, name) {
    if (!confirm(`Permanently delete "${name}"? This removes its branding, orders and customers too.`)) return;
    act(id, api.adminDeleteHostedSite, id);
  }

  return (
    <div>
      <PageHead title="Storefronts" sub="Every hosted, multi-tenant storefront across all vendors." />
      <ErrorNote error={error} />
      {!sites ? <Spinner /> : sites.length === 0 ? <Card><Empty msg="No storefronts yet." /></Card> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sites.map((s) => (
            <Card key={s.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {s.logo_url
                    ? <img src={s.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                    : <div style={{ width: 36, height: 36, borderRadius: 8, background: "#eef1f6" }} />}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.store_name || s.slug}</div>
                    <div style={{ fontSize: 12, color: "#6b7688", marginTop: 2 }}>{s.owner_email}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Badge status={s.status} />
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}>
                    {s.order_count} order{s.order_count === "1" ? "" : "s"} · {s.status === "active" ? `expires ${fmtDate(s.expiry_date)}` : fmtDate(s.created_at)}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <a href={storeUrl(s.slug)} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#3b6fd8", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                  {s.slug} <ExternalLink size={12} />
                </a>
                {s.custom_domain && (
                  <div style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                    <a href={`https://${s.custom_domain}`} target="_blank" rel="noreferrer" style={{ color: "#3b6fd8" }}>{s.custom_domain}</a>
                    {s.custom_domain_verified_at
                      ? <span style={{ background: "#e6f5eb", color: "#2e7d32", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>✓ verified</span>
                      : <span style={{ background: "#fff4e6", color: "#8a6d2f", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>unverified</span>}
                  </div>
                )}
              </div>

              <FeesRow site={s} plans={plans} />

              <div style={{ marginTop: 12, display: "flex", gap: 7, flexWrap: "wrap" }}>
                {s.status === "pending" && (
                  <>
                    <Btn small tone="lime" disabled={busy === s.id} onClick={() => act(s.id, api.adminApproveEnrollment, s.id)}>Approve</Btn>
                    <Btn small tone="danger" disabled={busy === s.id} onClick={() => act(s.id, api.adminRejectEnrollment, s.id)}>Reject</Btn>
                  </>
                )}
                {s.status === "approved" && (
                  <Btn small tone="lime" disabled={busy === s.id} onClick={() => act(s.id, api.adminActivateEnrollment, s.id)}>Activate</Btn>
                )}
                {s.status === "active" && (
                  <Btn small tone="ghost" disabled={busy === s.id} onClick={() => act(s.id, api.adminUpdateHostedSite, s.id, { status: "paused" })}>Pause</Btn>
                )}
                {s.status === "paused" && (
                  <Btn small tone="lime" disabled={busy === s.id} onClick={() => act(s.id, api.adminUpdateHostedSite, s.id, { status: "active" })}>Resume</Btn>
                )}
                {s.custom_domain && !s.custom_domain_verified_at && (
                  <Btn small tone="ghost" disabled={busy === s.id} onClick={async () => {
                    setBusy(s.id);
                    try { const r = await api.adminVerifyCustomDomain(s.id); alert("Verified: " + (r.note || "OK")); load(); }
                    catch (e) { alert("Verify failed: " + e.message); }
                    finally { setBusy(null); }
                  }}>Verify domain</Btn>
                )}
                <Btn small tone="danger" disabled={busy === s.id} onClick={() => remove(s.id, s.store_name || s.slug)}>Delete</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Per-store fee + payment-routing override (admin). Gateway fee blank = platform default.
function FeesRow({ site, plans = [] }) {
  const [fee, setFee] = React.useState(site.gateway_fee_pct ?? "");
  const [pm, setPm] = React.useState(site.payout_mode || "direct");
  const [plan, setPlan] = React.useState(site.plan_id || "");
  const [msg, setMsg] = React.useState("");
  const [planMsg, setPlanMsg] = React.useState("");
  async function save() {
    setMsg("saving…");
    try { await api.adminSetSiteFees(site.id, { gateway_fee_pct: fee === "" ? null : Number(fee), payout_mode: pm }); setMsg("✓ saved"); setTimeout(() => setMsg(""), 1500); }
    catch (e) { setMsg(e.message); }
  }
  async function savePlan(next) {
    setPlan(next); if (!next) return;
    setPlanMsg("saving…");
    try { await api.adminSetShopPlan(site.id, next); setPlanMsg("✓ saved"); setTimeout(() => setPlanMsg(""), 1500); }
    catch (e) { setPlanMsg(e.message); }
  }
  return (
    <>
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#6b7688", background: "#f8f9fc", borderRadius: 8, padding: "8px 10px" }}>
      <span>Plan</span>
      <select value={plan} onChange={(e) => savePlan(e.target.value)}
        style={{ border: "1px solid #d4d9e3", borderRadius: 6, padding: "4px 7px", fontSize: 12, maxWidth: 220 }}>
        <option value="">{site.plan_name ? site.plan_name : "— none —"}</option>
        {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · ₹{p.price}</option>)}
      </select>
      {planMsg && <span style={{ color: planMsg.startsWith("✓") ? "#2c6e2c" : "#b23a48" }}>{planMsg}</span>}
    </div>
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#6b7688", background: "#f8f9fc", borderRadius: 8, padding: "8px 10px" }}>
      <span>Gateway fee %</span>
      <input value={fee} onChange={(e) => setFee(e.target.value)} placeholder="default" inputMode="decimal"
        style={{ width: 70, border: "1px solid #d4d9e3", borderRadius: 6, padding: "4px 7px", fontSize: 12 }} />
      <span>Payout</span>
      <select value={pm} onChange={(e) => setPm(e.target.value)} disabled={site.has_wholesale}
        style={{ border: "1px solid #d4d9e3", borderRadius: 6, padding: "4px 7px", fontSize: 12 }}>
        <option value="direct">Direct</option>
        <option value="platform">Platform</option>
      </select>
      {site.has_wholesale && <span style={{ color: "#8a6100" }}>(wholesale → forced platform)</span>}
      <button onClick={save} style={{ border: "1px solid #16361b", background: "#16361b", color: "#C8FF3D", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>Save</button>
      {msg && <span style={{ color: msg.startsWith("✓") ? "#2c6e2c" : "#b23a48" }}>{msg}</span>}
    </div>
    </>
  );
}
