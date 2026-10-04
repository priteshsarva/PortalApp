// Submit a shipment leg: parcel photos (2-10) and/or courier tracking. Shared by
// the retailer (leg 'retailer_to_customer') and the wholesaler
// ('wholesaler_to_retailer' / 'wholesaler_to_customer').
//
// Photos are proof for releasing platform-held money; a tracking number is proof
// the parcel left. Either is accepted here — the SERVER decides which an order
// actually needs (it still demands photos while money is held) and its message
// is shown as-is. Pass `existing` to edit a shipment's courier details instead,
// which is the normal case: the AWB arrives hours after pickup.
import React, { useState } from "react";
import { X } from "lucide-react";
import { api } from "../api.js";
import { Btn, Field, inputStyle, ErrorNote } from "../ui.jsx";

const LEG_LABEL = { retailer_to_customer: "to the customer", wholesaler_to_retailer: "to the retailer", wholesaler_to_customer: "to the customer" };

export default function ShipmentModal({ orderId, orderNo, leg, existing = null, onClose, onDone }) {
  const editing = !!existing;
  const [photos, setPhotos] = useState([]); // [{url,key}]
  const [courier, setCourier] = useState(existing?.courier || "");
  const [tracking, setTracking] = useState(existing?.tracking_no || "");
  const [trackUrl, setTrackUrl] = useState(existing?.tracking_url || "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const hasProof = editing || photos.length >= 2 || tracking.trim() !== "";

  async function onPick(e) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true); setError(null);
    try { const r = await api.uploadShipmentPhotos(files); setPhotos((p) => [...p, ...(r.files || [])].slice(0, 10)); }
    catch (err) { setError(err); } finally { setUploading(false); e.target.value = ""; }
  }
  async function submit() {
    if (!hasProof) { setError(new Error("Add a tracking number, or 2 parcel photos.")); return; }
    setBusy(true); setError(null);
    const fields = {
      courier: courier.trim() || undefined,
      tracking_no: tracking.trim() || undefined,
      tracking_url: trackUrl.trim() || undefined,
    };
    try {
      if (editing) await api.updateShipment(existing.id, fields);
      else await api.submitShipment({ order_id: orderId, leg, ...fields, photos });
      onDone();
    } catch (e) { setError(e); setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,25,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: "min(480px,100%)", margin: "24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{editing ? "Courier & tracking" : "Submit shipment"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9aa3b2" }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: "#6b7688", marginBottom: 12 }}>
          {editing
            ? `Order ${orderNo}. The tracking number and link are shown to the buyer in their account and emailed to them once.`
            : `Order ${orderNo} · shipping ${LEG_LABEL[leg] || ""}. Enter the courier tracking, or upload 2–10 parcel photos as proof — funds release after admin approval.`}
        </div>
        <ErrorNote error={error} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Courier"><input style={inputStyle} value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Delhivery / JD Web & Ship" /></Field>
          <Field label="Tracking number"><input style={inputStyle} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="AWB / docket no." /></Field>
        </div>
        <Field label="Tracking link (optional)">
          <input style={inputStyle} value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} placeholder="https://… the courier's tracking page" />
        </Field>
        {!editing && (
          <Field label={`Parcel photos (${photos.length}/10)`}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", border: "1px dashed #b7c0cf", borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "#42505f" }}>
              <input type="file" accept="image/*" multiple onChange={onPick} style={{ display: "none" }} />
              {uploading ? "Uploading…" : "⬆ Add photos"}
            </label>
            {photos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: "relative", width: 54, height: 54, borderRadius: 6, overflow: "hidden", border: "1px solid #e6e9f0" }}>
                    <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                    <button onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))} style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: "2px 5px" }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </Field>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn tone="lime" onClick={submit} disabled={busy || uploading || !hasProof}>{busy ? "Saving…" : editing ? "Save tracking" : "Submit shipment"}</Btn>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}
