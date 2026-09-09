// Central API client. Token is kept in localStorage; every call attaches it.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:3002";

const tokenKey = "spp_portal_token";
export const getToken = () => localStorage.getItem(tokenKey) || "";
export const setToken = (t) => (t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey));

// Stable per-browser id so the public search landing can count anonymous free
// searches server-side (soft gate — clearing storage resets it).
export function deviceId() {
  try {
    let d = localStorage.getItem("spp_device_id");
    if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); localStorage.setItem("spp_device_id", d); }
    return d;
  } catch { return "nodevice"; }
}

async function req(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json", "x-device-id": deviceId() };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;   // carries { need, quota } for the search paywall
    throw err;
  }
  return data;
}

export const api = {
  base: BASE,

  // ---- auth ----
  login: (email, password) => req("/auth/login", { method: "POST", auth: false, body: { email, password } }),
  signup: (data) => req("/auth/signup", { method: "POST", auth: false, body: data }),
  publicPlans: () => req("/auth/plans", { auth: false }),
  adminPlans: () => req("/portal/admin/plans"),
  adminCreatePlan: (body) => req("/portal/admin/plans", { method: "POST", body }),
  adminUpdatePlan: (id, body) => req(`/portal/admin/plans/${id}`, { method: "PATCH", body }),
  adminDeletePlan: (id) => req(`/portal/admin/plans/${id}`, { method: "DELETE" }),
  me: () => req("/auth/me"),

  // ---- public catalogue-search landing (anon 3 free -> OTP 50 free -> ₹100/mo) ----
  searchCatalogue: (params) => req(`/search/catalogue${params ? `?${new URLSearchParams(params)}` : ""}`, { auth: true }),
  searchSources: () => req("/search/sources", { auth: true }),
  searchQuota: () => req("/search/quota", { auth: true }),
  searchPlans: () => req("/search/plans", { auth: true }),
  searchConsume: (key) => req("/search/consume", { method: "POST", auth: true, body: { key } }),
  otpSend: (mobile) => req("/search-auth/otp/send", { method: "POST", auth: false, body: { mobile } }),
  otpVerify: (mobile, code) => req("/search-auth/otp/verify", { method: "POST", auth: false, body: { mobile, code } }),
  firebaseAuth: (idToken) => req("/search-auth/firebase", { method: "POST", auth: false, body: { idToken } }),
  completeProfile: (body) => req("/search-auth/complete-profile", { method: "POST", body }),
  searchPlanOrder: (plan_id) => req("/search-plan/order", { method: "POST", body: { plan_id } }),
  searchPlanClaim: (utr) => req("/search-plan/claim", { method: "POST", body: { utr } }),
  adminSearchPlans: (status) => req(`/portal/admin/search-plans${status ? `?status=${status}` : ""}`),
  adminMarkSearchPlanPaid: (id, utr) => req(`/portal/admin/search-plans/${id}/mark-paid`, { method: "POST", body: { utr } }),
  adminGrantSearchPlan: (userId, plan_id) => req(`/portal/admin/users/${userId}/search-plan`, { method: "POST", body: { plan_id } }),

  // ---- client: billing / invoices ----
  invoices: () => req("/portal/invoices"),
  payInvoice: (id) => req(`/portal/invoices/${id}/pay`, { method: "POST" }),
  verifyInvoice: (id) => req(`/portal/invoices/${id}/verify`),
  // payment-info is shadowed by auth-gated /portal routers, so it needs the token
  // (the billing user is always signed in anyway).
  paymentInfo: () => req("/portal/payment-info"),
  claimInvoiceUpi: (id, utr) => req(`/portal/invoices/${id}/upi-claim`, { method: "POST", body: { utr } }),

  // ---- admin: clients + settings ----
  adminUsers: (q) => req(`/portal/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  adminSetUserPassword: (id, password) => req(`/portal/admin/users/${id}/set-password`, { method: "POST", body: password ? { password } : {} }),
  adminBrandMap: () => req("/portal/admin/brand-map"),
  adminSaveBrandMap: (raw, canonical, secondary) => req("/portal/admin/brand-map", { method: "PUT", body: { raw, canonical, secondary } }),
  adminDeleteBrandMap: (raw) => req(`/portal/admin/brand-map/${encodeURIComponent(raw)}`, { method: "DELETE" }),
  adminBrands: (q) => req(`/portal/admin/brands${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  adminEmailPreview: (type) => req(`/portal/admin/settings/email-preview${type ? `?type=${encodeURIComponent(type)}` : ""}`),
  adminGetSmtp: () => req("/portal/admin/settings/smtp"),
  adminSaveSmtp: (cfg) => req("/portal/admin/settings/smtp", { method: "PUT", body: cfg }),
  adminTestSmtp: (to) => req("/portal/admin/settings/smtp/test", { method: "POST", body: { to } }),
  adminGetPayment: () => req("/portal/admin/settings/payment"),
  adminSaveProvider: (id, cfg) => req(`/portal/admin/settings/payment/provider/${id}`, { method: "PUT", body: cfg }),
  adminSetActiveProvider: (id) => req("/portal/admin/settings/payment/active", { method: "PUT", body: { id } }),
  adminGetPlatformUpi: () => req("/portal/admin/settings/platform-upi"),
  adminSavePlatformUpi: (body) => req("/portal/admin/settings/platform-upi", { method: "PUT", body }),
  adminGetPlatformConfig: () => req("/portal/admin/settings/platform-config"),
  adminSavePlatformConfig: (body) => req("/portal/admin/settings/platform-config", { method: "PUT", body }),

  // ---- wallet + payouts ----
  wallet: () => req("/portal/wallet"),
  savePayoutDetails: (body) => req("/portal/wallet/payout-details", { method: "PUT", body }),
  acceptPayoutTerms: () => req("/portal/wallet/accept-terms", { method: "POST" }),
  requestPayout: (body) => req("/portal/wallet/payout", { method: "POST", body }),
  adminPayouts: (status) => req(`/portal/admin/payouts${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  adminUpdatePayout: (id, body) => req(`/portal/admin/payouts/${id}`, { method: "PATCH", body }),
  adminSetWalletThreshold: (userId, payout_threshold) => req(`/portal/admin/wallets/${userId}`, { method: "PATCH", body: { payout_threshold } }),
  adminMoneySummary: () => req("/portal/admin/money-summary"),
  adminPaymentsToVerify: () => req("/portal/admin/payments-to-verify"),
  adminOrdersPendingShipment: () => req("/portal/admin/orders-pending-shipment"),
  adminOrderShipments: (filter) => req(`/portal/admin/order-shipments${filter ? `?filter=${encodeURIComponent(filter)}` : ""}`),
  adminMarkShipped: (orderId) => req(`/portal/admin/orders/${orderId}/mark-shipped`, { method: "POST" }),
  adminVerifyOrderPayment: (orderId, utr) => req(`/portal/admin/orders/${orderId}/verify-payment`, { method: "POST", body: { utr } }),
  adminSetOrderStatus: (orderId, status) => req(`/portal/admin/orders/${orderId}/status`, { method: "PATCH", body: { status } }),

  // ---- fulfilment: payment verify + shipments ----
  verifyOrderPayment: (siteId, orderId, utr) => req(`/portal/hosted-sites/${siteId}/orders/${orderId}/verify-payment`, { method: "POST", body: { utr } }),
  adminVerifyOrder: (orderId, utr) => req(`/portal/admin/orders/${orderId}/verify-payment`, { method: "POST", body: { utr } }),
  adminRefundOrder: (orderId) => req(`/portal/admin/orders/${orderId}/refund`, { method: "POST" }),
  submitShipment: (body) => req("/portal/shipments", { method: "POST", body }),
  myShipments: () => req("/portal/shipments"),
  shipmentsByOrder: (orderId) => req(`/portal/shipments?order_id=${encodeURIComponent(orderId)}`),
  adminShipments: (status) => req(`/portal/admin/shipments${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  adminUpdateShipment: (id, body) => req(`/portal/admin/shipments/${id}`, { method: "PATCH", body }),
  adminPurgePreview: (grace) => req(`/portal/admin/shipments/purge-preview${grace ? `?grace=${grace}` : ""}`),
  setFulfilmentMode: (siteId, fulfilment_mode) => req(`/portal/hosted-sites/${siteId}/fulfilment-mode`, { method: "PUT", body: { fulfilment_mode } }),
  setOrderFulfilment: (siteId, orderId, fulfilment_mode) => req(`/portal/hosted-sites/${siteId}/orders/${orderId}/fulfilment`, { method: "PATCH", body: { fulfilment_mode } }),
  setPayoutMode: (siteId, payout_mode) => req(`/portal/hosted-sites/${siteId}/payout-mode`, { method: "PUT", body: { payout_mode } }),
  adminSetSiteFees: (siteId, body) => req(`/portal/admin/hosted-sites/${siteId}/fees`, { method: "PATCH", body }),
  uploadShipmentPhotos: async (files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    const res = await fetch(BASE + "/portal/shipments/upload", { method: "POST", headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}, body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
    return data; // { files:[{url,key}] }
  },

  // ---- admin: invoices (manual UPI reconciliation) ----
  adminInvoices: (status) => req(`/portal/admin/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  adminMarkInvoicePaid: (id, utr) => req(`/portal/admin/invoices/${id}/mark-paid`, { method: "POST", body: { utr } }),

  // ---- wholesale: vendor ----
  wholesaleMe: () => req("/portal/wholesale/me"),
  wholesaleApply: (body) => req("/portal/wholesale/apply", { method: "POST", body }),
  taxonomy: (primary) => req(`/portal/taxonomy${primary ? `?primary=${encodeURIComponent(primary)}` : ""}`),
  proposeTaxonomy: (primary_cat, sub_label) => req("/portal/taxonomy/propose", { method: "POST", body: { primary_cat, sub_label } }),
  wholesaleProducts: () => req("/portal/wholesale/products"),
  wholesaleCreateProduct: (body) => req("/portal/wholesale/products", { method: "POST", body }),
  wholesaleUpdateProduct: (pid, body) => req(`/portal/wholesale/products/${pid}`, { method: "PATCH", body }),
  wholesaleDeleteProduct: (pid) => req(`/portal/wholesale/products/${pid}`, { method: "DELETE" }),
  wholesaleReverify: (ids) => req("/portal/wholesale/products/reverify", { method: "POST", body: { ids } }),
  wholesaleOrders: () => req("/portal/wholesale/orders"),
  uploadStatus: () => req("/portal/upload/status"),
  uploadWholesaleImages: async (files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    const res = await fetch(BASE + "/portal/wholesale/upload", {
      method: "POST",
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}, // no Content-Type: browser sets multipart boundary
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
    return data; // { files:[{url,key}], urls:[...] }
  },

  // ---- wholesale: admin ----
  adminWholesalers: (status) => req(`/portal/admin/wholesalers${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  adminApproveWholesaler: (id) => req(`/portal/admin/wholesalers/${id}/approve`, { method: "POST" }),
  adminRejectWholesaler: (id, reason) => req(`/portal/admin/wholesalers/${id}/reject`, { method: "POST", body: { reason } }),
  adminPatchWholesaler: (id, body) => req(`/portal/admin/wholesalers/${id}`, { method: "PATCH", body }),
  adminTaxonomy: () => req("/portal/admin/taxonomy"),
  adminCreateTaxonomy: (body) => req("/portal/admin/taxonomy", { method: "POST", body }),
  adminPatchTaxonomy: (id, body) => req(`/portal/admin/taxonomy/${id}`, { method: "PATCH", body }),
  adminDeleteTaxonomy: (id) => req(`/portal/admin/taxonomy/${id}`, { method: "DELETE" }),
  adminWholesaleProducts: (owner) => req(`/portal/admin/wholesale-products${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`),
  adminPatchWholesaleProduct: (pid, body) => req(`/portal/admin/wholesale-products/${pid}`, { method: "PATCH", body }),
  adminDeleteWholesaleProduct: (pid) => req(`/portal/admin/wholesale-products/${pid}`, { method: "DELETE" }),

  // ---- client: enrollments ----
  enrollments: () => req("/portal/enrollments"),
  createShop: (shop_url, plan_id) => req("/portal/shops", { method: "POST", body: { shop_url, plan_id } }),
  createEnrollment: (domain, source_id, categories) =>
    req("/portal/enrollments", { method: "POST", body: { domain, source_id, categories } }),

  // ---- client: sources on an enrollment (multi-source) ----
  enrollmentSources: (id) => req(`/portal/enrollments/${id}/sources`),
  addEnrollmentSource: (id, source_id, categories) =>
    req(`/portal/enrollments/${id}/sources`, { method: "POST", body: { source_id, categories } }),
  setEnrollmentSourceCats: (id, sourceId, categories) =>
    req(`/portal/enrollments/${id}/sources/${sourceId}`, { method: "PATCH", body: { categories } }),
  removeEnrollmentSource: (id, sourceId) =>
    req(`/portal/enrollments/${id}/sources/${sourceId}`, { method: "DELETE" }),

  // ---- client: sources + categories to pick from ----
  sources: () => req("/portal/sources"),
  sourceCategories: (sourceId) => req(`/portal/sources/${sourceId}/categories`),

  // ---- client: scrape requests ----
  myScrapeRequests: () => req("/portal/scrape-requests"),
  createScrapeRequest: (site_url, category, enrollment_id) =>
    req("/portal/scrape-requests", { method: "POST", body: { site_url, category, enrollment_id } }),

  // ---- admin: sources ----
  adminSources: () => req("/portal/admin/sources"),
  adminSourceCategories: (id) => req(`/portal/admin/sources/${id}/categories`),
  adminToggleCategory: (id, cat_name, enabled) =>
    req(`/portal/admin/sources/${id}/categories`, { method: "PATCH", body: { cat_name, enabled } }),
  adminRefreshCategories: (id, mode) =>
    req(`/portal/admin/sources/${id}/categories/refresh`, { method: "POST", body: { mode } }),
  adminRefreshAllCategories: () =>
    req("/portal/admin/sources/categories/refresh-all", { method: "POST" }),
  adminSetSourceStatus: (id, status) =>
    req(`/portal/admin/sources/${id}`, { method: "PATCH", body: { status } }),

  // ---- admin: enrollment + scrape-request queues ----
  adminEnrollments: (status) => req(`/portal/admin/enrollments${status ? `?status=${status}` : ""}`),
  adminEnrollmentOverview: () => req("/portal/admin/enrollment-overview"),
  adminVerifyDomain: (id) => req(`/portal/admin/enrollments/${id}/verify-domain`, { method: "POST" }),
  enrollmentCategoryMap: (id) => req(`/portal/enrollments/${id}/category-map`),
  saveEnrollmentCategoryMap: (id, mappings) => req(`/portal/enrollments/${id}/category-map`, { method: "POST", body: { mappings } }),
  adminApproveEnrollment: (id) => req(`/portal/admin/enrollments/${id}/approve`, { method: "POST" }),
  adminRejectEnrollment: (id) => req(`/portal/admin/enrollments/${id}/reject`, { method: "POST" }),
  adminActivateEnrollment: (id) => req(`/portal/admin/enrollments/${id}/activate`, { method: "POST" }),
  adminScrapeRequests: (status) => req(`/portal/admin/scrape-requests${status ? `?status=${status}` : ""}`),
  adminApproveScrapeRequest: (id, body) =>
    req(`/portal/admin/scrape-requests/${id}/approve`, { method: "POST", body }),
  adminResolveScrapeRequest: (id) =>
    req(`/portal/admin/scrape-requests/${id}/resolve`, { method: "POST" }),
  adminRejectScrapeRequest: (id) =>
    req(`/portal/admin/scrape-requests/${id}/reject`, { method: "POST" }),

  // ---- client: hosted storefronts ----
  myHostedSites: () => req("/portal/hosted-sites"),
  hostedOrders: (params) => req(`/portal/hosted-orders${params ? `?${new URLSearchParams(params)}` : ""}`),
  hostedAnalytics: () => req("/portal/hosted-analytics"),
  hostedSiteAnalytics: (id, params) => req(`/portal/hosted-sites/${id}/analytics${params ? `?${new URLSearchParams(params)}` : ""}`),
  catalogue: (params) => req(`/portal/catalogue${params ? `?${new URLSearchParams(params)}` : ""}`),
  notifications: () => req("/portal/notifications"),
  requestProSetup: (message) => req("/portal/setup-requests", { method: "POST", body: { message } }),
  createHostedSite: (store_name, slug) => req("/portal/hosted-sites", { method: "POST", body: { store_name, slug } }),
  submitHostedSite: (id, body) => req(`/portal/hosted-sites/${id}/submit`, { method: "POST", body }),
  hostedSiteSettings: (id) => req(`/portal/hosted-sites/${id}/settings`),
  saveHostedSiteSettings: (id, settings) => req(`/portal/hosted-sites/${id}/settings`, { method: "PUT", body: settings }),
  hostedSiteOrders: (id, status) => req(`/portal/hosted-sites/${id}/orders${status ? `?status=${status}` : ""}`),
  hostedSiteOrder: (id, orderId) => req(`/portal/hosted-sites/${id}/orders/${orderId}`),
  updateHostedSiteOrderStatus: (id, orderId, status) =>
    req(`/portal/hosted-sites/${id}/orders/${orderId}`, { method: "PATCH", body: { status } }),
  hostedSiteSources: (id) => req(`/portal/hosted-sites/${id}/sources`),
  hostedSiteBrands: (id, category) => req(`/portal/hosted-sites/${id}/brands?category=${encodeURIComponent(category)}`),
  hostedSiteSubcategories: (id, category) => req(`/portal/hosted-sites/${id}/subcategories?category=${encodeURIComponent(category)}`),
  hostedSiteSubBrands: (id, category, brand) => req(`/portal/hosted-sites/${id}/subbrands?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}`),
  hostedSiteAllCategories: (id) => req(`/portal/hosted-sites/${id}/all-categories`),
  hostedSiteSaveCategoryMap: (id, db_name, cat_name, canonical) => req(`/portal/hosted-sites/${id}/category-map`, { method: "PUT", body: { db_name, cat_name, canonical } }),
  saveHostedSiteSources: (id, source_ids) =>
    req(`/portal/hosted-sites/${id}/sources`, { method: "PUT", body: { source_ids } }),
  hostedSitePresets: () => req("/portal/hosted-sites/presets"),
  applyHostedSitePreset: (id, preset) =>
    req(`/portal/hosted-sites/${id}/presets/${preset}`, { method: "POST" }),
  setHostedSiteCustomDomain: (id, domain) =>
    req(`/portal/hosted-sites/${id}/custom-domain`, { method: "PUT", body: { domain } }),
  verifyHostedSiteDomain: (id) =>
    req(`/portal/hosted-sites/${id}/verify-domain`, { method: "POST" }),
  adminVerifyCustomDomain: (id) =>
    req(`/portal/admin/hosted-sites/${id}/verify-custom-domain`, { method: "POST" }),

  // ---- admin: hosted storefronts ----
  adminHostedSites: () => req("/portal/admin/hosted-sites"),
  adminAnalytics: (params) => req(`/portal/admin/analytics${params ? `?${new URLSearchParams(params)}` : ""}`),
  adminSiteAnalytics: (id, params) => req(`/portal/admin/hosted-sites/${id}/analytics${params ? `?${new URLSearchParams(params)}` : ""}`),
  adminUpdateHostedSite: (id, body) => req(`/portal/admin/hosted-sites/${id}`, { method: "PATCH", body }),
  adminDeleteHostedSite: (id) => req(`/portal/admin/hosted-sites/${id}`, { method: "DELETE" }),
  adminOrders: (params) => req(`/portal/admin/orders${params ? `?${new URLSearchParams(params)}` : ""}`),
  adminOrder: (id) => req(`/portal/admin/orders/${id}`),
};
