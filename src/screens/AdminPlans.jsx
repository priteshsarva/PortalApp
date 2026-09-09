// Admin: create plans and pause/resume them. Pausing a plan only hides it from
// the client signup picker (listPlans activeOnly) — enrollments already on a
// paused plan keep it untouched until their own expiry_date. So "pause" never
// interrupts a paying customer; it just stops NEW sign-ups on that tier.
import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../api.js";
import { C, PageHead, Card, Btn, Badge, Field, inputStyle, Spinner, ErrorNote, Empty } from "../ui.jsx";

const INTERVALS = ["day", "week", "month", "year"];
const money = (p, cur) => (cur === "INR" ? "₹" : cur + " ") + (Number(p) || 0).toLocaleString("en-IN");

export default function AdminPlans() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [showNew, setShowNew] = useState(false);

  function load() {
    setError(null);
    api.adminPlans().then((r) => setPlans(r.plans || [])).catch(setError);
  }
  useEffect(load, []);

  async function toggleActive(p) {
    setBusyId(p.id);
    try { await api.adminUpdatePlan(p.id, { active: !p.active }); load(); }
    catch (e) { setError(e); }
    finally { setBusyId(null); }
  }
  async function toggleSearch(p) {
    setBusyId(p.id);
    try { await api.adminUpdatePlan(p.id, { show_on_search: !p.show_on_search }); load(); }
    catch (e) { setError(e); }
    finally { setBusyId(null); }
  }
  async function remove(p) {
    if (!window.confirm(`Delete plan "${p.name}"? This can't be undone.`)) return;
    setBusyId(p.id);
    try { await api.adminDeletePlan(p.id); load(); }
    catch (e) { setError(e); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <PageHead
        title="Plans"
        sub="Create pricing tiers and pause the ones you no longer sell. Pausing hides a plan from new sign-ups — anyone already on it keeps it until their expiry."
      />
      <div style={{ marginBottom: 16 }}>
        <Btn tone="lime" onClick={() => setShowNew(true)}><Plus size={15} style={{ marginRight: 4, verticalAlign: "-2px" }} />New plan</Btn>
      </div>

      <ErrorNote error={error} />
      {!plans ? <Spinner msg="Loading plans…" /> : plans.length === 0 ? (
        <Empty title="No plans yet" note="Create your first pricing tier." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plans.map((p) => (
            <Card key={p.id} style={p.active ? undefined : { opacity: 0.7 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                    <Badge status={p.active ? "active" : "paused"} />
                    {p.kind && p.kind !== "retail" && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#eef4ff", color: "#2b5bb5" }}>{p.kind}</span>}
                    {p.show_on_search && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#eef7d6", color: "#4a5a00" }}>search landing · {p.limits?.search_views ? `${p.limits.search_views} views` : "unlimited"}</span>}
                  </div>
                  <div style={{ fontSize: 13.5, color: "#1b2230", marginTop: 4 }}>
                    <strong>{money(p.price, p.currency)}</strong>
                    <span style={{ color: "#6b7688" }}> / {p.interval_count > 1 ? `${p.interval_count} ` : ""}{p.interval}{p.interval_count > 1 ? "s" : ""}</span>
                  </div>
                  {p.description && <div style={{ fontSize: 12.5, color: "#6b7688", marginTop: 4, maxWidth: 520 }}>{p.description}</div>}
                  {Array.isArray(p.features) && p.features.length > 0 && (
                    <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                      {p.features.map((ft, i) => <li key={i} style={{ fontSize: 12.5, color: "#42505f" }}>✓ {ft}</li>)}
                    </ul>
                  )}
                  {p.limits && (p.limits.max_products || p.limits.allow_payout_routing) && (
                    <div style={{ fontSize: 11.5, color: "#8a93a3", marginTop: 6 }}>
                      {p.limits.max_products ? `Up to ${p.limits.max_products} products` : ""}
                      {p.limits.max_products && p.limits.allow_payout_routing ? " · " : ""}
                      {p.limits.allow_payout_routing ? "Wallet payouts" : ""}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <Btn small tone={p.show_on_search ? "lime" : "ghost"} disabled={busyId === p.id} onClick={() => toggleSearch(p)}>
                    {p.show_on_search ? "On search page ✓" : "Show on search page"}
                  </Btn>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn tone={p.active ? "ghost" : "lime"} small disabled={busyId === p.id} onClick={() => toggleActive(p)}>
                      {busyId === p.id ? "…" : p.active ? "Pause" : "Resume"}
                    </Btn>
                    <Btn tone="ghost" small disabled={busyId === p.id} onClick={() => remove(p)}>Delete</Btn>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showNew && <NewPlanModal onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewPlanModal({ onClose, onDone }) {
  const [f, setF] = useState({ name: "", price: "", currency: "INR", interval: "month", interval_count: 1, description: "", sort_order: 0,
    kind: "retail", features: "", max_products: "", max_images: "", allow_payout_routing: false, show_on_search: false, search_views: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.name.trim() || f.price === "" || isNaN(Number(f.price))) { setError(new Error("Name and a numeric price are required")); return; }
    setBusy(true); setError(null);
    try {
      const limits = {};
      if (f.max_products !== "") limits.max_products = Number(f.max_products) || 0;
      if (f.max_images !== "") limits.max_images = Number(f.max_images) || 0;
      if (f.allow_payout_routing) limits.allow_payout_routing = true;
      if (f.search_views !== "") limits.search_views = Number(f.search_views) || 0;
      await api.adminCreatePlan({
        name: f.name, price: Number(f.price), currency: f.currency, interval: f.interval,
        interval_count: Number(f.interval_count) || 1, description: f.description,
        sort_order: Number(f.sort_order) || 0, kind: f.kind, show_on_search: f.show_on_search,
        features: f.features.split("\n").map((s) => s.trim()).filter(Boolean),
        limits,
      });
      onDone();
    } catch (e) { setError(e); setBusy(false); }
  }

  // lightweight modal (matches the app's overlay pattern without importing Modal
  // in case its API differs — this is self-contained)
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,15,25,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: "min(460px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 14 }}>New plan</div>
        <ErrorNote error={error} />
        <Field label="Name"><input style={inputStyle} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Starter" autoFocus /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Price"><input style={inputStyle} value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="499" inputMode="decimal" /></Field>
          <Field label="Currency"><input style={inputStyle} value={f.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Billing interval">
            <select style={inputStyle} value={f.interval} onChange={(e) => set("interval", e.target.value)}>
              {INTERVALS.map((iv) => <option key={iv} value={iv}>{iv}</option>)}
            </select>
          </Field>
          <Field label="Every N intervals"><input style={inputStyle} value={f.interval_count} onChange={(e) => set("interval_count", e.target.value)} inputMode="numeric" /></Field>
        </div>
        <Field label="Plan type">
          <select style={inputStyle} value={f.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="retail">Retail (storefront / plugin)</option>
            <option value="wholesale">Wholesale (supplier listings)</option>
            <option value="both">Both</option>
          </select>
        </Field>
        <Field label="Description">
          <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} value={f.description}
            onChange={(e) => set("description", e.target.value)} placeholder="Shown under the plan name on the user's plans page." />
        </Field>
        <Field label="Features (one per line — shown as ✓ bullets on the plan card)">
          <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} value={f.features}
            onChange={(e) => set("features", e.target.value)} placeholder={"List up to 100 products\nInventory management\nSales dashboard"} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Max products (blank = unlimited)"><input style={inputStyle} value={f.max_products} onChange={(e) => set("max_products", e.target.value)} inputMode="numeric" placeholder="e.g. 100" /></Field>
          <Field label="Max images / product"><input style={inputStyle} value={f.max_images} onChange={(e) => set("max_images", e.target.value)} inputMode="numeric" placeholder="e.g. 5" /></Field>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#42505f", margin: "2px 0 6px", cursor: "pointer" }}>
          <input type="checkbox" checked={f.allow_payout_routing} onChange={(e) => set("allow_payout_routing", e.target.checked)} />
          Allow platform-held payments &amp; wallet payouts (per-vendor payment routing)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#42505f", margin: "2px 0 6px", cursor: "pointer" }}>
          <input type="checkbox" checked={f.show_on_search} onChange={(e) => set("show_on_search", e.target.checked)} />
          Show this plan on the public catalogue-search landing page
        </label>
        {f.show_on_search && (
          <Field label="Product views this plan grants (blank / 0 = unlimited)">
            <input style={inputStyle} value={f.search_views} onChange={(e) => set("search_views", e.target.value)} inputMode="numeric" placeholder="e.g. 500 — or leave blank for unlimited" />
          </Field>
        )}
        <Field label="Sort order"><input style={inputStyle} value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} inputMode="numeric" /></Field>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn tone="lime" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create plan"}</Btn>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}
