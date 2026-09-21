// Admin: WhatsApp support bot — connection status/QR, FAQ answers, questions sent to the owner.
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../api.js";
import { PageHead, Card, Btn, Field, Modal, Spinner, ErrorNote, Empty, inputStyle, fmtDate } from "../ui.jsx";

const TABS = [["faqs", "Saved answers"], ["pending", "Waiting for you"], ["answered", "Answered"], ["skipped", "Skipped"]];
const LANGS = [["hinglish", "Hinglish"], ["en", "English"], ["hi", "हिंदी"]];
const STATE_TEXT = { connected: "🟢 Connected", qr: "🟡 Waiting for QR scan", reconnecting: "🟡 Reconnecting…", logged_out: "🔴 Logged out — scan the new QR", unknown: "⚪ Bot hasn't reported yet" };

function BotStatus() {
  const [st, setSt] = useState(null);
  const [qr, setQr] = useState("");
  useEffect(() => {
    const load = () => api.adminWaStatus().then(setSt).catch(() => {});
    load();
    const t = setInterval(load, 5000); // QR codes rotate every ~20s
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (st?.qr) QRCode.toDataURL(st.qr, { width: 260, margin: 1 }).then(setQr).catch(() => setQr(""));
    else setQr("");
  }, [st?.qr]);
  if (!st) return null;
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700 }}>{STATE_TEXT[st.state] || st.state}</div>
      {st.at && <div style={{ fontSize: 12, color: "#9aa3b2" }}>updated {fmtDate(st.at)}</div>}
      {qr && (
        <div style={{ marginTop: 12 }}>
          <img src={qr} alt="WhatsApp link QR" width={260} height={260} />
          <p style={{ fontSize: 13, color: "#6b7688" }}>On the <b>bot phone</b>: WhatsApp → Linked devices → Link a device → scan.</p>
        </div>
      )}
    </Card>
  );
}

function FaqModal({ faq, onClose, onSaved }) {
  const [f, setF] = useState({
    phrases: (faq?.phrases || []).join("\n"),
    answer_hinglish: faq?.answer_hinglish || "", answer_en: faq?.answer_en || "", answer_hi: faq?.answer_hi || "",
  });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api.adminWaSaveFaq(faq?.id, { ...f, phrases: f.phrases.split("\n") });
      onSaved();
    } catch (e) { setErr(e); setBusy(false); }
  };
  return (
    <Modal title={faq ? `Edit answer #${faq.id}` : "New answer"} onClose={onClose}>
      <ErrorNote error={err} />
      <Field label="Questions that should get this answer — one per line, any language/spelling">
        <textarea rows={4} style={inputStyle} value={f.phrases} onChange={(e) => setF({ ...f, phrases: e.target.value })}
          placeholder={"order cancel kaise kare\nhow to cancel order\nऑर्डर कैंसिल कैसे करें"} />
      </Field>
      {LANGS.map(([l, label]) => (
        <Field key={l} label={`Answer — ${label}`}>
          <textarea rows={3} style={inputStyle} value={f[`answer_${l}`]} onChange={(e) => setF({ ...f, [`answer_${l}`]: e.target.value })} />
        </Field>
      ))}
      <p style={{ fontSize: 12, color: "#9aa3b2", marginTop: -4 }}>Empty languages fall back to one that's filled in.</p>
      <Btn onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn>
    </Modal>
  );
}

function TestMatch() {
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  const run = () => text.trim() && api.adminWaTestMatch(text).then(setRes).catch((e) => setRes({ error: e.message }));
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={inputStyle} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Test: type a question the way a client would…" />
        <Btn tone="ghost" onClick={run}>Test</Btn>
      </div>
      {res && <div style={{ fontSize: 13, marginTop: 8, color: "#55606f" }}>
        {res.error ? res.error : res.faq_id ? `→ answer #${res.faq_id} (score ${res.score.toFixed(2)})` : "→ no match, would be sent to you"}
      </div>}
    </Card>
  );
}

export default function AdminWhatsApp() {
  const [tab, setTab] = useState("faqs");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // faq object, {} for new
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setRows(null); setError(null);
    (tab === "faqs" ? api.adminWaFaqs().then((r) => r.faqs) : api.adminWaQuestions(tab).then((r) => r.questions))
      .then(setRows).catch(setError);
  }, [tab, tick]);

  const del = async (id) => {
    if (!confirm(`Delete answer #${id}?`)) return;
    await api.adminWaDeleteFaq(id).catch(setError);
    setTick((x) => x + 1);
  };

  return (
    <div>
      <PageHead title="WhatsApp bot" sub="Answers the bot gives by itself, and questions it passed to you. Answer new ones from your phone by quote-replying the bot's message."
        action={tab === "faqs" && <Btn onClick={() => setEditing({})}>+ New answer</Btn>} />
      <BotStatus />
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: tab === k ? "1px solid #16361b" : "1px solid #d4d9e3", background: tab === k ? "#16361b" : "#fff", color: tab === k ? "#34C08A" : "#42505f", padding: "5px 14px", borderRadius: 999, fontSize: 12.5, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      {tab === "faqs" && <TestMatch />}
      <ErrorNote error={error} />
      {!rows ? <Spinner /> : rows.length === 0 ? <Card><Empty msg="Nothing here yet." /></Card> : tab === "faqs" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((f) => (
            <Card key={f.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: "#9aa3b2" }}>#{f.id} · used {f.hits}× · missing: {LANGS.filter(([l]) => !f[`answer_${l}`]).map(([, n]) => n).join(", ") || "none"}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn small tone="ghost" onClick={() => setEditing(f)}>Edit</Btn>
                  <Btn small tone="danger" onClick={() => del(f.id)}>Delete</Btn>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#55606f", margin: "6px 0" }}>{f.phrases.map((p) => `“${p}”`).join(" · ")}</div>
              <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{f.answer_hinglish || f.answer_en || f.answer_hi}</div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((q) => (
            <Card key={q.id}>
              <div style={{ fontSize: 12, color: "#9aa3b2" }}>#{q.id} · {q.name || "Unknown"} · +{q.phone}{q.email ? ` · ${q.email}` : ""} · {q.lang} · {fmtDate(q.created_at)}</div>
              <div style={{ fontSize: 13.5, margin: "6px 0" }}>“{q.text}”</div>
              {q.answer && <div style={{ fontSize: 13, color: "#2c6e2c", whiteSpace: "pre-wrap" }}>↳ {q.answer} (answer #{q.faq_id})</div>}
            </Card>
          ))}
        </div>
      )}
      {editing && <FaqModal faq={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setTick((x) => x + 1); }} />}
    </div>
  );
}
