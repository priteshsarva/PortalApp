// Admin: WhatsApp support bot — connection status/QR, FAQ answers, questions sent to the owner.
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../api.js";
import { PageHead, Card, Btn, Field, Modal, Spinner, ErrorNote, Empty, inputStyle, fmtDate } from "../ui.jsx";
import { MessageCircle } from "lucide-react";

const TABS = [["leads", "Leads"], ["faqs", "Saved answers"], ["pending", "Waiting for you"], ["answered", "Replies sent"], ["skipped", "Skipped"], ["business", "Extra notes (AI)"]];
const SCORE_STYLE = { hot: ["#fdecea", "#c0392b"], warm: ["#fff6e5", "#8a6100"], cold: ["#eef1f6", "#6b7688"] };
const STAGE_LABEL = { ready: "✅ ready to build", details: "📝 giving details", demo_yes: "👍 wants the demo",
  demo_offered: "🎬 demo offered", talking: "💬 talking", new: "🆕 new", not_interested: "❌ not interested" };

// The opener is written for where the conversation actually stopped, so picking a lead back
// up is one tap — WhatsApp opens with the message ready and you only press send.
function continueText(l) {
  const who = l.name ? ` ${l.name} ji` : " ji";
  const shop = l.store_name || l.business;
  switch (l.stage) {
    case "ready":
    case "details":
      return `Namaste${who}! ${shop ? `${shop} ka` : "Aapka"} demo store ready karne ja rahe hain — bas confirm kar dijiye, aaj hi link bhej dete hain.`;
    case "demo_yes":
      return `Namaste${who}! Aapke naam se free demo store banane ke liye bas do cheezein chahiye — store ka naam aur aap kya bechte ho. Bata dijiye, abhi bana dete hain.`;
    case "demo_offered":
      return `Namaste${who}! Socha ek baar aur pooch lein — aapke naam se free demo store bana ke dikha dein? Dekh ke hi batana, koi charge nahi.`;
    case "not_interested":
      return `Namaste${who}! Bas yaad dilane ke liye — jab bhi online store ka mann ho, hum yahin hain. thekartify.com par dekh lijiyega.`;
    default:
      return `Namaste${who}! Kartify se baat hui thi${shop ? ` ${shop} ke baare me` : ""}. Aapki dukaan ke liye ready online store bana kar dete hain — ek baar dekhna chahenge?`;
  }
}
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
      {st.ai && <div style={{ fontSize: 12, color: "#9aa3b2", marginTop: 4 }}>
        AI: {st.ai.enabled ? `on — ${st.ai.n || 0}/${st.ai.max} calls used today` : "off (no GEMINI_API_KEY on the backend)"}
      </div>}
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

// Notes added on top of the main guide (portal/kartify-guide.md on the backend).
// The assistant says nothing outside the guide, these notes, your saved answers
// and the client's own account data.
function BusinessInfo() {
  const [notes, setNotes] = useState(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { api.adminWaBusiness().then((r) => setNotes(r.notes || "")).catch(setErr); }, []);
  const save = async () => {
    setErr(null); setSaved(false);
    try { await api.adminWaSaveBusiness(notes); setSaved(true); } catch (e) { setErr(e); }
  };
  if (notes === null) return <Spinner />;
  return (
    <Card>
      <ErrorNote error={err} />
      <p style={{ fontSize: 13, color: "#6b7688", marginTop: 0 }}>
        The assistant already knows the full Kartify guide (what we do, onboarding, running a store, plans, common questions).
        Add anything extra or changed here — a new price, an offer that ended, something it should never say.
        Plain sentences work best.
      </p>
      <textarea rows={14} style={{ ...inputStyle, fontFamily: "inherit", lineHeight: 1.5 }}
        placeholder={"e.g. From October the Standard plan includes 2 custom domains.\ne.g. Never promise same-day delivery in Kerala."}
        value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
        <Btn onClick={save}>Save</Btn>
        {saved && <span style={{ color: "#2c6e2c", fontSize: 13 }}>Saved ✓</span>}
      </div>
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
    if (tab === "business") return;
    setRows(null); setError(null);
    (tab === "faqs" ? api.adminWaFaqs().then((r) => r.faqs)
      : tab === "leads" ? api.adminWaLeads().then((r) => r.leads)
      : api.adminWaQuestions(tab).then((r) => r.questions))
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
      {tab === "business" ? <BusinessInfo /> : !rows ? <Spinner /> : tab === "leads" ? (
        rows.length === 0 ? <Card><Empty msg="No leads yet — they appear as the assistant talks to people." /></Card> : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((l) => {
              const [bg, fg] = SCORE_STYLE[l.score] || SCORE_STYLE.cold;
              const facts = [l.business, l.city, l.sells, l.shops && `${l.shops} shop`, l.online_already && `online: ${l.online_already}`,
                             l.suppliers && `supplier: ${l.suppliers}`, l.socials, l.email, l.budget_hint].filter(Boolean);
              return (
                <Card key={l.phone}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {l.name || "Unknown"} <a href={`https://wa.me/${l.phone}`} target="_blank" rel="noreferrer" style={{ fontWeight: 500, fontSize: 13, color: "#2c6e2c" }}>+{l.phone}</a>
                    </div>
                    <span style={{ background: bg, color: fg, fontSize: 11.5, fontWeight: 800, padding: "3px 10px", borderRadius: 999, textTransform: "uppercase" }}>{l.score}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#55606f", margin: "6px 0" }}>{facts.join(" · ") || "nothing captured yet"}</div>
                  {l.score_reason && <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>{l.score_reason}</div>}
                  {l.intent && <div style={{ fontSize: 12.5, color: "#9aa3b2" }}>Wants: {l.intent}</div>}
                  {(l.store_name || l.supplier_links || l.whatsapp_for_orders || l.own_domain) && (
                    <div style={{ fontSize: 12.5, color: "#55606f", marginTop: 4 }}>
                      For their store: {[l.store_name && `“${l.store_name}”`, l.whatsapp_for_orders && `orders on ${l.whatsapp_for_orders}`,
                        l.supplier_links && `supplier ${l.supplier_links}`, l.own_domain].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {l.demo_slug && (
                    <div style={{ fontSize: 12.5, marginTop: 4 }}>
                      🏪 <a href={`https://${l.demo_slug}.thekartify.com`} target="_blank" rel="noreferrer" style={{ color: "#2c6e2c" }}>{l.demo_slug}.thekartify.com</a>
                      {l.demo_expires_at && <span style={{ color: "#9aa3b2" }}> · demo till {fmtDate(l.demo_expires_at)}</span>}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                    <a href={`https://wa.me/${l.phone}?text=${encodeURIComponent(continueText(l))}`} target="_blank" rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#25D366", color: "#0b2b16",
                        fontWeight: 700, fontSize: 13, padding: "8px 14px", borderRadius: 9, textDecoration: "none" }}>
                      <MessageCircle size={15} /> Continue on WhatsApp
                    </a>
                    <span style={{ fontSize: 12, color: "#6b7688" }}>{STAGE_LABEL[l.stage] || l.stage}</span>
                    {l.outcome && <span style={{ fontSize: 12, fontWeight: 700, color: l.outcome === "won" ? "#2c6e2c" : "#9aa3b2" }}>
                      {l.outcome === "won" ? "🏆 won" : "lost"}</span>}
                    <span style={{ fontSize: 11.5, color: "#c0c7d2", marginLeft: "auto" }}>updated {fmtDate(l.updated_at)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : rows.length === 0 ? <Card><Empty msg="Nothing here yet." /></Card> : tab === "faqs" ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((f) => (
            <Card key={f.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: "#9aa3b2" }}>
                  #{f.id} · used {f.hits}× · missing: {LANGS.filter(([l]) => !f[`answer_${l}`]).map(([, n]) => n).join(", ") || "none"}
                  {f.source === "ai" && <span style={{ background: "#eef1f6", color: "#42505f", borderRadius: 999, padding: "2px 8px", marginLeft: 6, fontWeight: 700 }}>learned from chat</span>}
                </div>
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
              <div style={{ fontSize: 12, color: "#9aa3b2" }}>
                #{q.id} · {q.name || "Unknown"} · +{q.phone}{q.email ? ` · ${q.email}` : ""} · {q.lang} · {fmtDate(q.created_at)}
                {q.source === "ai" && <span style={{ background: "#eef1f6", color: "#42505f", borderRadius: 999, padding: "2px 8px", marginLeft: 6, fontWeight: 700 }}>AI answered</span>}
              </div>
              <div style={{ fontSize: 13.5, margin: "6px 0" }}>“{q.text}”</div>
              {q.answer && <div style={{ fontSize: 13, color: "#2c6e2c", whiteSpace: "pre-wrap" }}>↳ {q.answer}{q.faq_id ? ` (answer #${q.faq_id})` : ""}</div>}
              {q.source === "ai" && <div style={{ fontSize: 12, color: "#9aa3b2", marginTop: 4 }}>Wrong? On WhatsApp send: #{q.id} fix &lt;better wording&gt;</div>}
            </Card>
          ))}
        </div>
      )}
      {editing && <FaqModal faq={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setTick((x) => x + 1); }} />}
    </div>
  );
}
