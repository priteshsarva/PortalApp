import React, { useState, useEffect } from "react";
import { KeyRound } from "lucide-react";
import { api, setToken } from "../api.js";
import { C, Field, inputStyle, Btn, ErrorNote } from "../ui.jsx";
import PhoneVerify from "../components/PhoneVerify.jsx";

// Browser-friendly generated password, same shape as the server's temp passwords.
function genPassword() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return "Spp-" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export default function Login({ onLogin, onBack }) {
  const [mode, setMode] = useState("login"); // login | signup | otp
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  // optional
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappCommunity, setWhatsappCommunity] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      let res;
      if (mode === "login") {
        res = await api.login(email, password);
      } else {
        const social_urls = {};
        if (instagram) social_urls.instagram = instagram;
        if (facebook) social_urls.facebook = facebook;
        res = await api.signup({
          email, password, name, mobile,
          social_urls,
          whatsapp_number: whatsappNumber || undefined,
          whatsapp_community_url: whatsappCommunity || undefined,
        });
      }
      const token = res.token || res.accessToken || res.jwt;
      if (!token) throw new Error("No token in response");
      setToken(token);
      const user = res.user || (await api.me()).user || (await api.me());
      onLogin(user);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";
  const isOtp = mode === "otp";

  function goSignup() { setMode("signup"); setError(null); if (!password) setPassword(genPassword()); }

  return (
    <div style={{ minHeight: "100vh", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 30, width: "100%", maxWidth: isSignup ? 440 : 380, maxHeight: "92vh", overflowY: "auto" }}>
        {onBack && (
          <button type="button" onClick={onBack}
            style={{ background: "none", border: "none", color: "#6b7688", fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 14 }}>
            ← Back to product search
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.lime, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <KeyRound size={17} color={C.ink} />
          </div>
          <strong style={{ fontSize: 17 }}>Server Products</strong>
        </div>
        <p style={{ color: "#6b7688", fontSize: 13, margin: "0 0 20px" }}>
          {isOtp ? "Sign in or sign up with your mobile number." : isSignup ? "Create your account to get started." : "Sign in to your portal."}
        </p>

        <ErrorNote error={error} />

        {isOtp ? (
          <>
            <PhoneVerify onAuthed={(r) => onLogin(r.user)} cta="Verify & continue" />
            <button onClick={() => { setMode("login"); setError(null); }}
              style={{ marginTop: 16, background: "none", border: "none", color: "#6b7688", fontSize: 12.5, cursor: "pointer" }}>
              ← Use email &amp; password instead
            </button>
          </>
        ) : (
        <>
        <button type="button" onClick={() => { setMode("otp"); setError(null); }}
          style={{ width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 10, padding: "11px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 14 }}>
          📱 Continue with mobile OTP
        </button>
        <div style={{ textAlign: "center", color: "#9aa3b2", fontSize: 12, margin: "0 0 14px" }}>— or with email &amp; password —</div>
        <form onSubmit={submit}>
          {isSignup && (
            <Field label="Name">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </Field>
          )}
          <Field label="Email">
            <input style={inputStyle} type="email" required autoComplete={isSignup ? "email" : "username"}
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@store.com" />
          </Field>
          <Field label="Password">
            <input style={inputStyle} type={isSignup ? "text" : "password"} required
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            {isSignup && (
              <button type="button" onClick={() => setPassword(genPassword())}
                style={{ background: "none", border: "none", color: "#3b6fd8", fontSize: 12, cursor: "pointer", padding: "4px 0" }}>
                ↻ Generate a strong password
              </button>
            )}
          </Field>

          {isSignup && (
            <>
              <Field label="Mobile number">
                <input style={inputStyle} required autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 98765 43210" />
              </Field>

              <button type="button" onClick={() => setShowOptional((v) => !v)}
                style={{ background: "none", border: "none", color: C.ink, fontSize: 12.5, cursor: "pointer", padding: "4px 0", fontWeight: 600 }}>
                {showOptional ? "− Hide optional details" : "+ Add social & WhatsApp (optional)"}
              </button>

              {showOptional && (
                <div style={{ borderLeft: `2px solid #eef1f6`, paddingLeft: 12, marginTop: 6 }}>
                  <Field label="Instagram URL">
                    <input style={inputStyle} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/…" />
                  </Field>
                  <Field label="Facebook URL">
                    <input style={inputStyle} value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/…" />
                  </Field>
                  <Field label="WhatsApp number">
                    <input style={inputStyle} value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+91 98765 43210" />
                  </Field>
                  <Field label="WhatsApp community link">
                    <input style={inputStyle} value={whatsappCommunity} onChange={(e) => setWhatsappCommunity(e.target.value)} placeholder="https://chat.whatsapp.com/…" />
                  </Field>
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: 10 }}>
            <Btn type="submit" tone="lime" disabled={busy}>
              {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            </Btn>
          </div>
        </form>

        <button onClick={() => (isSignup ? (setMode("login"), setError(null)) : goSignup())}
          style={{ marginTop: 16, background: "none", border: "none", color: "#6b7688", fontSize: 12.5, cursor: "pointer" }}>
          {isSignup ? "Have an account? Sign in" : "Need an account? Sign up"}
        </button>
        </>
        )}
      </div>
    </div>
  );
}
