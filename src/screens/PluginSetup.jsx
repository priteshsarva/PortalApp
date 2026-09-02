import React, { useEffect, useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { api } from "../api.js";
import { PageHead, Card, Btn, Spinner, ErrorNote, Empty } from "../ui.jsx";
import pluginZip, { PLUGIN_FILE } from "../lib/plugin.js";

export default function PluginSetup() {
  const [enr, setEnr] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    api.enrollments().then((r) => setEnr(r.enrollments || [])).catch(setError);
  }, []);

  function copy(k) { navigator.clipboard?.writeText(k); setCopied(k); setTimeout(() => setCopied(null), 1400); }

  return (
    <div>
      <PageHead title="Set up plugin" sub="Download the plugin, install it on your WordPress site, then paste your site's key." />

      <Card style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>WordPress plugin</div>
          <div style={{ fontSize: 12.5, color: "#6b7688", marginTop: 2 }}>{PLUGIN_FILE} — install this on your WooCommerce site.</div>
        </div>
        <a href={pluginZip} download={PLUGIN_FILE} style={{ textDecoration: "none" }}>
          <Btn tone="lime"><Download size={15} style={{ verticalAlign: "-3px", marginRight: 4 }} />Download plugin</Btn>
        </a>
      </Card>

      <Card style={{ marginBottom: 18 }}>
        <ol style={{ margin: 0, paddingLeft: 18, color: "#42505f", fontSize: 13.5, lineHeight: 1.9 }}>
          <li>Download the plugin above (<code>{PLUGIN_FILE}</code>).</li>
          <li>In WordPress: Plugins → Add New → Upload Plugin → choose the downloaded file → Install → Activate.</li>
          <li>Open the <strong>Authntic Products</strong> menu in the WP sidebar.</li>
          <li>Paste the key for that site (below) and save.</li>
          <li>Set your margin tiers, then click <strong>Start auto-sync</strong>.</li>
        </ol>
      </Card>

      <ErrorNote error={error} />
      {!enr ? <Spinner /> : enr.length === 0 ? <Card><Empty msg="No sites yet." /></Card> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {enr.map((e) => (
            <Card key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{e.domain}</div>
                <code style={{ fontSize: 12.5, color: "#42505f" }}>{e.enrollment_key}</code>
              </div>
              <Btn small tone="ghost" onClick={() => copy(e.enrollment_key)}>
                {copied === e.enrollment_key ? <Check size={14} /> : <Copy size={14} />} Copy key
              </Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
