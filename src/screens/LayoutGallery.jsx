// Client-facing gallery of ready-made storefront layouts, each with a LIVE
// preview, and a one-click "create my store with this layout" button. Previews
// render against the client's own store (with its preview password) if they have
// one, else a public demo store (VITE_DEMO_STORE).
import React, { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Modal, Field, inputStyle, ErrorNote, Spinner, storeUrl } from "../ui.jsx";

// The hand-built full-page templates (mirrors MyStorefronts' COMPONENT_TEMPLATES).
const TEMPLATES = [
  { id: "original", name: "Original", tag: "Multi-category", description: "Best-sellers rail per category + a mixed all-products rail. Shows every category you sell. A safe, flexible default." },
  { id: "atelier", name: "Atelier", tag: "Fashion / editorial", description: "Premium black-and-white magazine look — full-screen campaign hero, category cards, editorial collage, testimonial, marquee. Best for clothing & lifestyle." },
  { id: "velocity", name: "Velocity", tag: "Athletic / shoes", description: "High-energy neon + crimson, floating product shots, men's/women's selector, tech breakdown. Built shoes-first." },
  { id: "chrono", name: "Chrono", tag: "Luxe / watches", description: "The bold Velocity layout in a gold + deep-blue palette, built watches-first — floating watch shots, movement/crystal breakdown." },
  { id: "redline", name: "Redline", tag: "Automotive / gadgets", description: "Aggressive red-and-black motorsport look — dark hero, flash sale, top categories, popular grid. Best for car parts, gadgets & performance gear." },
  { id: "haven", name: "Haven", tag: "Furniture / décor", description: "Warm editorial magazine look — cream + espresso, serif headings, split hero, room grid, lifestyle gallery. Best for furniture, décor & lifestyle." },
];

// Preview window height and the tall iframe we slide up inside it on hover, so
// the whole layout auto-scrolls into view (we can't scroll a cross-origin iframe
// from the parent, so we move the iframe element instead).
const WIN_H = 320, FRAME_H = 1500;

export default function LayoutGallery({ onCreated }) {
  const [sites, setSites] = useState(null);
  const [hovered, setHovered] = useState(null);   // template id being auto-scrolled
  const [chosen, setChosen] = useState(null);     // template whose options modal is open
  const [creating, setCreating] = useState(null); // template being created (name modal)

  useEffect(() => { api.myHostedSites().then((r) => setSites(r.sites || [])).catch(() => setSites([])); }, []);

  // Preview source: a shared demo store (VITE_DEMO_STORE) is preferred so every
  // layout shows the SAME demo products and is comparable; else fall back to the
  // client's own first store (with its preview password for a draft).
  const demo = import.meta.env.VITE_DEMO_STORE || "";
  const own = sites && sites[0];
  const usingDemo = !!demo;
  function previewUrl(id) {
    let base;
    if (demo) base = storeUrl(demo);
    else if (own) base = storeUrl(own.slug);
    else return null;
    let u = base + (base.includes("?") ? "&" : "?") + "preset=" + encodeURIComponent(id);
    if (!usingDemo && own?.preview_password) u += "&preview_pw=" + encodeURIComponent(own.preview_password);
    return u;
  }
  const canPreview = !!(demo || own);

  return (
    <div>
      <PageHead title="Store layouts" sub="Hover a layout to auto-scroll through it; click to open a full preview or create your store with it." />

      {sites === null ? <Spinner /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {TEMPLATES.map((t) => {
            const url = previewUrl(t.id);
            const on = hovered === t.id;
            return (
              <Card key={t.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5 }}>{t.name}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#3b6fd8", background: "#eef6ff", border: "1px solid #cfe0fb", borderRadius: 999, padding: "2px 9px" }}>{t.tag}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#6b7688", marginTop: 7, minHeight: 54, lineHeight: 1.5 }}>{t.description}</div>
                </div>

                {/* live preview — hover auto-scrolls the whole layout; click opens
                    the options modal. The iframe itself is non-interactive. */}
                <div
                  onMouseEnter={() => url && setHovered(t.id)}
                  onMouseLeave={() => setHovered((h) => (h === t.id ? null : h))}
                  onClick={() => url && setChosen(t)}
                  style={{ border: "1px solid #e6e9f0", borderRadius: 10, overflow: "hidden", height: WIN_H, background: "#fff", position: "relative", cursor: url ? "pointer" : "default" }}
                >
                  {url ? (
                    <>
                      <iframe key={t.id} title={`${t.name} preview`} src={url} loading="lazy" tabIndex={-1} scrolling="no"
                        style={{ border: "none", width: "100%", height: FRAME_H, pointerEvents: "none", transform: on ? `translateY(-${FRAME_H - WIN_H}px)` : "translateY(0)", transition: on ? "transform 7s linear" : "transform 0.5s ease" }} />
                      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 12px 8px", background: "linear-gradient(to top, rgba(14,23,38,0.55), transparent)", color: "#fff", fontSize: 11.5, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: on ? 0 : 1, transition: "opacity .25s ease", pointerEvents: "none" }}>
                        <span>Hover to scroll</span><span>Click to open ↗</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#9aa3b2", fontSize: 12.5, padding: 16, textAlign: "center" }}>
                      Live preview appears once a demo store is set.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "auto" }}>
                  <Btn tone="lime" small onClick={() => setCreating(t)}>Create store with this</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!canPreview && sites !== null && (
        <div style={{ fontSize: 12.5, color: "#8a6d2f", background: "#fff7e6", border: "1px solid #f0d9a8", borderRadius: 8, padding: "10px 12px", marginTop: 14 }}>
          Set <code>VITE_DEMO_STORE</code> to a live store slug (with products) in the portal's build settings to show demo products in every preview.
        </div>
      )}

      {chosen && (
        <Modal title={chosen.name} onClose={() => setChosen(null)}>
          <div style={{ fontSize: 12.5, color: "#6b7688", marginBottom: 16 }}>{chosen.description}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a href={previewUrl(chosen.id)} target="_blank" rel="noreferrer" onClick={() => setChosen(null)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", border: "1px solid #d4d9e3", borderRadius: 10, padding: "11px 14px", fontSize: 14, fontWeight: 600, color: "#1b2230" }}>
              Open full live preview <ExternalLink size={15} />
            </a>
            <Btn tone="lime" onClick={() => { setCreating(chosen); setChosen(null); }}>Create store with this layout</Btn>
          </div>
        </Modal>
      )}

      {creating && <CreateWithLayout template={creating} onClose={() => setCreating(null)} onCreated={onCreated} />}
    </div>
  );
}

function CreateWithLayout({ template, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function create() {
    if (!name.trim()) { setError(new Error("Store name required")); return; }
    setBusy(true); setError(null);
    try {
      const r = await api.createHostedSite(name.trim());
      const id = r.site?.id;
      // Hand-built templates are applied by saving { sections:[], preset:id }.
      if (id) await api.saveHostedSiteSettings(id, { sections: [], preset: template.id });
      onClose();
      onCreated?.();
    } catch (e) { setError(e); setBusy(false); }
  }

  return (
    <Modal title={`Create a store with “${template.name}”`} onClose={onClose}>
      <ErrorNote error={error} />
      <div style={{ fontSize: 12.5, color: "#6b7688", marginBottom: 12 }}>
        We'll create a new draft storefront with the <strong>{template.name}</strong> layout applied. You can add products, branding and everything else next — and switch layouts any time.
      </div>
      <Field label="Store name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your store name" autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn tone="lime" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create storefront"}</Btn>
        <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}
