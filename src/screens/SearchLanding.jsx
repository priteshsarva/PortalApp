// Public, login-free catalogue-search landing — the entry point for new users.
//   anonymous: 3 free searches (by device) -> signup popup
//   signed in (mobile+OTP): 50 free searches -> ₹100/mo search plan modal
// A "search" = a new keyword; filter tweaks and "load more" don't cost one.
import React, { useEffect, useRef, useState } from "react";
import { Search, ExternalLink, KeyRound, PlusCircle, X } from "lucide-react";
import { api, setToken, getToken } from "../api.js";
import { firebaseEnabled, makeRecaptcha, sendPhoneOtp } from "../lib/firebase.js";

const C = { ink: "#0E1726", lime: "#c4f000", paper: "#f6f7f9" };
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const input = { width: "100%", boxSizing: "border-box", padding: "11px 13px", border: "1px solid #d8dee8", borderRadius: 10, fontSize: 14, outline: "none" };

export default function SearchLanding({ onSignedIn, onSignIn }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("in");        // default: show available products
  const [sort, setSort] = useState("newest");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [source, setSource] = useState("");
  const [sources, setSources] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quota, setQuota] = useState(null);
  const [me, setMe] = useState(null);              // set after OTP signup this session
  const [modal, setModal] = useState("");          // "" | signup | plan | source
  const signedIn = !!getToken();

  useEffect(() => { api.searchSources().then((r) => setSources(r.sources || [])).catch(() => {}); }, []);

  function run(reset) {
    const p = reset ? 1 : page + 1;
    setLoading(true); setError("");
    const params = {
      ...(q && { q }), ...(category && { category }), ...(stock && { stock }),
      ...(sort && sort !== "newest" && { sort }), ...(brand && { brand }), ...(size && { size }),
      ...(source && { source }), ...(priceMin && { price_min: priceMin }), ...(priceMax && { price_max: priceMax }),
      page: p, limit: 24,
    };
    api.searchCatalogue(params)
      .then((r) => {
        setItems((prev) => (reset ? r.results : [...prev, ...r.results]));
        setHasMore(r.hasMore); setPage(p);
        if (r.quota) setQuota(r.quota);
      })
      .catch((e) => {
        const need = e.data?.need;
        if (e.status === 403 && need === "signup") setModal("signup");
        else if (e.status === 403 && need === "plan") setModal("plan");
        else setError(e.message);
        if (e.data?.quota) setQuota(e.data.quota);
      })
      .finally(() => setLoading(false));
  }
  // debounce on filter change (searching + browsing are free — nothing counts here)
  useEffect(() => { const t = setTimeout(() => run(true), 350); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, category, stock, sort, brand, size, source, priceMin, priceMax]);
  function clearAll() { setQ(""); setCategory(""); setStock("in"); setSort("newest"); setBrand(""); setSize(""); setSource(""); setPriceMin(""); setPriceMax(""); }
  const activeFilters = [category, size, brand, source, priceMin, priceMax].filter(Boolean).length + (stock !== "in" ? 1 : 0) + (sort !== "newest" ? 1 : 0);
  const SORTS = [["newest", "Newest"], ["price_asc", "Price: low → high"], ["price_desc", "Price: high → low"], ["name", "Name A–Z"]];

  // Called after OTP verify / profile completion — unlock searching right away.
  function afterAuth(user) {
    setMe(user || {});
    api.searchQuota().then((r) => setQuota(r.quota)).catch(() => {});
    run(true);
  }

  // Opening a product counts as a search; blocked when the free allowance runs out.
  function openProduct(p) {
    api.searchConsume(`${p.category}:${p.productId}`)
      .then((r) => { if (r.quota) setQuota(r.quota); window.open(p.product_url, "_blank", "noopener"); })
      .catch((e) => {
        if (e.data?.quota) setQuota(e.data.quota);
        const need = e.data?.need;
        if (e.status === 403 && need === "signup") setModal("signup");
        else if (e.status === 403 && need === "plan") setModal("plan");
        else window.open(p.product_url, "_blank", "noopener"); // non-quota error: don't block the click
      });
  }

  const remaining = quota && quota.remaining;
  const unlimited = quota && quota.unlimited;

  return (
    <div style={{ minHeight: "100vh", background: C.paper, fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#1b2230" }}>
      {/* header */}
      <header style={{ background: C.ink, color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.lime, display: "grid", placeItems: "center" }}><KeyRound size={17} color={C.ink} /></div>
        <strong style={{ fontSize: 16 }}>Server Products</strong>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setModal("plan")} style={{ background: "none", color: "#fff", border: "1px solid #33405a", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Plans</button>
          {(me || signedIn)
            ? <button onClick={() => onSignedIn(me || {})} style={{ background: C.lime, color: C.ink, border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>My dashboard →</button>
            : <button onClick={onSignIn} style={{ background: "none", color: "#fff", border: "1px solid #33405a", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Sign in</button>}
        </div>
      </header>

      {/* hero + search */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "6px 0 6px" }}>Search the product catalogue</h1>
          <p style={{ color: "#6b7688", fontSize: 14.5, margin: 0 }}>Every product across all our source sites — find what you can sell, then open the supplier page.</p>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e6e9f0", borderRadius: 14, padding: 14, boxShadow: "0 6px 22px rgba(15,23,38,0.05)" }}>
          {/* row 1: search + category + stock + sort */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#9aa3b2" }} />
              <input autoFocus style={{ ...input, paddingLeft: 36 }} placeholder="Search by product name or brand…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select style={{ ...input, width: "auto", minWidth: 130 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option><option value="watches">Watches</option><option value="shoes">Shoes</option>
            </select>
            <select style={{ ...input, width: "auto", minWidth: 120 }} value={stock} onChange={(e) => setStock(e.target.value)}>
              <option value="in">In stock</option><option value="">All stock</option><option value="out">Out of stock</option>
            </select>
            <select style={{ ...input, width: "auto", minWidth: 150 }} value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {/* row 2: brand + size + source + price + clear */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
            <input style={{ ...input, width: 150 }} placeholder="Brand (e.g. Rolex)" value={brand} onChange={(e) => setBrand(e.target.value)} />
            <input style={{ ...input, width: 100 }} placeholder="Size" value={size} onChange={(e) => setSize(e.target.value)} />
            <select style={{ ...input, width: "auto", minWidth: 160 }} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All sources</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
            </select>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input style={{ ...input, width: 90 }} type="number" placeholder="₹ min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
              <span style={{ color: "#9aa3b2" }}>–</span>
              <input style={{ ...input, width: 90 }} type="number" placeholder="₹ max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
            </div>
            {activeFilters > 0 && <button onClick={clearAll} style={{ background: "none", border: "none", color: "#3b6fd8", fontSize: 12.5, cursor: "pointer" }}>Clear filters ({activeFilters})</button>}
          </div>
          {/* row 3: add-source + quota */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={() => (signedIn ? setModal("source") : setModal("signup"))}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#eef7d6", color: "#4a5a00", border: "1px solid #d7e89a", borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <PlusCircle size={15} /> Add Selloship or JDWebnship sites
            </button>
            {quota && (
              <span style={{ marginLeft: "auto", fontSize: 13, color: unlimited ? "#14663a" : "#6b7688" }}>
                {unlimited ? "✓ Unlimited views (Pro plan active)"
                  : `${remaining ?? 0} free product ${remaining === 1 ? "view" : "views"} left`}
              </span>
            )}
          </div>
        </div>

        {error && <div style={{ background: "#fdecec", border: "1px solid #f3c2c2", color: "#b23a48", padding: "9px 13px", borderRadius: 9, margin: "14px 0", fontSize: 13 }}>{error}</div>}

        {/* results */}
        <div style={{ marginTop: 20 }}>
          {loading && items.length === 0 ? (
            <div style={{ textAlign: "center", color: "#9aa3b2", padding: 40 }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", color: "#9aa3b2", padding: 40 }}>No products match — try another search.</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
                {items.map((p) => (
                  <div key={`${p.category}-${p.productId}`} onClick={() => openProduct(p)} title="Open supplier page"
                    style={{ border: "1px solid #e6e9f0", borderRadius: 12, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column", cursor: "pointer" }}>
                    <div style={{ aspectRatio: "1/1", background: "#f4f5f8", position: "relative" }}>
                      {p.image ? <img src={p.image} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#c4ccd8", fontSize: 12 }}>No image</div>}
                      {!p.in_stock && <span style={{ position: "absolute", top: 8, left: 8, background: "#d92d20", color: "#fff", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4 }}>Out of stock</span>}
                      <span style={{ position: "absolute", top: 8, right: 8, background: "#fff", color: "#42505f", fontSize: 10, padding: "2px 7px", borderRadius: 4, textTransform: "capitalize" }}>{p.category}</span>
                    </div>
                    <div style={{ padding: 11, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                      {p.brand && <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, color: "#9aa3b2" }}>{p.brand}</div>}
                      <div style={{ fontSize: 12.5, lineHeight: 1.35, minHeight: 34, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.name}</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{inr(p.original_price)}</div>
                      {p.sizes.length > 0 && <div style={{ fontSize: 10.5, color: "#6b7688" }}>Sizes: {p.sizes.slice(0, 8).join(", ")}</div>}
                      <span style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#3b6fd8", paddingTop: 6 }}>
                        View product <ExternalLink size={12} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <div style={{ textAlign: "center", marginTop: 22 }}>
                  <button onClick={() => (signedIn ? run(false) : setModal("signup"))} disabled={loading} style={{ border: `1px solid ${C.ink}`, background: signedIn ? "#fff" : C.ink, color: signedIn ? C.ink : "#fff", padding: "9px 22px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: signedIn ? 400 : 700 }}>
                    {loading ? "Loading…" : signedIn ? "Load more" : "Sign in to see more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modal === "signup" && <SignupModal onClose={() => setModal("")} onAuthed={afterAuth} onSignIn={onSignIn} />}
      {modal === "plan" && <PlanModal onClose={() => setModal("")} signedIn={signedIn} onNeedSignup={() => setModal("signup")}
        onGranted={() => api.searchQuota().then((r) => setQuota(r.quota)).catch(() => {})} />}
      {modal === "source" && <AddSourceModal onClose={() => setModal("")} />}
    </div>
  );
}

// ---- shared modal shell ----
function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(14,23,38,0.5)", display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 26, width: "100%", maxWidth: 400, position: "relative" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "#9aa3b2" }}><X size={18} /></button>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 6px" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ---- mobile + OTP signup (grants 50 free searches), then optional details ----
function SignupModal({ onClose, onAuthed, onSignIn }) {
  const [step, setStep] = useState("mobile");   // mobile | code | details
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const recaptchaRef = useRef(null);       // firebase invisible reCAPTCHA
  const confirmRef = useRef(null);         // firebase confirmationResult

  async function send() {
    setBusy(true); setErr("");
    try {
      if (firebaseEnabled) {
        if (!recaptchaRef.current) recaptchaRef.current = makeRecaptcha("recaptcha-container");
        confirmRef.current = await sendPhoneOtp(mobile, recaptchaRef.current);
        setStep("code");
      } else {
        const r = await api.otpSend(mobile); if (r.dev_code) setDevCode(r.dev_code); setStep("code");
      }
    } catch (e) {
      try { recaptchaRef.current?.clear?.(); } catch { /* ignore */ }
      recaptchaRef.current = null;         // rebuild reCAPTCHA on retry
      setErr(e.message);
    } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setErr("");
    try {
      let r;
      if (firebaseEnabled) {
        const cred = await confirmRef.current.confirm(code);
        r = await api.firebaseAuth(await cred.user.getIdToken());
      } else {
        r = await api.otpVerify(mobile, code);
      }
      setToken(r.token);          // authed now — searching is unlocked
      onAuthed(r.user);
      if (r.profile_complete) onClose();   // returning user, nothing to fill
      else setStep("details");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function saveDetails() {
    setBusy(true); setErr("");
    try { const r = await api.completeProfile({ name, email: email || undefined, password: password || undefined }); onAuthed(r.user); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const title = step === "details" ? "You're in — 50 free searches" : "Get 50 free searches";
  return (
    <Modal title={title} onClose={onClose}>
      {err && <div style={{ background: "#fdecec", color: "#b23a48", padding: "8px 11px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
      {step === "mobile" && (
        <>
          <p style={{ color: "#6b7688", fontSize: 13.5, margin: "0 0 16px" }}>Sign up with your mobile number — no password needed. It takes a few seconds.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...input, width: "auto", flex: "0 0 auto", background: "#f4f5f8", color: "#6b7688" }}>+91</span>
            <input style={input} placeholder="10-digit mobile number" value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric" maxLength={10} />
          </div>
          <button onClick={send} disabled={busy || mobile.length !== 10} style={btnPrimary}>{busy ? "Sending…" : "Send OTP"}</button>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12.5, color: "#6b7688" }}>
            Already have an account? <button onClick={onSignIn} style={{ background: "none", border: "none", color: "#3b6fd8", cursor: "pointer", fontSize: 12.5, padding: 0 }}>Sign in</button>
          </div>
        </>
      )}
      {step === "code" && (
        <>
          <p style={{ color: "#6b7688", fontSize: 13.5, margin: "0 0 16px" }}>Enter the 6-digit code we sent to +91 {mobile}.</p>
          <input style={input} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
          {devCode && <div style={{ fontSize: 12, color: "#8a6100", marginTop: 6 }}>Dev code: <strong>{devCode}</strong></div>}
          <button onClick={verify} disabled={busy || code.length < 4} style={btnPrimary}>{busy ? "Verifying…" : "Verify & continue"}</button>
          <button onClick={() => setStep("mobile")} style={btnGhost}>Change number</button>
        </>
      )}
      {step === "details" && (
        <>
          <p style={{ color: "#6b7688", fontSize: 13.5, margin: "0 0 16px" }}>Your number is verified. Finish creating your account so you can also sign in with email later — or skip and keep searching.</p>
          <input style={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={{ ...input, marginTop: 10 }} type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={{ ...input, marginTop: 10 }} type="password" placeholder="Set a password (optional)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={saveDetails} disabled={busy} style={btnPrimary}>{busy ? "Saving…" : "Create account"}</button>
          <button onClick={onClose} style={btnGhost}>Skip for now</button>
        </>
      )}
      <div id="recaptcha-container" />
    </Modal>
  );
}

// ---- Plans: admin-managed plans, clickable -> pay via the admin UPI gateway ----
function PlanCard({ name, price, sub, perks, highlight, onChoose, chooseLabel }) {
  return (
    <div style={{ border: `1px solid ${highlight ? "#c9de7a" : "#e6e9f0"}`, background: highlight ? "#fbfff0" : "#fff", borderRadius: 11, padding: 13, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <strong style={{ fontSize: 15 }}>{name}</strong>
        <span style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap" }}>{price}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 2 }}>{sub}</div>}
      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", fontSize: 12.5, color: "#42505f" }}>
        {perks.filter(Boolean).map((p, i) => <li key={i} style={{ padding: "2px 0" }}>✓ {p}</li>)}
      </ul>
      {onChoose && <button onClick={onChoose} style={{ ...btnPrimary, marginTop: 10 }}>{chooseLabel || "Choose plan"}</button>}
    </div>
  );
}

function PlanModal({ onClose, signedIn, onNeedSignup, onGranted }) {
  const [plans, setPlans] = useState(null);
  const [chosen, setChosen] = useState(null);   // plan being paid for
  const [data, setData] = useState(null);        // { order, amount, upi }
  const [err, setErr] = useState("");
  const [claimed, setClaimed] = useState(false);
  const [granted, setGranted] = useState(false); // free plan activated instantly
  const [utr, setUtr] = useState("");

  useEffect(() => { api.searchPlans().then((r) => setPlans(r.plans || [])).catch((e) => setErr(e.message)); }, []);

  function choose(plan) {
    if (!signedIn) return onNeedSignup();
    setChosen(plan); setData(null); setErr("");
    api.searchPlanOrder(plan.id)
      .then((d) => { if (d.granted) { setGranted(true); onGranted && onGranted(); } else setData(d); })
      .catch((e) => setErr(e.message));
  }
  async function claim() { try { await api.searchPlanClaim(utr.trim()); setClaimed(true); } catch (e) { setErr(e.message); } }

  const upi = data?.upi || {};
  const amount = data?.amount ?? (chosen ? Number(chosen.price) : 0);
  const link = upi.upi_id ? `upi://pay?pa=${encodeURIComponent(upi.upi_id)}&pn=${encodeURIComponent(upi.upi_name || "Server Products")}&am=${amount}&cu=INR&tn=${encodeURIComponent("Search plan")}` : null;
  const per = (p) => `/ ${p.interval_count > 1 ? p.interval_count + " " : ""}${p.interval}${p.interval_count > 1 ? "s" : ""}`;
  const allowance = (p) => (p.limits && p.limits.search_views) ? `${p.limits.search_views} product views` : "Unlimited product views";

  return (
    <Modal title={chosen ? `Pay for ${chosen.name}` : "Plans"} onClose={onClose}>
      {err && <div style={{ background: "#fdecec", color: "#b23a48", padding: "8px 11px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
      {granted ? (
        <p style={{ fontSize: 13.5, color: "#14663a" }}>Your plan is active — enjoy your product views! <button onClick={onClose} style={{ background: "none", border: "none", color: "#3b6fd8", cursor: "pointer", fontSize: 13.5, padding: 0 }}>Start browsing</button></p>
      ) : claimed ? (
        <p style={{ fontSize: 13.5, color: "#14663a" }}>Thanks! We'll confirm your payment shortly and unlock your plan on your account.</p>
      ) : chosen ? (
        <>
          <button onClick={() => { setChosen(null); setData(null); }} style={{ background: "none", border: "none", color: "#3b6fd8", fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 10 }}>← All plans</button>
          {upi.upi_id ? (
            <>
              <div style={{ background: "#f6f7f9", border: "1px solid #e6e9f0", borderRadius: 10, padding: 14, textAlign: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{inr(amount)}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Pay to UPI: <strong>{upi.upi_id}</strong></div>
                <div style={{ fontSize: 12, color: "#6b7688" }}>{upi.upi_name}</div>
                {link && <a href={link} style={{ ...btnPrimary, display: "inline-block", textAlign: "center", textDecoration: "none", width: "auto", padding: "9px 18px" }}>Open UPI app</a>}
              </div>
              <input style={input} placeholder="UPI reference / UTR (optional)" value={utr} onChange={(e) => setUtr(e.target.value)} />
              <button onClick={claim} style={btnPrimary}>I've paid {inr(amount)}</button>
              <p style={{ fontSize: 11.5, color: "#8a93a3", marginTop: 8, textAlign: "center" }}>Your plan activates once we confirm the payment.</p>
            </>
          ) : <p style={{ fontSize: 13, color: "#8a6100" }}>Loading payment details… if this persists, the payment UPI isn't configured yet.</p>}
        </>
      ) : (
        <>
          <PlanCard name="Free" price="₹0" perks={["Unlimited search & browsing", "50 free product views", "Request new source sites"]} />
          {plans === null ? <p style={{ fontSize: 13, color: "#9aa3b2" }}>Loading plans…</p>
            : plans.length === 0 ? <p style={{ fontSize: 13, color: "#8a6100" }}>No paid plans available yet.</p>
            : plans.map((p) => (
              <PlanCard key={p.id} highlight name={p.name} price={Number(p.price) <= 0 ? "Free" : inr(p.price)} sub={Number(p.price) <= 0 ? null : per(p)}
                perks={[allowance(p), ...(Array.isArray(p.features) ? p.features : []), p.description]}
                onChoose={() => choose(p)} chooseLabel={!signedIn ? "Sign up to get" : Number(p.price) <= 0 ? "Get free" : `Choose ${p.name}`} />
            ))}
        </>
      )}
    </Modal>
  );
}

// ---- add a source site to be scraped into the catalogue ----
function AddSourceModal({ onClose }) {
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("shoes");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  async function submit() {
    setBusy(true); setErr("");
    try { await api.createScrapeRequest(url.trim(), category); setDone(true); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <Modal title="Add a source site" onClose={onClose}>
      {done ? (
        <p style={{ fontSize: 13.5, color: "#14663a" }}>Got it — we'll review the site and add its products to the catalogue soon.</p>
      ) : (
        <>
          <p style={{ color: "#6b7688", fontSize: 13.5, margin: "0 0 14px" }}>Paste a <strong>Selloship</strong> or <strong>JDWebnship</strong> storefront URL. We'll scrape it into the catalogue after a quick review.</p>
          {err && <div style={{ background: "#fdecec", color: "#b23a48", padding: "8px 11px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
          <input style={input} placeholder="https://store.selloship.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <select style={{ ...input, marginTop: 10 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="shoes">Shoes</option><option value="watches">Watches</option>
          </select>
          <button onClick={submit} disabled={busy || !url.trim()} style={btnPrimary}>{busy ? "Submitting…" : "Submit site"}</button>
        </>
      )}
    </Modal>
  );
}

const btnPrimary = { width: "100%", marginTop: 12, background: C.ink, color: "#fff", border: "none", borderRadius: 10, padding: "11px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const btnGhost = { width: "100%", marginTop: 8, background: "none", color: "#6b7688", border: "none", fontSize: 12.5, cursor: "pointer" };
