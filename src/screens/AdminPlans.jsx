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
                  </div>
                  <div style={{ fontSize: 13.5, color: "#1b2230", marginTop: 4 }}>
                    <strong>{money(p.price, p.currency)}</strong>
                    <span style={{ color: "#6b7688" }}> / {p.interval_count > 1 ? `${p.interval_count} ` : ""}{p.interval}{p.interval_count > 1 ? "s" : ""}</span>
                  </div>
                  {p.description && <div style={{ fontSize: 12.5, color: "#6b7688", marginTop: 4, maxWidth: 520 }}>{p.description}</div>}
                </div>
                <Btn tone={p.active ? "ghost" : "lime"} small disabled={busyId === p.id} onClick={() => toggleActive(p)}>
                  {busyId === p.id ? "…" : p.active ? "Pause" : "Resume"}
                </Btn>
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
  const [f, setF] = useState({ name: "", price: "", currency: "INR", interval: "month", interval_count: 1, description: "", sort_order: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.name.trim() || f.price === "" || isNaN(Number(f.price))) { setError(new Error("Name and a numeric price are required")); return; }
    setBusy(true); setError(null);
    try {
      await api.adminCreatePlan({ ...f, price: Number(f.price), interval_count: Number(f.interval_count) || 1, sort_order: Number(f.sort_order) || 0 });
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
        <Field label="Description (optional)"><input style={inputStyle} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="What's included" /></Field>
        <Field label="Sort order"><input style={inputStyle} value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} inputMode="numeric" /></Field>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn tone="lime" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create plan"}</Btn>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}
