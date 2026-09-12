// Admin activity logs: catalogue searches/clicks, login attempts, emails sent.
import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead, Card, Spinner, ErrorNote, Empty, fmtDate } from "../ui.jsx";

const TABS = [["search", "Searches & clicks"], ["login", "Login attempts"], ["email", "Emails"]];
const who = (r) => r.user_name || r.user_email || r.user_mobile || r.device_id || "—";

export default function AdminLogs() {
  const [tab, setTab] = useState("search");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRows(null); setError(null);
    api.adminLogs(tab).then((r) => setRows(r.rows || [])).catch(setError);
  }, [tab]);

  return (
    <div>
      <PageHead title="Logs" sub="What people search and click, who tried to log in, and every email sent." />
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: tab === k ? "1px solid #16361b" : "1px solid #d4d9e3", background: tab === k ? "#16361b" : "#fff", color: tab === k ? "#C8FF3D" : "#42505f", padding: "5px 14px", borderRadius: 999, fontSize: 12.5, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      <ErrorNote error={error} />
      {!rows ? <Spinner /> : rows.length === 0 ? <Card><Empty msg="Nothing logged yet." /></Card> : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
              {tab === "search" && <><thead><tr style={hd}><th style={th}>When</th><th style={th}>Who</th><th style={th}>Where</th><th style={th}>Event</th><th style={th}>Details</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.id} style={tr}>
                    <td style={td}>{fmtDate(r.created_at)}</td>
                    <td style={td}>{who(r)}{r.user_mobile ? ` · ${r.user_mobile}` : ""}</td>
                    <td style={td}>{r.scope}</td>
                    <td style={td}>{r.event === "open" ? "opened product" : "searched"}</td>
                    <td style={td}>{r.event === "open" ? `${r.category || ""}:${r.product_id || ""}` : `"${r.q || ""}"${r.results_count != null ? ` (${r.results_count})` : ""}`}</td>
                  </tr>
                ))}</tbody></>}
              {tab === "login" && <><thead><tr style={hd}><th style={th}>When</th><th style={th}>Identifier</th><th style={th}>Account</th><th style={th}>Method</th><th style={th}>Result</th><th style={th}>IP</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.id} style={tr}>
                    <td style={td}>{fmtDate(r.created_at)}</td>
                    <td style={td}>{r.identifier || "—"}</td>
                    <td style={td}>{r.user_name || r.user_email || r.user_mobile || "—"}</td>
                    <td style={td}>{r.method}</td>
                    <td style={{ ...td, color: r.success ? "#2c6e2c" : "#b23a48", fontWeight: 600 }}>{r.success ? "✓ success" : `✗ ${r.reason || "failed"}`}</td>
                    <td style={{ ...td, color: "#9aa3b2" }}>{r.ip || "—"}</td>
                  </tr>
                ))}</tbody></>}
              {tab === "email" && <><thead><tr style={hd}><th style={th}>When</th><th style={th}>To</th><th style={th}>Subject</th><th style={th}>Reason</th><th style={th}>Result</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.id} style={tr}>
                    <td style={td}>{fmtDate(r.created_at)}</td>
                    <td style={td}>{r.to_name ? `${r.to_name} · ` : ""}{r.to_email}{r.to_mobile ? ` · ${r.to_mobile}` : ""}</td>
                    <td style={td}>{r.subject}</td>
                    <td style={{ ...td, color: "#6b7688" }}>{r.reason || "—"}</td>
                    <td style={{ ...td, color: r.success ? "#2c6e2c" : "#b23a48", fontWeight: 600 }}>{r.success ? "✓ sent" : `✗ ${r.error || "failed"}`}</td>
                  </tr>
                ))}</tbody></>}
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

const hd = { background: "#f7f8fb", color: "#6b7688", textAlign: "left" };
const th = { padding: "9px 12px", fontWeight: 600, fontSize: 12 };
const td = { padding: "9px 12px" };
const tr = { borderTop: "1px solid #eef1f6" };
