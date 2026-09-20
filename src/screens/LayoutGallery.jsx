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
  const [previewId, setPreviewId] = useState(null); // which layout is expanded to a live preview
  const [creating, setCreating] = useState(null);    // template being created (modal)

  useEffect(() => { api.myHostedSites().then((r) => setSites(r.sites || [])).catch(() => setSites([])); }, []);

  const demo = import.meta.env.VITE_DEMO_STORE || "";
  const pv = sites && sites[0];
  function previewUrl(id) {
    let base;
    if (pv) base = storeUrl(pv.slug);
    else if (demo) base = storeUrl(demo);
    else return null;
    let u = base + (base.includes("?") ? "&" : "?") + "preset=" + encodeURIComponent(id);
    if (pv?.preview_password) u += "&preview_pw=" + encodeURIComponent(pv.preview_password);
    return u;
  }
  const canPreview = !!(pv || demo);

  return (
    <div>
      <PageHead title="Store layouts" sub="Pick a ready-made design for your storefront. Preview each one live, then create your store with it in one click — you can switch layouts any time." />

      {sites === null ? <Spinner /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {TEMPLATES.map((t) => {
            const open = previewId === t.id;
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

                {open && url && (
                  <div style={{ border: "1px solid #e6e9f0", borderRadius: 10, overflow: "hidden", height: 380, background: "#fff" }}>
                    <iframe key={t.id} title={`${t.name} preview`} src={url} style={{ width: "100%", height: "100%", border: "none" }} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
                  <Btn tone="lime" small onClick={() => setCreating(t)}>Create store with this</Btn>
                  {canPreview ? (
                    <Btn tone="ghost" small onClick={() => setPreviewId(open ? null : t.id)}>{open ? "Hide preview" : "Live preview"}</Btn>
                  ) : null}
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "#3b6fd8", textDecoration: "none", alignSelf: "center" }}>
                      Open ↗
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!canPreview && sites !== null && (
        <div style={{ fontSize: 12.5, color: "#6b7688", marginTop: 14 }}>
          Create your first store to see live previews filled with your own products.
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
