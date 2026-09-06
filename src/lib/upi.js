// UPI deep link + "I've paid" WhatsApp message for the platform's own billing
// (vendors paying their plan invoice by UPI). Mirrors the storefront helper.
export function upiLink({ upiId, upiName, amount, ref }) {
  const p = new URLSearchParams({
    pa: upiId, pn: upiName || "Server Products",
    am: String(amount), cu: "INR", tn: ref || "",
  });
  return "upi://pay?" + p.toString();
}

export function payWhatsAppUrl({ whatsapp, invoiceNo, amount, utr }) {
  const inr = "₹" + Math.round(Number(amount) || 0).toLocaleString("en-IN");
  const lines = [
    "Hi! 👋",
    `I've paid invoice *${invoiceNo}* — ${inr} by UPI.`,
    utr ? `UTR / reference: *${utr}*` : "",
    "Sending my payment screenshot now 📸",
  ].filter(Boolean);
  const phone = String(whatsapp || "").replace(/[^\d]/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}
