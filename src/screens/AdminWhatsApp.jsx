// Admin: WhatsApp support bot — connection status/QR, FAQ answers, questions sent to the owner.
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../api.js";
import { PageHead, Card, Btn, Field, Modal, Spinner, ErrorNote, Empty, inputStyle, fmtDate } from "../ui.jsx";
import { MessageCircle } from "lucide-react";

const TABS = [["campaign", "Outreach"], ["leads", "Leads"], ["faqs", "Saved answers"], ["pending", "Waiting for you"], ["answered", "Replies sent"], ["skipped", "Skipped"], ["business", "Extra notes (AI)"]];
const SCORE_STYLE = { hot: ["#fdecea", "#c0392b"], warm: ["#fff6e5", "#8a6100"], cold: ["#eef1f6", "#6b7688"] };
// What they actually asked for. These, not the score, decide who gets a call from you —
// green ones are the concrete asks that only you can finish; "stall" is the polite goodbye.
const SIGNAL = {
  call:      { label: "📞 wants a call",    bg: "#e8f6ec", fg: "#1e6b34", why: "Asked to talk, gave a time, or called" },
  reference: { label: "🤝 wants proof",     bg: "#e8f6ec", fg: "#1e6b34", why: "Asked who you work with / how to trust you — introduce them to a customer" },
  migrate:   { label: "🔁 has a site",      bg: "#e8f6ec", fg: "#1e6b34", why: "Asked if you can move or rebuild their existing site" },
  supplier:  { label: "📦 gave supplier",   bg: "#e8f6ec", fg: "#1e6b34", why: "Shared their own wholesaler's link or number" },
  sourcing:  { label: "🛒 wants stock",     bg: "#eaf1fb", fg: "#1d4e89", why: "Wants to buy products from us, not build a store" },
  numbers:   { label: "📊 gave numbers",    bg: "#e8f6ec", fg: "#1e6b34", why: "Told you real order or enquiry volume" },
  paying:    { label: "💳 ready to pay",    bg: "#e8f6ec", fg: "#1e6b34", why: "Asked how to pay or wanted the link" },
  stall:     { label: "🕗 polite no",       bg: "#f4f1e8", fg: "#8a6100", why: "\"I'll let you know\" / \"abhi nahi\" — sounds like a yes, isn't one" },
};
const STAGE_LABEL = { ready: "✅ ready to build", details: "📝 giving details", demo_yes: "👍 wants the demo",
  demo_offered: "🎬 demo offered", talking: "💬 talking", new: "🆕 new", not_interested: "❌ not interested" };

// Reopening a lead: the assistant reads THAT conversation and writes the message to send.
// It's shown first so it can be edited — you send it yourself, from your own WhatsApp.
function ContinueModal({ lead, onClose }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // The bot sends it, not this browser — the backend queues it and the bot picks it up.
  const send = async () => {
    setSending(true); setErr(null);
    try { await api.adminWaSendLead(lead.phone, text.trim()); setSent(true); setTimeout(onClose, 1800); }
    catch (e) { setErr(e); }
    setSending(false);
  };

  const load = async (refresh) => {
    setBusy(true); setErr(null);
    try {
      const r = await api.adminWaOpener(lead.phone, refresh);
      setText(r.text || fallbackText(lead));
      if (r.error) setErr(new Error(r.error));
    } catch (e) { setErr(e); setText(fallbackText(lead)); }
    setBusy(false);
  };
  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [lead.phone]);

  return (
    <Modal title={`Message ${lead.name || "+" + lead.phone}`} onClose={onClose}>
      <p style={{ fontSize: 12.5, color: "#6b7688", marginTop: 0 }}>
        Written from this chat — their shop, what they said, and where it stopped. Edit anything, then send.
      </p>
      <ErrorNote error={err} />
      <textarea rows={5} style={{ ...inputStyle, fontFamily: "inherit", lineHeight: 1.5 }}
        value={busy ? "Writing a message from your chat…" : text} disabled={busy}
        onChange={(e) => setText(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={send} disabled={busy || sending || sent || !text.trim()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: sent ? "#2c6e2c" : "#25D366",
            color: sent ? "#fff" : "#0b2b16", fontWeight: 700, fontSize: 13.5, padding: "9px 16px", borderRadius: 10,
            border: "none", cursor: busy || sending || sent ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          <MessageCircle size={15} /> {sent ? "Sent ✓" : sending ? "Sending…" : "Send from the bot"}
        </button>
        <Btn tone="ghost" onClick={() => load(true)} disabled={busy || sending || sent}>↻ Write another</Btn>
        {sent && <span style={{ fontSize: 12.5, color: "#6b7688" }}>
          The bot sends it within a few seconds and then handles their reply.</span>}
      </div>
    </Modal>
  );
}

// Used only if the assistant can't be reached — never leaves the button dead.
function fallbackText(l) {
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

// Outreach: upload a sheet of numbers, the bot opens each conversation, and the same sheet
// comes back with what happened to every one of them.
const CSTATUS = { qualified: ["#fdecea", "#c0392b", "🔥 qualified"], replied: ["#eaf7ee", "#2c6e2c", "💬 replied"],
  sent: ["#eef3fb", "#3a5a8c", "📤 opened"], pending: ["#fff6e5", "#8a6100", "⏳ waiting"],
  stopped: ["#eef1f6", "#6b7688", "🔕 no reply"], failed: ["#fdecea", "#c0392b", "⚠ failed"],
  skipped: ["#eef1f6", "#6b7688", "⏸ paused"] };

// When cold outreach goes out. Saved in the portal so it takes effect without a deploy.
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 || h === 24 ? "am" : "pm"}`;
function Timing({ stats, onSaved }) {
  const [from, setFrom] = useState(stats.from ?? 8);
  const [to, setTo] = useState(stats.to ?? 19);
  const [perDay, setPerDay] = useState(stats.per_day ?? 60);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { setFrom(stats.from ?? 8); setTo(stats.to ?? 19); setPerDay(stats.per_day ?? 60); }, [stats.from, stats.to, stats.per_day]);

  const save = async () => {
    setErr(null);
    try { await api.adminWaCampaignSettings({ from: +from, to: +to, per_day: +perDay }); setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved?.(); }
    catch (e) { setErr(e); }
  };
  const box = { ...inputStyle, width: 88, padding: "6px 8px" };
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eef1f6" }}>
      <ErrorNote error={err} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
        <span style={{ color: "#55606f" }}>New numbers get messaged between</span>
        <select style={box} value={from} onChange={(e) => setFrom(e.target.value)}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
        <span style={{ color: "#55606f" }}>and</span>
        <select style={box} value={to} onChange={(e) => setTo(e.target.value)}>
          {Array.from({ length: 24 }, (_, h) => <option key={h + 1} value={h + 1}>{hourLabel(h + 1)}</option>)}
        </select>
        <span style={{ color: "#55606f" }}>· max</span>
        <input style={{ ...box, width: 70 }} type="number" min="1" max="500" value={perDay} onChange={(e) => setPerDay(e.target.value)} />
        <span style={{ color: "#55606f" }}>a day</span>
        <Btn small onClick={save}>Save</Btn>
        {saved && <span style={{ color: "#2c6e2c", fontSize: 12.5 }}>Saved ✓</span>}
      </div>
      <div style={{ fontSize: 12, color: "#9aa3b2", marginTop: 6 }}>
        Indian time. Keep the daily number low — a burst of messages from one number is what gets it banned.
      </div>
    </div>
  );
}

function Campaign() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState("");

  const load = () => api.adminWaCampaign().then(setData).catch(setErr);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  const upload = async (file) => {
    if (!file) return;
    setBusy("Reading the sheet…"); setErr(null);
    try {
      const base64 = await new Promise((ok, no) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(",")[1]);
        r.onerror = () => no(new Error("Could not read that file"));
        r.readAsDataURL(file);
      });
      const r = await api.adminWaCampaignUpload(file.name, base64);
      setBusy(`${r.added} number(s) added${r.skipped ? `, ${r.skipped} already in the list` : ""}${r.bad ? `, ${r.bad} not valid` : ""}`);
      load();
    } catch (e) { setErr(e); setBusy(""); }
  };

  const download = async () => {
    setBusy("Building the file…"); setErr(null);
    try {
      const r = await api.adminWaCampaignExport();
      const a = document.createElement("a");
      a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${r.base64}`;
      a.download = r.filename; a.click();
      setBusy("");
    } catch (e) { setErr(e); setBusy(""); }
  };

  const s = data?.stats || {};
  const paused = (s.skipped || 0) > 0 && !(s.pending || 0);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Card>
        <ErrorNote error={err} />
        <div style={{ fontSize: 13, color: "#55606f", marginBottom: 10 }}>
          Upload a sheet with the <b>mobile number in the first column</b> (.xlsx or .csv — other columns are kept).
          The bot opens each chat with your two messages, handles the replies itself, and sends you the numbers worth your time.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ background: "#16361b", color: "#34C08A", fontWeight: 700, fontSize: 13.5,
            padding: "9px 16px", borderRadius: 10, cursor: "pointer" }}>
            ⬆ Upload numbers
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
              onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <Btn tone="ghost" onClick={download}>⬇ Download updated sheet</Btn>
          {(s.pending || s.skipped) ? (
            <Btn tone="ghost" onClick={async () => { await api.adminWaCampaignPause(!paused).catch(setErr); load(); }}>
              {paused ? "▶ Resume sending" : "⏸ Pause sending"}
            </Btn>
          ) : null}
          {busy && <span style={{ fontSize: 12.5, color: "#6b7688" }}>{busy}</span>}
        </div>
        {data && <Timing stats={s} onSaved={load} />}
        {data && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 13 }}>
            <span><b>{s.total || 0}</b> numbers</span>
            <span style={{ color: "#8a6100" }}>⏳ {s.pending || 0} waiting</span>
            <span style={{ color: "#3a5a8c" }}>📤 {s.sent || 0} opened</span>
            <span style={{ color: "#2c6e2c" }}>💬 {s.replied || 0} replied</span>
            <span style={{ color: "#c0392b" }}>🔥 {s.qualified || 0} qualified</span>
            <span style={{ color: "#6b7688" }}>🔕 {s.stopped || 0} no reply</span>
            <span style={{ marginLeft: "auto", color: "#9aa3b2" }}>{s.sent_today || 0}/{s.per_day || 0} sent today</span>
          </div>
        )}
      </Card>

      {!data ? <Spinner /> : !data.rows.length ? <Card><Empty msg="No numbers yet — upload a sheet to start." /></Card> : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 620 }}>
              <thead><tr style={{ background: "#f7f8fb", color: "#6b7688", textAlign: "left" }}>
                <th style={{ padding: "9px 12px" }}>Number</th><th style={{ padding: "9px 12px" }}>Name</th>
                <th style={{ padding: "9px 12px" }}>Status</th><th style={{ padding: "9px 12px" }}>Opened</th>
                <th style={{ padding: "9px 12px" }}>Interest</th><th style={{ padding: "9px 12px" }}></th>
              </tr></thead>
              <tbody>{data.rows.map((r) => {
                const [bg, fg, label] = CSTATUS[r.status] || ["#eef1f6", "#6b7688", r.status];
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef1f6" }}>
                    <td style={{ padding: "9px 12px" }}>+{r.phone}</td>
                    <td style={{ padding: "9px 12px" }}>{r.name || r.business || "—"}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ background: bg, color: fg, fontWeight: 700, padding: "2px 9px", borderRadius: 999 }}>{label}</span>
                    </td>
                    <td style={{ padding: "9px 12px", color: "#9aa3b2" }}>{r.sent_at ? fmtDate(r.sent_at) : "—"}</td>
                    <td style={{ padding: "9px 12px" }}>{r.score ? `${r.score}${r.stage ? ` · ${r.stage}` : ""}` : "—"}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <a href={`https://wa.me/${r.phone}`} target="_blank" rel="noreferrer" style={{ color: "#2c6e2c" }}>open chat ↗</a>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function AdminWhatsApp() {
  const [tab, setTab] = useState("faqs");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // faq object, {} for new
  const [msgLead, setMsgLead] = useState(null);  // lead whose "continue" message is open
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (tab === "business" || tab === "campaign") return;
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
      {tab === "campaign" ? <Campaign /> : tab === "business" ? <BusinessInfo /> : !rows ? <Spinner /> : tab === "leads" ? (
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
                  {(l.signals || []).length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
                      {l.signals.map((s) => (
                        <span key={s} title={SIGNAL[s]?.why}
                          style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                            background: SIGNAL[s]?.bg || "#eef1f5", color: SIGNAL[s]?.fg || "#55606f" }}>
                          {SIGNAL[s]?.label || s}
                        </span>
                      ))}
                    </div>
                  )}
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
                    <button onClick={() => setMsgLead(l)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#25D366", color: "#0b2b16",
                        fontWeight: 700, fontSize: 13, padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer" }}>
                      <MessageCircle size={15} /> Continue on WhatsApp
                    </button>
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
      {msgLead && <ContinueModal lead={msgLead} onClose={() => setMsgLead(null)} />}
    </div>
  );
}
