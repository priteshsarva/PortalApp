import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { api } from "../api.js";
import { C, PageHead, Spinner, ErrorNote } from "../ui.jsx";

// Client-facing pricing: the same plans the admin manages in the portal (and that the
// landing page shows), described in full. Read-only — plan changes/payment live in Billing.
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const per = (p) => Number(p.price) <= 0 ? "" : `/ ${p.interval_count > 1 ? p.interval_count + " " : ""}${p.interval}${p.interval_count > 1 ? "s" : ""}`;
const friendlyLimits = (L = {}) => [
  L.max_products && `Up to ${L.max_products} products`,
  L.max_images && `${L.max_images} images per product`,
  L.allow_payout_routing && "Use your own payment gateway",
].filter(Boolean);

export default function Pricing() {
  const [plans, setPlans] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.publicPlans()
      .then((r) => {
        const all = (r.plans || []).filter((p) => p.active !== false);
        const store = all.filter((p) => !p.show_on_search);   // storefront plans, not the search-only plan
        setPlans(store.length ? store : all);
      })
      .catch(setErr);
  }, []);

  const topPrice = plans && plans.length
    ? Math.max(...plans.map((p) => Number(p.discount_price ?? p.price) || 0), 0) : 0;

  return (
    <div>
      <PageHead title="Pricing" sub="Plans for your store — everything each one includes. Upgrade any time from Billing." />
      <ErrorNote error={err} />
      {plans === null ? <Spinner /> :
        plans.length === 0 ? <p style={{ color: "#6b7688" }}>No plans available yet.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {plans.map((p) => {
              const free = Number(p.price) <= 0;
              const hasDisc = p.discount_price != null && p.discount_price !== "";
              const popular = topPrice > 0 && (Number(p.discount_price ?? p.price) || 0) === topPrice;
              const feats = [...(Array.isArray(p.features) ? p.features : []), ...friendlyLimits(p.limits)];
              return (
                <div key={p.id} style={{
                  background: "#fff", borderRadius: 16, padding: 22, display: "flex", flexDirection: "column",
                  border: `1px solid ${popular ? C.lime : "#e6e9f0"}`, boxShadow: popular ? `0 0 0 1px ${C.lime}` : "none",
                }}>
                  {popular && <span style={{ alignSelf: "flex-start", fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink, background: C.lime, borderRadius: 999, padding: "3px 10px", marginBottom: 10 }}>Most popular</span>}
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", color: "#6b7688" }}>{p.name}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8, color: "#1b2230" }}>
                    {free ? "₹0" : hasDisc
                      ? <>{inr(p.discount_price)} <span style={{ textDecoration: "line-through", color: "#9aa3b2", fontWeight: 500, fontSize: 16 }}>{inr(p.price)}</span></>
                      : inr(p.price)}
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#6b7688" }}> {per(p)}</span>
                  </div>
                  {p.description && <p style={{ marginTop: 10, color: "#6b7688", fontSize: 14, lineHeight: 1.5 }}>{p.description}</p>}
                  {feats.length > 0 && (
                    <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gap: 9 }}>
                      {feats.map((f, i) => (
                        <li key={i} style={{ display: "flex", gap: 9, fontSize: 13.5, color: "#1b2230", lineHeight: 1.4 }}>
                          <Check size={16} color={C.lime} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      <p style={{ marginTop: 18, color: "#8a93a3", fontSize: 12.5 }}>
        To choose or change your plan, go to Billing. Prices are set by Kartify.
      </p>
    </div>
  );
}
