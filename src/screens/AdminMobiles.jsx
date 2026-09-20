// Admin view of every mobile number captured across user data, split into
// REGISTERED (completed account — profile + email) and UNREGISTERED (mobile
// verified via OTP but the account was never finished). Search + CSV export.
import React, { useEffect, useMemo, useState } from "react";
import { Search, Phone, Download } from "lucide-react";
import { api } from "../api.js";
import { PageHead, Card, Badge, Spinner, ErrorNote, Empty, inputStyle, fmtDate } from "../ui.jsx";

export default function AdminMobiles() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("registered"); // registered | unregistered
  const [q, setQ] = useState("");

  useEffect(() => { api.adminMobiles().then(setData).catch(setError); }, []);

  const list = data ? (tab === "registered" ? data.registered : data.unregistered) : [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((r) =>
      (r.mobile || "").toLowerCase().includes(s) ||
      (r.name || "").toLowerCase().includes(s) ||
      (r.email || "").toLowerCase().includes(s));
  }, [list, q]);

  function exportCsv() {
    const cols = tab === "registered"
      ? ["mobile", "name", "email", "plan", "status", "created_at"]
      : ["mobile", "mobile_verified", "created_at"];
    const head = cols.join(",");
    const body = filtered.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([head + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mobiles-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (error) return (<div><PageHead title="Mobile numbers" /><ErrorNote error={error} /></div>);
  if (!data) return (<div><PageHead title="Mobile numbers" /><Spinner /></div>);

  const TABS = [
    ["registered", "Registered", data.counts.registered],
    ["unregistered", "Verified · no account", data.counts.unregistered],
  ];

  return (
    <div>
      <PageHead title="Mobile numbers" sub={`${data.counts.total} numbers captured · ${data.counts.registered} registered · ${data.counts.unregistered} verified but incomplete`} />

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {TABS.map(([k, label, n]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: tab === k ? 700 : 500,
              background: tab === k ? "#1b2230" : "#eef1f6", color: tab === k ? "#fff" : "#42505f" }}>
            {label} <span style={{ opacity: 0.7 }}>· {n}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative", maxWidth: 280, flex: "1 1 200px" }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: 10, color: "#9aa3b2" }} />
          <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Search number, name, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button onClick={exportCsv} disabled={!filtered.length}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #d4d9e3", background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: filtered.length ? "pointer" : "default", opacity: filtered.length ? 1 : 0.5 }}>
          <Download size={14} /> CSV
        </button>
      </div>

      {tab === "unregistered" && (
        <div style={{ fontSize: 12.5, color: "#8a6d2f", background: "#fff7e6", border: "1px solid #f0d9a8", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          These numbers verified an OTP but never finished creating an account (no name/email yet).
        </div>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f7f8fb", color: "#6b7688", textAlign: "left" }}>
              <th style={th}>Mobile</th>
              {tab === "registered" ? <><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Plan</th><th style={th}>Status</th></> : <th style={th}>Verified</th>}
              <th style={th}>Added</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #eef1f6" }}>
                <td style={{ ...td, fontWeight: 600 }}><Phone size={12} style={{ verticalAlign: "-1px", color: "#9aa3b2", marginRight: 6 }} />{r.mobile}</td>
                {tab === "registered" ? (
                  <>
                    <td style={td}>{r.name || <span style={{ color: "#c4ccd8" }}>—</span>}</td>
                    <td style={td}>{r.email || <span style={{ color: "#c4ccd8" }}>—</span>}</td>
                    <td style={td}>{r.plan || <span style={{ color: "#c4ccd8" }}>—</span>}</td>
                    <td style={td}><Badge status={r.status} /></td>
                  </>
                ) : (
                  <td style={td}>{r.mobile_verified ? <span style={{ color: "#2e7d32" }}>✓ verified</span> : <span style={{ color: "#c4ccd8" }}>—</span>}</td>
                )}
                <td style={{ ...td, color: "#6b7688" }}>{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty msg={q ? "No numbers match your search." : "No numbers here yet."} />}
      </Card>
    </div>
  );
}

const th = { padding: "10px 14px", fontWeight: 600, fontSize: 12 };
const td = { padding: "10px 14px" };
