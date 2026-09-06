// Wholesale (supplier) screen. Three states:
//   no account  -> application form
//   pending     -> "under review"
//   active      -> my listings (add / edit / stock / pause) + re-verify banner
// Images are entered as URLs for now (R2 upload arrives with the storage wiring).
import React, { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Field, inputStyle, Spinner, ErrorNote, Empty, Badge, fmtDate } from "../ui.jsx";

const PRIMARY_CATS = ["shoes", "watches", "clothing", "accessories", "home", "electronics", "beauty", "other"];

export default function Wholesale() {
  const [me, setMe] = useState(undefined); // undefined=loading, null=no account, obj=account
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try { setMe((await api.wholesaleMe()).wholesaler); }
    catch (e) { setError(e); setMe(null); }
  }
  useEffect(() => { load(); }, []);

  if (me === undefined) return <div><PageHead title="Wholesale" /><Spinner /></div>;
  if (error && !me) return <div><PageHead title="Wholesale" /><ErrorNote error={error} /></div>;
  if (!me) return <ApplyForm onDone={load} />;

  const status = me.enrollment_status;
  return (
    <div>
      <PageHead title="Wholesale" sub={`${me.business_name} · supplier account`} />
      {status === "pending" && (
        <Card style={{ background: "#fff8e6", border: "1px solid #f0d98a" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Your application is under review</div>
          <div style={{ fontSize: 13, color: "#6b7688" }}>We'll email you once it's approved. You can prepare listings now; they go live to retailers after approval.</div>
        </Card>
      )}
      {status === "rejected" && (
        <Card style={{ background: "#fdecef", border: "1px solid #f3c2cc" }}>
          <div style={{ fontWeight: 700, color: "#a23a4b" }}>Application not approved</div>
          <div style={{ fontSize: 13, color: "#6b7688" }}>Contact support if you think this is a mistake.</div>
        </Card>
      )}
      <Listings owner={me} />
    </div>
  );
}

function ApplyForm({ onDone }) {
  const [f, setF] = useState({ business_name: "", gst_number: "", phone: "", whatsapp: "", about: "", ships_from: "", min_order_qty: 1, categories: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleCat = (c) => setF((s) => ({ ...s, categories: s.categories.includes(c) ? s.categories.filter((x) => x !== c) : [...s.categories, c] }));

  async function submit() {
    if (!f.business_name.trim()) { setError(new Error("Business name is required")); return; }
    setBusy(true); setError(null);
    try { await api.wholesaleApply({ ...f, min_order_qty: Number(f.min_order_qty) || 1 }); onDone(); }
    catch (e) { setError(e); setBusy(false); }
  }

  return (
    <div>
      <PageHead title="Become a wholesaler" sub="List your products on the platform. Retailers pick you as a source and sell your products in their stores — you ship, they handle the customer." />
      <Card style={{ maxWidth: 640 }}>
        <ErrorNote error={error} />
        <Field label="Business name"><input style={inputStyle} value={f.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="Acme Wholesale" autoFocus /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="GST number (optional)"><input style={inputStyle} value={f.gst_number} onChange={(e) => set("gst_number", e.target.value)} /></Field>
          <Field label="Ships from (city)"><input style={inputStyle} value={f.ships_from} onChange={(e) => set("ships_from", e.target.value)} /></Field>
          <Field label="Phone"><input style={inputStyle} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="WhatsApp"><input style={inputStyle} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
          <Field label="Minimum order qty (MOQ)"><input style={inputStyle} value={f.min_order_qty} onChange={(e) => set("min_order_qty", e.target.value)} inputMode="numeric" /></Field>
        </div>
        <Field label="What do you sell?">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRIMARY_CATS.map((c) => (
              <button key={c} type="button" onClick={() => toggleCat(c)}
                style={{ textTransform: "capitalize", border: f.categories.includes(c) ? "1px solid #16361b" : "1px solid #d4d9e3", background: f.categories.includes(c) ? "#16361b" : "#fff", color: f.categories.includes(c) ? "#C8FF3D" : "#42505f", padding: "5px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer" }}>
                {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="About your business"><textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} value={f.about} onChange={(e) => set("about", e.target.value)} placeholder="Tell retailers what makes your catalogue worth stocking." /></Field>
        <Btn tone="lime" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit application"}</Btn>
      </Card>
    </div>
  );
}

function Listings({ owner }) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // product object, or "new", or null

  function load() {
    setError(null);
    api.wholesaleProducts().then((r) => setProducts(r.products || [])).catch(setError);
  }
  useEffect(load, []);

  const needsReview = (products || []).filter((p) => p.listing_status === "needs_review");

  async function reverifyAll() {
    try { await api.wholesaleReverify(needsReview.map((p) => p.id)); load(); } catch (e) { alert(e.message); }
  }
  async function del(p) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try { await api.wholesaleDeleteProduct(p.id); load(); } catch (e) { alert(e.message); }
  }

  return (
    <Card style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>My listings {products ? `(${products.length})` : ""}</div>
        <Btn tone="lime" small onClick={() => setEditing("new")}><Plus size={14} style={{ verticalAlign: "-2px" }} /> Add product</Btn>
      </div>

      {needsReview.length > 0 && (
        <div style={{ background: "#fff8e6", border: "1px solid #f0d98a", borderRadius: 9, padding: "10px 13px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#7a5a00" }}>{needsReview.length} listing(s) need re-verification (stock &amp; details). They're hidden until confirmed.</span>
          <Btn small tone="lime" onClick={reverifyAll}>Confirm all still accurate</Btn>
        </div>
      )}

      <ErrorNote error={error} />
      {!products ? <Spinner /> : products.length === 0 ? <Empty msg="No products yet. Add your first listing." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {products.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #eef1f6", borderRadius: 10, padding: "9px 12px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f2f4f8", flexShrink: 0, overflow: "hidden" }}>
                {p.thumbnail && <img src={p.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "#6b7688" }}>₹{Number(p.price).toLocaleString("en-IN")} · {p.primary_cat || "—"}/{p.sub || "—"} · stock {p.stock_qty ?? "∞"}</div>
              </div>
              <StatusChip p={p} />
              <button onClick={() => setEditing(p)} style={{ background: "none", border: "1px solid #d4d9e3", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Edit</button>
              <button onClick={() => del(p)} title="Delete" style={{ background: "none", border: "none", color: "#b23a48", cursor: "pointer" }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {editing && <ProductModal owner={owner} product={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </Card>
  );
}

function StatusChip({ p }) {
  const map = {
    active: p.available ? ["#e8f7ee", "#14663a", "Live"] : ["#fff6e5", "#8a6100", "Out of stock"],
    paused: ["#f1f3f7", "#6b7688", "Paused"],
    needs_review: ["#fff8e6", "#7a5a00", "Needs review"],
    rejected: ["#fdecef", "#a23a4b", "Rejected"],
  };
  const [bg, fg, label] = map[p.listing_status] || map.paused;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{label}</span>;
}

function ProductModal({ owner, product, onClose, onDone }) {
  const isNew = !product;
  const [f, setF] = useState({
    name: product?.name || "", price: product?.price || "", mrp: product?.mrp || "",
    primary_cat: product?.primary_cat || (owner.categories?.[0] || "shoes"), sub: product?.sub || "",
    brand: product?.brand || "", sizes: (product?.sizes || []).join(", "), stock_qty: product?.stock_qty ?? "",
    description: product?.description || "", sku: product?.sku || "", moq: product?.moq || owner.min_order_qty || 1,
    images: product?.images?.length ? product.images : [""], listing_status: product?.listing_status || "active",
  });
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    api.taxonomy(f.primary_cat).then((r) => setSubs((r.taxonomy || []).filter((t) => t.primary_cat === f.primary_cat))).catch(() => setSubs([]));
  }, [f.primary_cat]);

  const setImg = (i, v) => setF((s) => { const images = [...s.images]; images[i] = v; return { ...s, images }; });
  const addImg = () => setF((s) => ({ ...s, images: [...s.images, ""] }));
  const rmImg = (i) => setF((s) => ({ ...s, images: s.images.filter((_, j) => j !== i) }));

  async function proposeSub() {
    const label = prompt(`New sub-category under "${f.primary_cat}":`);
    if (!label) return;
    try { const r = await api.proposeTaxonomy(f.primary_cat, label); setF((s) => ({ ...s, sub: r.sub.sub_slug })); api.taxonomy(f.primary_cat).then((x) => setSubs((x.taxonomy || []).filter((t) => t.primary_cat === f.primary_cat))); }
    catch (e) { alert(e.message); }
  }

  async function submit() {
    const images = f.images.map((s) => s.trim()).filter(Boolean);
    if (!f.name.trim() || f.price === "") { setError(new Error("Name and price are required")); return; }
    if (!images.length) { setError(new Error("Add at least one image URL")); return; }
    setBusy(true); setError(null);
    const body = {
      name: f.name, price: Number(f.price), mrp: f.mrp === "" ? undefined : Number(f.mrp),
      primary_cat: f.primary_cat, sub: f.sub || undefined, brand: f.brand || undefined,
      sizes: f.sizes.split(",").map((s) => s.trim()).filter(Boolean),
      stock_qty: f.stock_qty === "" ? undefined : Number(f.stock_qty),
      description: f.description || undefined, sku: f.sku || undefined, moq: Number(f.moq) || undefined,
      images, listing_status: f.listing_status,
    };
    try {
      if (isNew) await api.wholesaleCreateProduct(body);
      else await api.wholesaleUpdateProduct(product.id, body);
      onDone();
    } catch (e) { setError(e); setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,25,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: "min(560px, 100%)", margin: "24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{isNew ? "Add product" : "Edit product"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9aa3b2" }}><X size={18} /></button>
        </div>
        <ErrorNote error={error} />
        <Field label="Product name"><input style={inputStyle} value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Wholesale price (₹)"><input style={inputStyle} value={f.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" /></Field>
          <Field label="MRP (₹, optional)"><input style={inputStyle} value={f.mrp} onChange={(e) => set("mrp", e.target.value)} inputMode="decimal" /></Field>
          <Field label="Primary category">
            <select style={inputStyle} value={f.primary_cat} onChange={(e) => { set("primary_cat", e.target.value); set("sub", ""); }}>
              {PRIMARY_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Sub-category">
            <div style={{ display: "flex", gap: 6 }}>
              <select style={{ ...inputStyle, flex: 1 }} value={f.sub} onChange={(e) => set("sub", e.target.value)}>
                <option value="">— select —</option>
                {subs.map((t) => <option key={t.id} value={t.sub_slug}>{t.sub_label}{t.status === "proposed" ? " (pending)" : ""}</option>)}
              </select>
              <button type="button" onClick={proposeSub} title="Propose a new sub-category" style={{ border: "1px solid #d4d9e3", background: "#fff", borderRadius: 8, padding: "0 10px", cursor: "pointer" }}>+</button>
            </div>
          </Field>
          <Field label="Brand"><input style={inputStyle} value={f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Stock quantity"><input style={inputStyle} value={f.stock_qty} onChange={(e) => set("stock_qty", e.target.value)} inputMode="numeric" placeholder="blank = unlimited" /></Field>
          <Field label="Sizes (comma-separated)"><input style={inputStyle} value={f.sizes} onChange={(e) => set("sizes", e.target.value)} placeholder="8, 9, 10" /></Field>
          <Field label="SKU"><input style={inputStyle} value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
          <Field label="MOQ (min order qty)"><input style={inputStyle} value={f.moq} onChange={(e) => set("moq", e.target.value)} inputMode="numeric" /></Field>
          <Field label="Listing status">
            <select style={inputStyle} value={f.listing_status} onChange={(e) => set("listing_status", e.target.value)}>
              <option value="active">Active (live)</option>
              <option value="paused">Paused (hidden)</option>
            </select>
          </Field>
        </div>
        <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Image URLs">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {f.images.map((url, i) => (
              <div key={i} style={{ display: "flex", gap: 6 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={url} onChange={(e) => setImg(i, e.target.value)} placeholder="https://…/image.jpg" />
                {f.images.length > 1 && <button type="button" onClick={() => rmImg(i)} style={{ border: "1px solid #d4d9e3", background: "#fff", borderRadius: 8, padding: "0 10px", cursor: "pointer", color: "#b23a48" }}>×</button>}
              </div>
            ))}
            <button type="button" onClick={addImg} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#3b6fd8", fontSize: 12.5, cursor: "pointer" }}>+ Add another image</button>
          </div>
        </Field>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn tone="lime" onClick={submit} disabled={busy}>{busy ? "Saving…" : isNew ? "Add product" : "Save changes"}</Btn>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}
