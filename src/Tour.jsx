// Client onboarding: a welcome popup that asks what the user wants to do, then
// runs a short spotlight walkthrough (driver.js) of that flow. Skippable per step
// and as a whole; "Don't show again" stops it returning on every refresh.
import React, { useState } from "react";
import { X } from "lucide-react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { C } from "./ui.jsx";

const SEEN_KEY = "spp_tour_dismissed";

// Each choice navigates to a section, then spotlights its key actions. Steps
// target on-screen buttons (tagged data-tour="…"), so it works on mobile too.
// Each choice → a section + an ordered, step-by-step walkthrough. Steps whose
// target isn't on the page (e.g. a store card when you have no stores yet) are
// skipped automatically, so the tour adapts to the account's state.
const CHOICES = [
  {
    key: "storefront", emoji: "🛍️", title: "Create an online store",
    desc: "A hosted storefront with your products, branding and checkout.",
    steps: [
      { sel: '[data-tour="new-store"]', title: "Step 1 — Create a store", description: "Click New storefront to begin. You just give it a name; a guided setup opens next." },
      { sel: '[data-tour="store-list"]', title: "Step 2 — Set it up & go live", description: "Your stores live here. Open one for the step-by-step setup: Branding → Products → Navigation → Homepage → then Submit for review, pick a plan, pay, and it's live." },
    ],
  },
  {
    key: "sites", emoji: "🔌", title: "Use the WordPress plugin",
    desc: "Connect your existing WooCommerce site with a plugin key.",
    steps: [
      { sel: '[data-tour="download-plugin"]', title: "Step 1 — Download the plugin", description: "Download the plugin ZIP, then in WordPress: Plugins → Add New → Upload → Activate." },
      { sel: '[data-tour="request-key"]', title: "Step 2 — Request a key", description: "Request an enrollment key for the site you want to connect." },
      { sel: '[data-tour="plugin-keys"]', title: "Step 3 — Paste your key", description: "Your keys appear here. Copy one and paste it into the plugin's settings — products sync automatically." },
    ],
  },
  {
    key: "search", emoji: "🔎", title: "Browse the catalogue",
    desc: "Search every product you're able to sell.",
    steps: [
      { sel: '[data-tour="catalogue-search"]', title: "Step 1 — Search", description: "Type a product name or brand to search the full catalogue." },
      { sel: '[data-tour="search-filters"]', title: "Step 2 — Narrow it down", description: "Filter by category, stock, price, brand or size to find exactly what you want to sell." },
    ],
  },
  {
    key: "request", emoji: "➕", title: "Request a new source",
    desc: "Ask us to add a new supplier site to your account.",
    steps: [
      { sel: '[data-tour="request-store"]', title: "Step 1 — Pick a store", description: "Choose which store the new source should feed." },
      { sel: '[data-tour="request-url"]', title: "Step 2 — Add the site", description: "Paste the supplier site's URL." },
      { sel: '[data-tour="request-submit"]', title: "Step 3 — Send it", description: "Submit the request — we review it and add the source, then it attaches to your store automatically." },
    ],
  },
];

export default function WelcomeTour({ setNav }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(SEEN_KEY) !== "1"; } catch { return true; } });
  if (!open) return null;

  const dontShowAgain = () => { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ } setOpen(false); };
  const skip = () => setOpen(false); // returns next refresh

  function start(choice) {
    setOpen(false);
    setNav(choice.key);
    // wait for the target screen to render, then spotlight the actions that exist
    setTimeout(() => {
      const steps = choice.steps
        .filter((s) => document.querySelector(s.sel))
        .map((s) => ({ element: s.sel, popover: { title: s.title, description: s.description, side: "bottom", align: "start" } }));
      if (!steps.length) return;
      driver({
        showProgress: steps.length > 1,
        allowClose: true,
        overlayColor: "rgba(14,23,38,0.68)",
        nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Got it",
        steps,
      }).drive();
    }, 500);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,15,25,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(560px, 100%)", maxHeight: "90vh", overflow: "auto", position: "relative" }}>
        <button onClick={skip} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "#8a93a3" }}><X size={20} /></button>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1b2230" }}>Welcome 👋 What would you like to do?</div>
        <div style={{ fontSize: 13, color: "#6b7688", marginTop: 4, marginBottom: 18 }}>Pick one and we'll take you there with a quick walkthrough.</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {CHOICES.map((c) => (
            <button key={c.key} onClick={() => start(c)}
              style={{ textAlign: "left", cursor: "pointer", border: "1px solid #e6e9f0", borderRadius: 12, padding: "14px 15px", background: "#fff", transition: "border-color .15s, box-shadow .15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.ink; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e6e9f0"; }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{c.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1b2230" }}>{c.title}</div>
              <div style={{ fontSize: 12, color: "#6b7688", marginTop: 3 }}>{c.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, gap: 12, flexWrap: "wrap" }}>
          <button onClick={dontShowAgain} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a93a3", fontSize: 12.5 }}>Don't show this again</button>
          <button onClick={skip} style={{ background: "none", border: "none", cursor: "pointer", color: "#42505f", fontSize: 12.5, fontWeight: 600 }}>Skip for now →</button>
        </div>
      </div>
    </div>
  );
}
