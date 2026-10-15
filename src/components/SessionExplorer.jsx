// Visitor session explorer — recent anonymous sessions and, on click, that
// visitor's full click-by-click timeline (which pages, which buttons, which
// products, how long). Fed fetchers so admin + vendor can reuse it with their
// own endpoints.
import React, { useEffect, useState } from "react";
import { dur, num } from "./AnalyticsView.jsx";

const fmtTime = (t) => { try { return new Date(t).toLocaleString(); } catch { return ""; } };
const fmtClock = (t) => { try { return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return ""; } };

// Turn a raw event row into a human line for the timeline.
function describe(ev) {
  const m = ev.meta || {};
  switch (ev.event) {
    case "page_view": return { icon: "📄", text: `Viewed ${ev.path || "/"}` };
    case "page_leave": return { icon: "⏱", text: `Spent ${dur((Number(m.duration_ms) || 0) / 1000)} on ${ev.path || "/"}`, muted: true };
    case "click": return { icon: "👆", text: `Clicked “${m.label || "?"}”${m.href ? ` → ${m.href}` : ""}` };
    case "impression": return { icon: "👁", text: `Saw ${m.name || `product ${ev.product_id}`}`, muted: true };
    case "view_item": return { icon: "🔍", text: `Opened product ${ev.product_id}` };
    case "add_to_cart": return { icon: "🛒", text: `Added product ${ev.product_id} to cart` };
    case "begin_checkout": return { icon: "💳", text: "Started checkout" };
    case "search": return { icon: "🔎", text: `Searched “${m.q || ""}”` };
    case "purchase": return { icon: "✅", text: "Placed an order" };
    default: return { icon: "•", text: ev.event };
  }
}

export default function SessionExplorer({ siteId, range, fetchSessions, fetchSession }) {
  const [sessions, setSessions] = useState(null);
  const [open, setOpen] = useState(null);       // expanded session_id
  const [timeline, setTimeline] = useState({}); // session_id -> events[]

  useEffect(() => {
    setSessions(null); setOpen(null);
    fetchSessions(siteId, range).then((r) => setSessions(r.sessions || [])).catch(() => setSessions([]));
  }, [siteId, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(sid) {
    if (open === sid) { setOpen(null); return; }
    setOpen(sid);
    if (!timeline[sid]) {
      try { const r = await fetchSession(siteId, sid); setTimeline((t) => ({ ...t, [sid]: r.events || [] })); } catch { /* ignore */ }
    }
  }

  if (!sessions) return <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>Loading sessions…</div>;
  if (!sessions.length) return <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>No visitor sessions in this range.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sessions.map((s) => (
        <div key={s.session_id} style={{ border: "1px solid #eef1f6", borderRadius: 10, background: "#fff" }}>
          <button onClick={() => toggle(s.session_id)}
            style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, alignItems: "center", textAlign: "left", border: "none", background: "none", padding: "10px 12px", cursor: "pointer" }}>
            <span style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 600 }}>{s.entry_path || "visit"}</span>
              <span style={{ color: "#9aa3b2" }}> · {fmtTime(s.started_at)}</span>
            </span>
            <span style={{ fontSize: 12, color: "#6b7688" }}>{num(s.pageviews)} pages</span>
            <span style={{ fontSize: 12, color: "#6b7688" }}>{dur(s.duration_sec)}</span>
            <span style={{ fontSize: 12, color: s.converted ? "#14663a" : "#9aa3b2", fontWeight: s.converted ? 700 : 400 }}>
              {s.converted ? "✓ bought" : `${num(s.clicks)} clicks`}
            </span>
          </button>
          {open === s.session_id && (
            <div style={{ borderTop: "1px solid #eef1f6", padding: "8px 14px 12px" }}>
              {!timeline[s.session_id]
                ? <div style={{ fontSize: 12, color: "#9aa3b2", padding: "4px 0" }}>Loading…</div>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {timeline[s.session_id].map((ev, i) => {
                      const d = describe(ev);
                      return (
                        <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: d.muted ? "#9aa3b2" : "#42505f", padding: "2px 0" }}>
                          <span style={{ width: 58, color: "#b0b7c3", flexShrink: 0 }}>{fmtClock(ev.created_at)}</span>
                          <span style={{ flexShrink: 0 }}>{d.icon}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{d.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
