// Admin: wholesaler approvals + verification, and the shared product taxonomy
// (approve proposed sub-categories so there are no duplicates across suppliers).
import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Badge, Spinner, ErrorNote, Empty, Field, inputStyle, fmtDate } from "../ui.jsx";

export default function AdminWholesalers() {
  const [tab, setTab] = useState("wholesalers");
  return (
    <div>
      <PageHead title="Wholesale" sub="Approve suppliers, verify them, and manage the shared category list." />
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["wholesalers", "Suppliers"], ["taxonomy", "Categories"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: tab === k ? "1px solid #16361b" : "1px solid #d4d9e3", background: tab === k ? "#16361b" : "#fff", color: tab === k ? "#C8FF3D" : "#42505f", padding: "5px 14px", borderRadius: 999, fontSize: 12.5, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {tab === "wholesalers" ? <Suppliers /> : <Taxonomy />}
    </div>
  );
}

function Suppliers() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  function load() { setError(null); api.adminWholesalers().then((r) => setRows(r.wholesalers || [])).catch(setError); }
  useEffect(load, []);

  async function act(w, fn) {
    setBusy(w.enrollment_id);
    try { await fn(); load(); } catch (e) { alert(e.message); } finally { setBusy(null); }
  }

  if (!rows) return <Card><Spinner /></Card>;
  if (error) return <Card><ErrorNote error={error} /></Card>;
  if (!rows.length) return <Card><Empty msg="No wholesaler applications yet." /></Card>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((w) => (
        <Card key={w.enrollment_id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{w.business_name}</span>
                <Badge status={w.enrollment_status} />
                {w.verified && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#e8f7ee", color: "#14663a" }}>Verified</span>}
              </div>
              <div style={{ fontSize: 12.5, color: "#6b7688", marginTop: 3 }}>{w.user_email} · {w.phone || "no phone"} · {(w.categories || []).join(", ") || "no categories"}</div>
              {w.about && <div style={{ fontSize: 12.5, color: "#42505f", marginTop: 4, maxWidth: 560 }}>{w.about}</div>}
              <div style={{ fontSize: 11.5, color: "#9aa3b2", marginTop: 4 }}>Applied {fmtDate(w.created_at)}{w.gst_number ? ` · GST ${w.gst_number}` : ""}{w.ships_from ? ` · ships from ${w.ships_from}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              {w.enrollment_status === "pending" && (
                <>
                  <Btn small tone="lime" disabled={busy === w.enrollment_id} onClick={() => act(w, () => api.adminApproveWholesaler(w.enrollment_id))}>Approve</Btn>
                  <Btn small tone="ghost" disabled={busy === w.enrollment_id} onClick={() => { const r = prompt("Reason (optional):") ?? ""; act(w, () => api.adminRejectWholesaler(w.enrollment_id, r)); }}>Reject</Btn>
                </>
              )}
              {w.enrollment_status === "active" && (
                <>
                  <Btn small tone={w.verified ? "ghost" : "lime"} disabled={busy === w.enrollment_id} onClick={() => act(w, () => api.adminPatchWholesaler(w.enrollment_id, { verified: !w.verified }))}>
                    {w.verified ? "Unverify" : "Verify"}
                  </Btn>
                  <Btn small tone="ghost" disabled={busy === w.enrollment_id} onClick={() => act(w, () => api.adminPatchWholesaler(w.enrollment_id, { source_status: "paused" }))}>Pause source</Btn>
                  <Btn small tone="ghost" disabled={busy === w.enrollment_id} onClick={() => act(w, () => api.adminPatchWholesaler(w.enrollment_id, { source_status: "active" }))}>Resume</Btn>
                </>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Taxonomy() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [nf, setNf] = useState({ primary_cat: "shoes", sub_label: "" });

  function load() { setError(null); api.adminTaxonomy().then((r) => setRows(r.taxonomy || [])).catch(setError); }
  useEffect(load, []);

  async function add() {
    if (!nf.primary_cat.trim() || !nf.sub_label.trim()) return;
    try { await api.adminCreateTaxonomy(nf); setNf({ ...nf, sub_label: "" }); load(); } catch (e) { alert(e.message); }
  }
  async function patch(id, body) { try { await api.adminPatchTaxonomy(id, body); load(); } catch (e) { alert(e.message); } }
  async function del(id) { if (!confirm("Delete this sub-category?")) return; try { await api.adminDeleteTaxonomy(id); load(); } catch (e) { alert(e.message); } }

  if (!rows) return <Card><Spinner /></Card>;
  const byPrimary = {};
  for (const r of rows) (byPrimary[r.primary_cat] = byPrimary[r.primary_cat] || []).push(r);

  return (
    <div>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Add a sub-category</div>
        <ErrorNote error={error} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <Field label="Primary category"><input style={inputStyle} value={nf.primary_cat} onChange={(e) => setNf({ ...nf, primary_cat: e.target.value.toLowerCase() })} placeholder="shoes" /></Field>
          <Field label="Sub-category label"><input style={inputStyle} value={nf.sub_label} onChange={(e) => setNf({ ...nf, sub_label: e.target.value })} placeholder="Running" /></Field>
          <Btn tone="lime" onClick={add}>Add</Btn>
        </div>
      </Card>

      {Object.keys(byPrimary).sort().map((pc) => (
        <Card key={pc} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, textTransform: "capitalize" }}>{pc}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {byPrimary[pc].map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #e6e9f0", borderRadius: 999, padding: "4px 10px", fontSize: 12.5, background: t.status === "proposed" ? "#fff8e6" : "#fff" }}>
                <span>{t.sub_label}</span>
                {t.status === "proposed" && <>
                  <span style={{ color: "#8a6100", fontSize: 11 }}>(proposed{t.proposed_email ? ` by ${t.proposed_email}` : ""})</span>
                  <button onClick={() => patch(t.id, { status: "active" })} title="Approve" style={{ border: "none", background: "none", color: "#14663a", cursor: "pointer", fontWeight: 700 }}>✓</button>
                </>}
                <button onClick={() => del(t.id)} title="Delete" style={{ border: "none", background: "none", color: "#b23a48", cursor: "pointer" }}>×</button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
