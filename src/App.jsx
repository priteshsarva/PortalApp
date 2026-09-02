import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, Globe, Tags, PlusCircle, Plug, Inbox, ShieldCheck, Users,
  Megaphone, ScrollText, BarChart3, Search, Store, Receipt, LogOut, KeyRound, Database,
  Mail, CreditCard, LayoutTemplate, ClipboardList, Bell, Menu,
} from "lucide-react";
import { api, getToken, setToken } from "./api.js";
import { C, Stub, useIsMobile } from "./ui.jsx";
import Login from "./screens/Login.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import MySites from "./screens/MySites.jsx";
import RequestSite from "./screens/RequestSite.jsx";
import PluginSetup from "./screens/PluginSetup.jsx";
import AdminSources from "./screens/AdminSources.jsx";
import AdminQueue from "./screens/AdminQueue.jsx";
import AdminEnrollments from "./screens/AdminEnrollments.jsx";
import Billing from "./screens/Billing.jsx";
import AdminClients from "./screens/AdminClients.jsx";
import AdminEmailSettings from "./screens/AdminEmailSettings.jsx";
import AdminPaymentSettings from "./screens/AdminPaymentSettings.jsx";
import MyStorefronts from "./screens/MyStorefronts.jsx";
import MyOrders from "./screens/MyOrders.jsx";
import CatalogueSearch from "./screens/CatalogueSearch.jsx";
import Notifications, { lastSeen } from "./screens/Notifications.jsx";
import BrandMapping from "./screens/BrandMapping.jsx";
import AdminHostedSites from "./screens/AdminHostedSites.jsx";
import AdminOrders from "./screens/AdminOrders.jsx";
import AdminPlans from "./screens/AdminPlans.jsx";

const clientNav = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["sites", "My sites", Globe],
  ["storefront", "My storefront", LayoutTemplate],
  ["orders", "Orders", ClipboardList],
  ["request", "Request a site", PlusCircle],
  ["plugin", "Plugin setup", Plug],
  ["analytics", "Store analytics", BarChart3],
  ["search", "Catalogue search", Search],
  ["promote", "Promote", Megaphone],
  ["wholesale", "Sell wholesale", Store],
  ["billing", "Billing", Receipt],
  ["notifications", "Notifications", Bell],
];
const adminNav = [
  ["queue", "Approval queue", Inbox],
  ["sources", "Sources", Database],
  ["enrollAdmin", "Enrollments", ShieldCheck],
  ["brandMap", "Brand mapping", Tags],
  ["hostedSites", "Storefronts", LayoutTemplate],
  ["hostedOrders", "Storefront orders", ClipboardList],
  ["plans", "Plans", Receipt],
  ["users", "Clients", Users],
  ["email", "Email (SMTP)", Mail],
  ["payments", "Payments", CreditCard],
  ["announce", "Announcements", Megaphone],
  ["audit", "Audit log", ScrollText],
  ["notifications", "Notifications", Bell],
];

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [nav, setNav] = useState("dashboard");
  const [unread, setUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mobile = useIsMobile();

  // unread notification count (vs the client-side last-seen timestamp)
  useEffect(() => {
    if (!user) return;
    api.notifications().then((r) => {
      const seen = lastSeen();
      setUnread((r.notifications || []).filter((n) => !seen || new Date(n.created_at) > new Date(seen)).length);
    }).catch(() => {});
  }, [user]);
  useEffect(() => { if (nav === "notifications") setUnread(0); }, [nav]);

  // restore session from a stored token
  useEffect(() => {
    if (!getToken()) { setBooting(false); return; }
    api.me()
      .then((r) => { const u = r.user || r; setUser(u); setNav(u.role === "admin" ? "queue" : "dashboard"); })
      .catch(() => setToken(""))
      .finally(() => setBooting(false));
  }, []);

  if (booting) return <div style={{ minHeight: "100vh", background: C.ink }} />;
  if (!user) return <Login onLogin={(u) => { setUser(u); setNav(u.role === "admin" ? "queue" : "dashboard"); }} />;

  const role = user.role === "admin" ? "admin" : "client";
  const items = role === "admin" ? adminNav : clientNav;

  function signOut() { setToken(""); setUser(null); }

  function render() {
    if (role === "client") {
      switch (nav) {
        case "dashboard": return <Dashboard me={user} />;
        case "sites": return <MySites />;
        case "storefront": return <MyStorefronts />;
        case "orders": return <MyOrders />;
        case "request": return <RequestSite />;
        case "plugin": return <PluginSetup />;
        case "analytics": return <Stub title="Store analytics" note="Needs the plugin page-view tracker + an analytics endpoint." />;
        case "search": return <CatalogueSearch />;
        case "promote": return <Stub title="Promote" note="Ad marketplace — not built yet." />;
        case "wholesale": return <Stub title="Sell wholesale" note="Phase 2 — wholesale listings." />;
        case "billing": return <Billing />;
        case "notifications": return <Notifications />;
        default: return null;
      }
    }
    switch (nav) {
      case "queue": return <AdminQueue />;
      case "sources": return <AdminSources />;
      case "enrollAdmin": return <AdminEnrollments />;
      case "brandMap": return <BrandMapping />;
      case "hostedSites": return <AdminHostedSites />;
      case "hostedOrders": return <AdminOrders />;
      case "plans": return <AdminPlans />;
      case "users": return <AdminClients />;
      case "email": return <AdminEmailSettings />;
      case "payments": return <AdminPaymentSettings />;
      case "announce": return <Stub title="Announcements" note="Needs an announcements endpoint." />;
      case "audit": return <Stub title="Audit log" note="The audit_log table exists; needs a read endpoint." />;
      case "notifications": return <Notifications />;
      default: return null;
    }
  }

  const goTo = (key) => { setNav(key); setDrawerOpen(false); };

  const sidebar = (
    // desktop: fill the viewport (and grow with content) via minHeight — a plain
    // height:100% collapses because the flex parent only has min-height. mobile:
    // the fixed drawer wrapper is a definite 100vh, so height:100% is right there.
    <aside style={{ width: 244, background: C.ink, color: C.text, padding: "22px 14px", display: "flex", flexDirection: "column", flexShrink: 0, boxSizing: "border-box", ...(mobile ? { height: "100%" } : { minHeight: "100vh" }) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 6px" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.lime, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <KeyRound size={17} color={C.ink} />
        </div>
        <strong style={{ fontSize: 15.5 }}>Server Products</strong>
      </div>

      <nav style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 3, overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}>
        {items.map(([key, label, Icon]) => {
          const on = nav === key;
          return (
            <button key={key} onClick={() => goTo(key)}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: on ? 600 : 500, background: on ? C.surface2 : "transparent", color: on ? "#fff" : C.dim, borderLeft: on ? `2px solid ${C.lime}` : "2px solid transparent" }}>
              <Icon size={16} color={on ? C.lime : C.dim} /> {label}
              {key === "notifications" && unread > 0 && (
                <span style={{ marginLeft: "auto", background: C.lime, color: C.ink, fontSize: 11, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{unread}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 12, color: C.dim, padding: "0 6px 10px" }}>
          {user.email} · <span style={{ color: role === "admin" ? C.lime : C.sky }}>{role}</span>
        </div>
        <button onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 13, padding: "0 6px" }}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: "#1b2230", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {mobile ? (
        <>
          {/* sticky mobile top bar with a hamburger */}
          <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", gap: 10, background: C.ink, color: "#fff", padding: "10px 14px" }}>
            <button onClick={() => setDrawerOpen(true)} aria-label="Menu" style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex", padding: 4 }}>
              <Menu size={22} />
            </button>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: C.lime, display: "grid", placeItems: "center" }}><KeyRound size={14} color={C.ink} /></div>
            <strong style={{ fontSize: 15 }}>Server Products</strong>
            {unread > 0 && (
              <button onClick={() => goTo("notifications")} style={{ marginLeft: "auto", position: "relative", background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex" }}>
                <Bell size={20} />
                <span style={{ position: "absolute", top: -4, right: -4, background: C.lime, color: C.ink, fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, borderRadius: 999, display: "grid", placeItems: "center" }}>{unread}</span>
              </button>
            )}
          </header>

          {/* slide-in drawer + backdrop */}
          {drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40 }} />}
          <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, width: 260, maxWidth: "82vw", zIndex: 50, transform: drawerOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.22s ease" }}>
            {sidebar}
          </div>

          <main style={{ minWidth: 0, padding: "16px 14px 90px" }}>
            {render()}
          </main>
        </>
      ) : (
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {sidebar}
          <main style={{ flex: 1, minWidth: 0, padding: "26px 32px" }}>
            {render()}
          </main>
        </div>
      )}
      {role === "client" && <ProSetupPopup />}
    </div>
  );
}

// Bottom-right upsell: have the platform team set up the store for ₹499. One tap
// pings the team; dismissal is remembered so it doesn't nag.
function ProSetupPopup() {
  const [closed, setClosed] = useState(() => {
    try { return localStorage.getItem("spp_prosetup_dismissed") === "1"; } catch { return false; }
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (closed) return null;
  function dismiss() {
    try { localStorage.setItem("spp_prosetup_dismissed", "1"); } catch { /* ignore */ }
    setClosed(true);
  }
  async function send() {
    setBusy(true);
    try { await api.requestProSetup(""); setSent(true); }
    catch { setSent(true); } // best-effort; still thank the user
    finally { setBusy(false); }
  }
  return (
    <div style={{
      position: "fixed", right: 20, bottom: 20, zIndex: 1000, width: 300,
      background: "#0E1726", color: "#fff", borderRadius: 14, padding: 16,
      boxShadow: "0 12px 40px rgba(0,0,0,0.28)", border: `1px solid ${C.lime}`,
    }}>
      <button onClick={dismiss} aria-label="Close" style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: "#8a93a3", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
      {sent ? (
        <div style={{ fontSize: 13.5, paddingRight: 8 }}>
          🎉 Thanks! Our team will reach out to you shortly to set up your store.
          <div style={{ marginTop: 12 }}>
            <button onClick={dismiss} style={{ background: C.lime, color: "#0E1726", border: "none", borderRadius: 8, padding: "7px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Got it</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6, paddingRight: 14 }}>Want us to set up your store?</div>
          <div style={{ fontSize: 12.5, color: "#c3ccd8", marginBottom: 12 }}>
            Our professional team will build your storefront for you — branding, products and go-live. Just <strong style={{ color: "#fff" }}>₹499</strong>.
          </div>
          <button onClick={send} disabled={busy} style={{ width: "100%", background: C.lime, color: "#0E1726", border: "none", borderRadius: 8, padding: "9px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13.5, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Sending…" : "Yes, set it up for me"}
          </button>
        </>
      )}
    </div>
  );
}
