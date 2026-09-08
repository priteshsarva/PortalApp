// Firebase Phone Auth (client side). The SDK sends the SMS and verifies the
// code; we hand the resulting ID token to our backend (/search-auth/firebase).
// Config comes from Vite env (VITE_FIREBASE_*) in portal-app-clean/.env.local —
// these are public values, safe in the bundle. If they're absent, firebaseEnabled
// is false and the signup modal falls back to the server dev-OTP flow.
import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
};

export const firebaseEnabled = !!cfg.apiKey;

let auth;
function fbAuth() {
  if (!auth) auth = getAuth(getApps().length ? getApps()[0] : initializeApp(cfg));
  return auth;
}

// Invisible reCAPTCHA anchored to a DOM node (Firebase's own anti-abuse step).
export function makeRecaptcha(containerId) {
  return new RecaptchaVerifier(fbAuth(), containerId, { size: "invisible" });
}

// Prefix +91 for bare 10-digit Indian numbers; pass through anything already
// carrying a country code (leading + or >10 digits).
function toE164(mobile) {
  const d = String(mobile || "").replace(/\D/g, "");
  if (String(mobile).trim().startsWith("+")) return "+" + d;
  return d.length === 10 ? "+91" + d : "+" + d;
}

export function sendPhoneOtp(mobile, recaptcha) {
  return signInWithPhoneNumber(fbAuth(), toE164(mobile), recaptcha);   // -> confirmationResult
}
