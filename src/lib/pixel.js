// Thin Meta Pixel helper for the portal. The base pixel + initial PageView live
// in index.html; App.jsx fires PageView on SPA navigation; this fires the
// standard CONVERSION events (CompleteRegistration, Lead, Subscribe) so the
// owner's Facebook ads can optimise. No-ops if the pixel hasn't loaded.
export function fbTrack(event, params) {
  try {
    if (typeof window !== "undefined" && window.fbq) window.fbq("track", event, params || {});
  } catch { /* never break the app for analytics */ }
}
