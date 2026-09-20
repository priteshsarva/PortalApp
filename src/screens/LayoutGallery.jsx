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

export default function LayoutGallery({ onCreated }) {
  const [sites, setSites] = useState(null);
  const [creating, setCreating] = useState(null);    // template being created (modal)

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
      <PageHead title="Store layouts" sub="Every layout shown live with demo products. Pick one and create your store with it in a click — you can switch layouts any time." />

      {sites === null ? <Spinner /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {TEMPLATES.map((t) => {
            const url = previewUrl(t.id);
            return (
              <Card key={t.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5 }}>{t.name}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#3b6fd8", background: "#eef6ff", border: "1px solid #cfe0fb", borderRadius: 999, padding: "2px 9px" }}>{t.tag}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#6b7688", marginTop: 7, minHeight: 54, lineHeight: 1.5 }}>{t.description}</div>
                </div>

                {/* live preview — always on, non-interactive (click "Open full
                    preview" to explore). Shows the layout with demo products. */}
                <div style={{ border: "1px solid #e6e9f0", borderRadius: 10, overflow: "hidden", height: 320, background: "#fff", position: "relative" }}>
                  {url ? (
                    <iframe key={t.id} title={`${t.name} preview`} src={url} loading="lazy" tabIndex={-1}
                      style={{ border: "none", width: "100%", height: "100%", pointerEvents: "none" }} />
                  ) : (
                    <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#9aa3b2", fontSize: 12.5, padding: 16, textAlign: "center" }}>
                      Live preview appears once a demo store is set.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto", alignItems: "center" }}>
                  <Btn tone="lime" small onClick={() => setCreating(t)}>Create store with this</Btn>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "#3b6fd8", textDecoration: "none" }}>
                      Open full preview <ExternalLink size={12} />
                    </a>
                  )}
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
