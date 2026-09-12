// Shared mobile-OTP widget: mobile -> code (resend timer) -> onAuthed(r).
// Uses Firebase phone auth when configured, else the server dev-OTP fallback.
// onAuthed receives { token, user, profile_complete }; the token is already
// persisted here, so callers just forward r.user to their own onLogin/onAuthed.
import React, { useEffect, useRef, useState } from "react";
import { api, setToken } from "../api.js";
import { firebaseEnabled, makeRecaptcha, sendPhoneOtp } from "../lib/firebase.js";

const ink = "#0E1726";
const input = { width: "100%", boxSizing: "border-box", padding: "11px 13px", border: "1px solid #d8dee8", borderRadius: 10, fontSize: 14, outline: "none" };
const btnPrimary = { width: "100%", marginTop: 12, background: ink, color: "#fff", border: "none", borderRadius: 10, padding: "11px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const errBox = { background: "#fdecec", color: "#b23a48", padding: "8px 11px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 };
const linkBtn = { background: "none", border: "none", color: "#3b6fd8", cursor: "pointer", fontSize: 12.5, padding: 0 };

export default function PhoneVerify({ onAuthed, onSignIn, cta = "Verify & continue" }) {
  const [step, setStep] = useState("mobile");   // mobile | code
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState(0);           // resend countdown
  const recaptchaRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft((n) => n - 1), 1000); return () => clearTimeout(t); }, [left]);
  useEffect(() => () => { try { recaptchaRef.current?.clear?.(); } catch { /* ignore */ } recaptchaRef.current = null; }, []);

  async function send() {
    setBusy(true); setErr("");
    try {
      if (firebaseEnabled) {
        if (!recaptchaRef.current) recaptchaRef.current = makeRecaptcha("recaptcha-container");
        confirmRef.current = await sendPhoneOtp(mobile, recaptchaRef.current);
      } else {
        const r = await api.otpSend(mobile); if (r.dev_code) setDevCode(r.dev_code);
      }
      setStep("code"); setCode(""); setLeft(45);
    } catch (e) {
      try { recaptchaRef.current?.clear?.(); } catch { /* ignore */ }
      recaptchaRef.current = null;
      setErr(e.message);
    } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setErr("");
    try {
      let r;
      if (firebaseEnabled) { const cred = await confirmRef.current.confirm(code); r = await api.firebaseAuth(await cred.user.getIdToken()); }
      else r = await api.otpVerify(mobile, code);
      setToken(r.token);
      onAuthed(r);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      {err && <div style={errBox}>{err}</div>}
      {step === "mobile" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...input, width: "auto", flex: "0 0 auto", background: "#f4f5f8", color: "#6b7688" }}>+91</span>
            <input style={input} placeholder="10-digit mobile number" value={mobile} autoFocus autoComplete="tel"
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} />
          </div>
          <button onClick={send} disabled={busy || mobile.length !== 10} style={btnPrimary}>{busy ? "Sending…" : "Send OTP"}</button>
          {onSignIn && <div style={{ textAlign: "center", marginTop: 12, fontSize: 12.5, color: "#6b7688" }}>Already have an account? <button onClick={onSignIn} style={linkBtn}>Sign in</button></div>}
        </>
      ) : (
        <>
          <p style={{ color: "#6b7688", fontSize: 13.5, margin: "0 0 12px" }}>Enter the 6-digit code sent to +91 {mobile}.</p>
          <input style={input} placeholder="6-digit code" value={code} autoFocus autoComplete="one-time-code"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} />
          {devCode && <div style={{ fontSize: 12, color: "#8a6100", marginTop: 6 }}>Dev code: <strong>{devCode}</strong></div>}
          <button onClick={verify} disabled={busy || code.length < 4} style={btnPrimary}>{busy ? "Verifying…" : cta}</button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            {left > 0
              ? <span style={{ fontSize: 12.5, color: "#9aa3b2" }}>Resend code in {left}s</span>
              : <button onClick={send} disabled={busy} style={linkBtn}>Resend code</button>}
            <button onClick={() => { setStep("mobile"); setLeft(0); }} style={{ ...linkBtn, color: "#6b7688" }}>Change number</button>
          </div>
        </>
      )}
      <div id="recaptcha-container" />
    </>
  );
}
