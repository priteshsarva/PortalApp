// Floating "Ask on WhatsApp" button. On the public search page it's the way a
// stranger starts a conversation; inside the portal it prefills who is writing,
// so the assistant already knows the client and their store.
import React from "react";
import { MessageCircle } from "lucide-react";

const NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919106785898";

export default function AskOnWhatsApp({ user, context }) {
  const who = user ? `Hi, ${user.name || user.email || "I'm a Kartify client"} here.` : "Hi, I saw Kartify online.";
  const text = `${who}${context ? ` ${context}` : ""} `;
  const href = `https://wa.me/${NUMBER}?text=${encodeURIComponent(text)}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label="Ask on WhatsApp"
      style={{
        // bottom-LEFT on purpose: the ₹499 setup popup lives in the bottom-right corner
        position: "fixed", left: 18, bottom: 18, zIndex: 60, display: "flex", alignItems: "center", gap: 8,
        background: "#25D366", color: "#0b2b16", fontWeight: 700, fontSize: 13.5,
        padding: "11px 16px", borderRadius: 999, textDecoration: "none",
        boxShadow: "0 6px 20px rgba(0,0,0,.22)",
      }}>
      <MessageCircle size={18} />
      Ask on WhatsApp
    </a>
  );
}
