import React, { useMemo, useState } from "react";

/**
 * CFO Worx CRM — Preview Module (Mock Data)
 * Ready to drop into your existing React app.
 * No external UI libraries are required (basic classes only).
 *
 * Tabs: Sales CRM, M&A Sell‑Side, M&A Buy‑Side, Reports, Settings
 * Features implemented:
 *  - Prospect triage (Review/Kill/Reply) with canned replies
 *  - De‑dupe (compare/merge UI)
 *  - Lead Drawer (notes, manual "meeting attended" checkbox, details)
 *  - Quote Builder + "Send via DocuSign" CTA
 *  - Auto‑onboarding checklist (triggered after DocuSign signature)
 *  - Buy‑Side/Sell‑Side pipeline + shareable email digest composer
 *  - Reports: Closed/Lost (with reason filter), Lead Source, Rep Performance, Goals vs Actual
 *  - Settings: stage probabilities + stale thresholds, lead sources, canned replies, per‑rep goals
 *
 * This is a self‑contained front‑end mock; replace SAMPLE_* and wire integrations
 * in /src/integrations/* when you hook it to the real services.
 */

// --- Roles ------------------------------------------------------------------
const ROLES = ["ADMIN", "MANAGER", "REP"];

// --- Stages -----------------------------------------------------------------
const SALES_STAGES = [
  "Prospect",
  "Lead",
  "Call Booked",
  "Follow Up",
  "Quote Sent",
  "Quoted Follow Up",
  "Closed/Won",
  "Closed/Lost",
];

const SELL_SIDE_STAGES = [
  "Teaser Sent",
  "NDA Sent",
  "NDA Negotiation",
  "NDA Signed",
  "CIM Sent",
  "IOI",
  "LOI",
  "Due Diligence",
];

const BUY_SIDE_STAGES = [
  "Positive Response",
  "Call Scheduled",
  "NDA",
  "Financials Received",
  "IOI",
  "LOI",
  "Due Diligence",
];

// --- Stage Config (defaults; override in Settings) --------------------------
const DEFAULT_STAGE_CONFIG = {
  "Prospect": { prob: 0.05, stale: 3 },
  "Lead": { prob: 0.10, stale: 5 },
  "Call Booked": { prob: 0.30, stale: 7 },
  "Follow Up": { prob: 0.45, stale: 5 },
  "Quote Sent": { prob: 0.60, stale: 7 },
  "Quoted Follow Up": { prob: 0.65, stale: 5 },
  "Closed/Won": { prob: 1.00, stale: 90 },
  "Closed/Lost": { prob: 0.00, stale: 90 },
};

// --- Lead Sources + Canned Replies -----------------------------------------
const DEFAULT_SOURCES = [
  "Referral - Brian Network",
  "Referral - From Existing Client",
  "Referral - Other",
  "Searchfunder",
  "Existing/Prior Client",
  "Email Outreach",
  "Cold Calling",
  "ServPro",
  "Website",
  "Paid Marketing - Social",
  "Paid Marketing - Other",
  "Tradeshow/Conference",
  "LinkedIn/Dripify",
  "Other",
];

const DEFAULT_TEMPLATES = [
  { key: "not_interested", label: "Polite decline ack", body: "Thanks for the quick reply — totally understand. If circumstances change, happy to revisit." },
  { key: "schedule_call", label: "Send calendar link", body: "Great — to schedule a discovery call, grab a time here: <CALENDAR_LINK>." },
  { key: "pricing_brief", label: "Share pricing overview", body: "Here’s a quick overview of our engagement models and fees…" },
  { key: "circle_back", label: "Circle back later", body: "Understood. I'll circle back in a few months. Feel free to reach out sooner if helpful." },
];

// --- Sample Data ------------------------------------------------------------
const SAMPLE_DEALS = [
  {
    id: "d1",
    module: "sales",
    company: "Blue Harbor Foods",
    contact: "Alice Chan",
    title: "CEO",
    amount: 85000,
    mrr: 6500,
    owner: "Hannah",
    source: "Referral - Existing Client",
    stage: "Prospect",
    lastActivity: "Inbound reply from ListKit outreach",
    lastActivityDays: 1,
    activityCount: 3,
    companySize: "M",
    notes: "Requested discovery call next week.",
    details: {
      "Client Business Name": "Blue Harbor Foods LLC",
      "Accounting System": "QuickBooks Online",
      "HQ Business City": "Tampa",
      "Lead Source": "Referral - Existing Client",
      "Client Revenue TTM at Quote": 12500000,
      "Client EBITDA TTM at Quote": 1450000,
    },
  },
  {
    id: "d2",
    module: "sales",
    company: "Zenith Fabrication",
    contact: "Marc Reyes",
    title: "Owner",
    amount: 120000,
    mrr: 9000,
    owner: "Devon",
    source: "Website",
    stage: "Quote Sent",
    lastActivity: "Quote viewed 2h ago",
    lastActivityDays: 0,
    activityCount: 5,
    companySize: "L",
    notes: "DocuSign pending.",
    details: {
      "Quote Sent Date": new Date().toLocaleDateString(),
      "Service Type - per contract": "Fractional CFO + Controller",
      "CFO Hours - Quantity": 20,
      "CFO Hours - Rate": 250,
      "Controller Hours - Quantity": 30,
      "Controller Hours - Rate": 150,
    },
  },
  {
    id: "d3",
    module: "sales",
    company: "Nimbus HVAC",
    contact: "Priya Patel",
    title: "President",
    amount: 60000,
    mrr: 5000,
    owner: "Hannah",
    source: "LinkedIn/Dripify",
    stage: "Follow Up",
    lastActivity: "No show → rebook call",
    lastActivityDays: 4,
    activityCount: 1,
    companySize: "S",
    notes: "Resend calendar link.",
  },
  {
    id: "d4",
    module: "sell",
    company: "Ridge Valley Capital",
    contact: "—",
    owner: "M&A Team",
    source: "Referral - Brian Network",
    stage: "Teaser Sent",
    lastActivity: "Teaser downloaded",
  },
  {
    id: "d5",
    module: "buy",
    company: "Apex Tools — Target Pipeline",
    contact: "Client: Apex Tools",
    owner: "Buy-Side Pod A",
    source: "Engagement",
    stage: "Positive Response",
    lastActivity: "Supplier Alpha open to share financials",
  },
  {
    id: "d6",
    module: "sales",
    company: "Oakline Logistics",
    contact: "James O'Neill",
    title: "CEO",
    amount: 70000,
    mrr: 5500,
    owner: "Devon",
    source: "Email Outreach",
    stage: "Closed/Lost",
    closedReason: "Price",
    closedDate: "2025-10-10",
    lastActivity: "Declined proposal",
    lastActivityDays: 2,
    activityCount: 4,
    companySize: "M",
    notes: "May revisit Q1.",
  },
];

const SAMPLE_RESPONSES = [
  { id: "r1", source: "ListKit", from: "ceo@blueharborfoods.com", preview: "Not interested at this time, thanks.", receivedAt: "Today 8:42a", suggestedCompany: "Blue Harbor Foods LLC", suggestedContact: "Alice Chan" },
  { id: "r2", source: "Dripify", from: "linkedin.com/in/marcreyes", preview: "Let’s chat next week.", receivedAt: "Yesterday 1:17p", suggestedCompany: "Zenith Fabrication", suggestedContact: "Marc Reyes" },
];

const SAMPLE_USERS = [
  { id: "u1", name: "Hannah", role: "REP" },
  { id: "u2", name: "Devon", role: "REP" },
  { id: "u3", name: "Riley", role: "MANAGER" },
];

// --- Utils ------------------------------------------------------------------
function currency(n) {
  return (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  return (!s || d >= s) && (!e || d <= e);
}
function computeLeadScore(d, stageCfg) {
  const stage = Math.round((stageCfg[d.stage]?.prob ?? 0) * 40); // 0..40
  const value = Math.min(30, Math.round(((d.amount || 0) + (12 * (d.mrr || 0))) / 10000)); // 0..30
  const activity = Math.min(20, (d.activityCount || 0) * 3) + Math.max(0, 10 - (d.lastActivityDays || 10)); // ~0..30
  const company = d.companySize === "L" ? 15 : d.companySize === "M" ? 8 : 3; // 0..15
  const manual = d.manualScoreBoost || 0; // manager input
  return Math.max(0, Math.min(100, stage + value + activity + company + manual));
}

// --- UI primitives ----------------------------------------------------------
function StagePills({ stages, current }) {
  const idx = Math.max(0, stages.indexOf(current));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {stages.map((s, i) => (
        <div key={s} style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12, border: "1px solid #e5e7eb",
          background: i < idx ? "#ecfdf5" : i === idx ? "#eff6ff" : "#f3f4f6", color: i < idx ? "#065f46" : i === idx ? "#1d4ed8" : "#4b5563" }}>{s}</div>
      ))}
    </div>
  );
}
function Metric({ title, value }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#6b7280", fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
function DataRow({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fff" }}>
      <span style={{ fontSize: 11, letterSpacing: 0.5, color: "#6b7280", textTransform: "uppercase" }}>{label}</span>
      <span style={{ marginTop: 4 }}>{value ?? "—"}</span>
    </div>
  );
}
function Column({ name, children }) {
  return (
    <div style={{ minWidth: 280, width: 320, flexShrink: 0 }}>
      <div style={{ position: "sticky", top: 0, background: "rgba(249,250,251,0.85)", padding: "16px 0", fontWeight: 600 }}>{name}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>{children}</div>
    </div>
  );
}
function DealCard({ d, onOpen, onKill, onReview, setQuickNote }) {
  const isProspect = d.stage === "Prospect";
  const [showNote, setShowNote] = useState(false);
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ cursor: "pointer" }} onClick={() => onOpen(d)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 32, width: 32, borderRadius: 999, background: "#f3f4f6", color: "#374151", fontWeight: 600 }}>
              {d.company.split(" ").slice(0, 2).map((x) => x[0]).join("")}
            </div>
            <div style={{ fontWeight: 600 }}>{d.company}</div>
          </div>
          <div style={{ color: "#6b7280", marginTop: 4, fontSize: 14 }}>
            <span style={{ color: "#374151", fontWeight: 500 }}>{d.contact}</span>{d.title ? ` • ${d.title}` : ""} • Owner: {d.owner}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600 }}>{typeof d.amount === "number" ? currency(d.amount) : "—"}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>MRR {typeof d.mrr === "number" ? currency(d.mrr) : "—"}</div>
        </div>
      </div>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <div style={{ padding: "2px 8px", background: "#f3f4f6", borderRadius: 8 }}>{d.source}</div>
        <div style={{ color: "#6b7280" }}>{d.lastActivity || "No recent activity"}</div>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setShowNote(!showNote)} style={{ padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14 }}>{showNote ? "Hide Note" : "Add Note"}</button>
        {isProspect && <button onClick={() => onReview(d)} style={{ padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14 }}>Review</button>}
        {isProspect && <button onClick={() => onKill(d)} style={{ padding: "6px 10px", background: "#e11d48", color: "white", borderRadius: 8, fontSize: 14 }}>Kill Lead</button>}
      </div>
      {showNote && (
        <div style={{ marginTop: 8 }}>
          <textarea defaultValue={d.notes || ""} onBlur={(e)=>setQuickNote(d.id, e.target.value)} placeholder="Quick note…" style={{ width: "100%", height: 80, borderRadius: 8, border: "1px solid #e5e7eb", padding: 8 }} />
        </div>
      )}
    </div>
  );
}

// --- Modals -----------------------------------------------------------------
function LeadDrawer({ open, onClose, stages, deal, onOpenDedupe, onOpenQuote, onMarkWon, setDealNotes }) {
  if (!open || !deal) return null;
  const fields = deal.details || {};
  const entries = Object.entries(fields);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "100%", maxWidth: 840, background: "white", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", padding: 24, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#6b7280", fontSize: 14 }}>{deal.module === "sales" ? "Lead" : deal.module === "sell" ? "Sell-Side" : "Buy-Side"}</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{deal.company}</div>
            <div style={{ color: "#4b5563", marginTop: 4, fontSize: 14 }}>{deal.contact} {deal.title ? `• ${deal.title}` : ""} • Owner {deal.owner}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onOpenDedupe(deal)} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "6px 10px" }}>De‑dupe</button>
            <button onClick={onClose} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "6px 10px" }}>Close</button>
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          <section>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>Status</div>
            <StagePills stages={stages} current={deal.stage} />
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ padding: "6px 10px", borderRadius: 8, background: "#2563eb", color: "white" }}>Mark Stage as Complete</button>
              <button style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Schedule Follow‑Up</button>
              <button onClick={() => onOpenQuote(deal)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Open Quote Builder</button>
              <button onClick={() => onMarkWon(deal)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Mark Won (DocuSign)</button>
              <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#4b5563" }}><input type="checkbox" /> Meeting attended</label>
            </div>
          </section>

          <section>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <DataRow label="Amount (TCV)" value={typeof deal.amount === "number" ? currency(deal.amount) : "—"} />
              <DataRow label="MRR Value" value={typeof deal.mrr === "number" ? currency(deal.mrr) : "—"} />
              <DataRow label="Lead Source" value={deal.source || "—"} />
              <DataRow label="Last Activity" value={deal.lastActivity || "—"} />
            </div>
            {entries.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>Sales Data</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {entries.map(([k, v]) => <DataRow key={k} label={k} value={String(v)} />)}
                </div>
              </div>
            )}
          </section>

          <section>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>Notes</div>
            <textarea defaultValue={deal.notes || ""} onBlur={(e)=>setDealNotes(deal.id, e.target.value)} placeholder="Add internal notes…" style={{ width: "100%", height: 112, borderRadius: 8, border: "1px solid #e5e7eb", padding: 8 }} />
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Visible to all roles.</div>
          </section>

          {deal.module === "buy" && (
            <section>
              <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>Client Update</div>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 14, color: "#374151", marginBottom: 8 }}>Email-only digest: deal-level status only (no contact PII).</div>
                <button style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Compose Update Email</button>
              </div>
            </section>
          )}

          <section>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>Audit</div>
            <div style={{ fontSize: 14, color: "#4b5563" }}>Created 7d ago • Updated 2h ago • Owner: {deal.owner}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProspectTriage({ open, onClose, response, templates, onKill, onPromote }) {
  const [template, setTemplate] = useState("");
  if (!open || !response) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "100%", maxWidth: 560, background: "white", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", padding: 24, overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Prospect Review</div>
        <div style={{ marginTop: 8, color: "#4b5563", fontSize: 14 }}>Source: {response.source} • From: {response.from} • {response.receivedAt}</div>
        <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#f9fafb" }}>{response.preview}</div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Quick Reply</div>
          <select value={template} onChange={(e)=>setTemplate(e.target.value)} style={{ width: "100%", borderRadius: 8, border: "1px solid #e5e7eb", padding: 8 }}>
            <option value="">Choose a canned reply…</option>
            {templates.map((r) => <option key={r.key} value={r.body}>{r.label}</option>)}
          </select>
          <textarea placeholder="Edit reply before sending…" value={template} onChange={(e)=>setTemplate(e.target.value)} style={{ width: "100%", height: 112, borderRadius: 8, border: "1px solid #e5e7eb", padding: 8, marginTop: 8 }} />
          <div style={{ fontSize: 12, color: "#6b7280" }}>Sends via ListKit/LinkedIn connector based on source.</div>
        </div>

        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={()=>onPromote(template || undefined)} style={{ padding: "6px 10px", background: "#059669", color: "white", borderRadius: 8 }}>Promote to Lead</button>
          <button onClick={()=>onKill("Negative response", template || undefined)} style={{ padding: "6px 10px", background: "#e11d48", color: "white", borderRadius: 8 }}>Kill Lead</button>
          <button onClick={onClose} style={{ padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8 }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function DedupeModal({ open, onClose, left, right }) {
  if (!open || !left || !right) return null;
  const fields = ["company", "contact", "amount", "mrr", "owner", "source", "stage"];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 32, width: "100%", maxWidth: 960, background: "white", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Potential Duplicate — Resolve</div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 14 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Field</div>
          <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Record A</div>
          <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Record B</div>
          {fields.map((f) => (
            <React.Fragment key={f}>
              <div style={{ padding: "8px 0", fontWeight: 500 }}>{f}</div>
              <div style={{ padding: 8, border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb" }}>{String(left[f] ?? "—")}</div>
              <div style={{ padding: 8, border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb" }}>{String(right[f] ?? "—")}</div>
            </React.Fragment>
          ))}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Keep A</button>
          <button style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Keep B</button>
          <button style={{ padding: "6px 10px", borderRadius: 8, background: "#2563eb", color: "white" }}>Merge Selected Fields</button>
          <button onClick={onClose} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Close</button>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>De‑dupe keyed on email/domain with audit trail.</div>
      </div>
    </div>
  );
}

function QuoteBuilder({ open, onClose, deal }) {
  const [lines, setLines] = useState([
    { desc: "CFO Hours", qty: 20, rate: 250 },
    { desc: "Controller Hours", qty: 30, rate: 150 },
    { desc: "Onboarding Fee", qty: 1, rate: 2500 },
  ]);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const mrr = lines.filter((l) => l.desc.includes("Hours")).reduce((s, l) => s + l.qty * l.rate, 0);
  if (!open || !deal) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 32, width: "100%", maxWidth: 960, background: "white", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Quote Builder — {deal.company}</div>
          <button onClick={onClose} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Close</button>
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 120px 120px 160px", gap: 8, fontSize: 14 }}>
          {lines.map((l, i) => (
            <React.Fragment key={i}>
              <input value={l.desc} onChange={(e)=>setLines(xs=>xs.map((y,j)=>i===j?{...y, desc:e.target.value}:y))} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }} />
              <input type="number" value={l.qty} onChange={(e)=>setLines(xs=>xs.map((y,j)=>i===j?{...y, qty:Number(e.target.value)}:y))} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }} />
              <input type="number" value={l.rate} onChange={(e)=>setLines(xs=>xs.map((y,j)=>i===j?{...y, rate:Number(e.target.value)}:y))} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }} />
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#f9fafb" }}>{currency(l.qty * l.rate)}</div>
            </React.Fragment>
          ))}
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 16, justifyContent: "flex-end", alignItems: "center" }}>
          <div>MRR: <span style={{ fontWeight: 600 }}>{currency(mrr)}</span></div>
          <div>TCV: <span style={{ fontWeight: 600 }}>{currency(subtotal)}</span></div>
          <button style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Generate PDF</button>
          <button style={{ padding: "6px 10px", borderRadius: 8, background: "#2563eb", color: "white" }}>Send via DocuSign</button>
        </div>
      </div>
    </div>
  );
}

function OnboardingChecklist({ open, onClose, deal }) {
  const [items, setItems] = useState([
    { t: "Create client in portal", done: false },
    { t: "Send onboarding link (info@cfo-worx.com)", done: false },
    { t: "Slack/Teams channel", done: false },
    { t: "Accounting system access", done: false },
  ]);
  if (!open || !deal) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 32, width: "100%", maxWidth: 720, background: "white", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Client Handoff — {deal.company}</div>
          <button onClick={onClose} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Close</button>
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={it.done} onChange={(e)=>setItems(xs=>xs.map((y,j)=>i===j?{...y, done:e.target.checked}:y))} />
              <span>{it.t}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 14, color: "#6b7280" }}>Triggered when DocuSign envelope is completed.</div>
      </div>
    </div>
  );
}

function ShareUpdateModal({ open, onClose, moduleTitle }) {
  const rows = [
    { stage: "Positive Response", count: 5, recent: "Alpha, Beta, Delta" },
    { stage: "NDA", count: 3, recent: "—" },
    { stage: "Financials Received", count: 2, recent: "—" },
  ];
  const [notes, setNotes] = useState("");
  const [clientName, setClientName] = useState("Client XYZ");
  const weekOf = new Date().toLocaleDateString();
  const subject = `CFO Worx ${moduleTitle} Update — ${clientName} — Week of ${weekOf}`;
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 32, width: "100%", maxWidth: 720, background: "white", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Compose {moduleTitle} Update Email</div>
          <button onClick={onClose} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Close</button>
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <span>Subject:</span><span style={{ fontWeight: 500 }}>{subject}</span>
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <label>Client <input value={clientName} onChange={(e)=>setClientName(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 6 }} /></label>
        </div>
        <div style={{ marginTop: 12, fontSize: 14 }}>Simple table (deal-level status only):</div>
        <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 14 }}>
            <thead style={{ background: "#f9fafb", color: "#6b7280" }}>
              <tr><th style={{ textAlign: "left", padding: "6px 10px" }}>Stage</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Count</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Recent Updates</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "6px 10px" }}>{r.stage}</td>
                  <td style={{ padding: "6px 10px" }}>{r.count}</td>
                  <td style={{ padding: "6px 10px" }}>{r.recent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Notes</div>
          <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Optional notes…" style={{ width: "100%", height: 96, borderRadius: 8, border: "1px solid #e5e7eb", padding: 8 }} />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Preview Email</button>
          <button style={{ padding: "6px 10px", borderRadius: 8, background: "#059669", color: "white" }}>Send Update</button>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>Sends from info@cfo-worx.com. No contact PII included.</div>
      </div>
    </div>
  );
}

// --- Boards & Settings ------------------------------------------------------
function Board({ title, stages, deals, onOpen, onOpenQuote, onKill, onReview, role, extraHeader, setQuickNote }) {
  const grouped = useMemo(() => {
    const map = new Map();
    stages.forEach((s) => map.set(s, []));
    deals.forEach((d) => {
      if (!map.has(d.stage)) map.set(d.stage, []);
      map.get(d.stage).push(d);
    });
    return map;
  }, [stages, deals]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {extraHeader}
          <input placeholder="Search…" style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14 }} />
          <button style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14 }}>Filters</button>
          <button style={{ padding: "8px 10px", borderRadius: 12, background: "black", color: "white", fontSize: 14 }}>New Deal</button>
          {role === "ADMIN" && <button style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14 }}>Export CSV</button>}
        </div>
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, minWidth: "100%" }}>
          {stages.map((s) => (
            <Column key={s} name={`${s} • ${(grouped.get(s) || []).length}`}>
              {(grouped.get(s) || []).map((d) => (
                <DealCard key={d.id} d={d} onOpen={onOpen} onKill={onKill} onReview={onReview} setQuickNote={setQuickNote} />
              ))}
            </Column>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ stageConfig, setStageConfig, sources, setSources, templates, setTemplates, users, goals, setGoals }) {
  function updateStage(name, field, value) {
    setStageConfig({ ...stageConfig, [name]: { ...stageConfig[name], [field]: value } });
  }
  function addSource() {
    const v = window.prompt("New lead source name");
    if (v) setSources([...sources, v]);
  }
  function addTemplate() {
    const label = window.prompt("Template label");
    if (!label) return;
    setTemplates([...templates, { key: label.toLowerCase().replace(/\\s+/g, "_"), label, body: "" }]);
  }
  function updateGoal(userId, period, field, value) {
    setGoals({
      ...goals,
      [userId]: {
        ...goals[userId],
        [period]: { ...(goals[userId]?.[period] || {}), [field]: value },
      },
    });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 600 }}>Stage Configuration</div>
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {Object.entries(stageConfig).map(([name, cfg]) => (
            <div key={name} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{name}</div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
                <label>Prob (%) <input type="number" value={Math.round(cfg.prob * 100)} onChange={(e)=>updateStage(name, "prob", Math.max(0, Math.min(100, Number(e.target.value))) / 100)} style={{ marginLeft: 6, width: 80 }} /></label>
                <label>Stale (days) <input type="number" value={cfg.stale} onChange={(e)=>updateStage(name, "stale", Number(e.target.value))} style={{ marginLeft: 6, width: 100 }} /></label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600 }}>Lead Sources</div>
          <button onClick={addSource} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>Add</button>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sources.map((s, i) => (<span key={i} style={{ padding: "4px 8px", background: "#f3f4f6", borderRadius: 8, fontSize: 14 }}>{s}</span>))}
        </div>
      </section>

      <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600 }}>Canned Replies</div>
          <button onClick={addTemplate} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>Add</button>
        </div>
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {templates.map((t, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{t.label}</div>
              <textarea value={t.body} onChange={(e)=>setTemplates(templates.map((x,j)=>i===j?{...x, body:e.target.value}:x))} style={{ marginTop: 8, width: "100%", height: 96, borderRadius: 8, border: "1px solid #e5e7eb", padding: 8 }} />
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Targets & Goals (per rep)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SAMPLE_USERS.filter(u=>u.role!=="MANAGER").map(u => (
            <div key={u.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>{u.name}</div>
              {["weekly","monthly","quarterly"].map(period => (
                <div key={period} style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, fontSize: 14, marginBottom: 8 }}>
                  <div style={{ gridColumn: "1 / -1", fontWeight: 500, textTransform: "capitalize" }}>{period}</div>
                  {["booked","attended","quotes","totalQuote","avgQuote","closed"].map(field => (
                    <label key={field} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 140, color: "#6b7280" }}>{field==="totalQuote"?"Total Quote $": field==="avgQuote"?"Avg Quote $": (field[0].toUpperCase()+field.slice(1))}</span>
                      <input type="number" defaultValue={0} onChange={(e)=>updateGoal(u.id, period, field, Number(e.target.value))} style={{ width: 100, border: "1px solid #e5e7eb", borderRadius: 8, padding: 6 }} />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// --- Main App ---------------------------------------------------------------
export default function CRMApp() {
  const [role, setRole] = useState("MANAGER");
  const [tab, setTab] = useState("sales"); // 'sales' | 'sell' | 'buy' | 'reports' | 'settings'
  const [drawer, setDrawer] = useState(null);
  const [dedupe, setDedupe] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(null);
  const [handoffOpen, setHandoffOpen] = useState(null);
  const [triageOpen, setTriageOpen] = useState({ open: false, response: null });
  const [shareOpen, setShareOpen] = useState(false);
  const [stageConfig, setStageConfig] = useState(DEFAULT_STAGE_CONFIG);
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  const [salesDeals, setSalesDeals] = useState(SAMPLE_DEALS.filter((d) => SALES_STAGES.includes(d.stage)));
  const sellDeals = SAMPLE_DEALS.filter((d) => SELL_SIDE_STAGES.includes(d.stage));
  const buyDeals = SAMPLE_DEALS.filter((d) => BUY_SIDE_STAGES.includes(d.stage));

  // Reports state
  const [startDate, setStartDate] = useState("2025-10-01");
  const [endDate, setEndDate] = useState("2025-10-15");
  const [reportTab, setReportTab] = useState("Overview");
  const [closedReason, setClosedReason] = useState("All");
  const [goals, setGoals] = useState({});
  const [goalsPeriod, setGoalsPeriod] = useState("monthly");

  // EV from stage probabilities
  const expectedValue = salesDeals.reduce((sum, d) => sum + (d.amount || 0) * (stageConfig[d.stage]?.prob ?? 0), 0);

  function setDealNotes(id, notes){ setSalesDeals(arr => arr.map(x => x.id === id ? { ...x, notes } : x)); }
  function setQuickNote(id, notes){ setDealNotes(id, notes); }

  function openReview(d) { setTriageOpen({ open: true, response: SAMPLE_RESPONSES[0] }); }
  function killLead(d) { window.alert(`Kill ${d.company} → Closed/Lost`); }

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#f9fafb", color: "#111827" }}>
      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "white", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ height: 32, width: 32, borderRadius: 8, background: "black", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>C</div>
          <div style={{ fontWeight: 600 }}>CFO Worx — CRM Preview</div>
          <div style={{ margin: "0 16px", height: 24, width: 1, background: "#e5e7eb" }} />
          <nav style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setTab("sales")} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 14, background: tab==="sales"?"#111827":"transparent", color: tab==="sales"?"white":"#111827" }}>Sales CRM</button>
            <button onClick={() => setTab("sell")} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 14, background: tab==="sell"?"#111827":"transparent", color: tab==="sell"?"white":"#111827" }}>M&A Sell‑Side</button>
            <button onClick={() => setTab("buy")} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 14, background: tab==="buy"?"#111827":"transparent", color: tab==="buy"?"white":"#111827" }}>M&A Buy‑Side</button>
            <button onClick={() => setTab("reports")} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 14, background: tab==="reports"?"#111827":"transparent", color: tab==="reports"?"white":"#111827" }}>Reports</button>
            <button onClick={() => setTab("settings")} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 14, background: tab==="settings"?"#111827":"transparent", color: tab==="settings"?"white":"#111827" }}>Settings</button>
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <select value={role} onChange={(e)=>setRole(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>Connect ListKit</button>
            <button style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>Connect Dripify</button>
            <button style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>Connect DocuSign</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 24 }}>
        {tab === "sales" && (
          <>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "white", padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, color: "#374151" }}>Daily Prospect Triage — {SAMPLE_RESPONSES.length} new responses from ListKit/Dripify</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={()=>setTriageOpen({ open: true, response: SAMPLE_RESPONSES[0] })} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>Open Queue</button>
                <button style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>Bulk Kill Negatives</button>
              </div>
            </div>
            <Board
              title="Pipeline — Sales"
              stages={SALES_STAGES}
              deals={salesDeals}
              onOpen={(d) => setDrawer(d)}
              onOpenQuote={(d) => setQuoteOpen(d)}
              onKill={killLead}
              onReview={openReview}
              role={role}
              extraHeader={<div style={{ fontSize: 12, color: "#6b7280" }}>Auto‑close won when DocuSign is signed ✔︎</div>}
              setQuickNote={setQuickNote}
            />
          </>
        )}

        {tab === "sell" && (
          <Board
            title="Pipeline — M&A Sell‑Side (Investors/Buyers)"
            stages={SELL_SIDE_STAGES}
            deals={sellDeals}
            onOpen={(d) => setDrawer(d)}
            onOpenQuote={(d) => setQuoteOpen(d)}
            onKill={killLead}
            onReview={openReview}
            role={role}
            extraHeader={<button style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14 }}>New Investor List</button>}
            setQuickNote={setQuickNote}
          />
        )}

        {tab === "buy" && (
          <Board
            title="Pipeline — M&A Buy‑Side (Targets)"
            stages={BUY_SIDE_STAGES}
            deals={buyDeals}
            onOpen={(d) => setDrawer(d)}
            onOpenQuote={(d) => setQuoteOpen(d)}
            onKill={killLead}
            onReview={openReview}
            role={role}
            extraHeader={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14 }}>
                  <option>Weekly</option>
                  <option>Every 2 Weeks</option>
                </select>
                <button onClick={()=>setShareOpen(true)} style={{ padding: "8px 12px", borderRadius: 12, background: "#059669", color: "white", fontSize: 14 }}>Share Update</button>
              </div>
            }
            setQuickNote={setQuickNote}
          />
        )}

        {tab === "reports" && (
          <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>Reporting Dashboard</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <span>to</span>
                <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <select value={reportTab} onChange={(e)=>setReportTab(e.target.value)} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  <option>Overview</option>
                  <option>Closed/Lost</option>
                  <option>Lead Source</option>
                  <option>Rep Performance</option>
                  <option>Goals vs Actual</option>
                </select>
                <button style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Run</button>
              </div>
            </div>

            {reportTab === "Overview" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12, fontSize: 14 }}>
                  <Metric title="Deal Value by Stage" value="$412k" />
                  <Metric title="Deals by Stage" value={String(salesDeals.length)} />
                  <Metric title="Conversion Rate (Overall)" value="26%" />
                  <Metric title="Top Lead Source" value="Referral" />
                  <Metric title="MRR vs One‑time" value="$120k / $40k" />
                  <Metric title="Expected Value (EV)" value={currency(expectedValue)} />
                </div>
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Stale Deals (per-stage thresholds)</div>
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                      <table style={{ width: "100%", fontSize: 14 }}>
                        <thead style={{ background: "#f9fafb", color: "#6b7280" }}><tr><th style={{ textAlign: "left", padding: "6px 10px" }}>Deal</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Stage</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Owner</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Last Activity</th></tr></thead>
                        <tbody>
                          {salesDeals.slice(0, 3).map((d) => (<tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}><td style={{ padding: "6px 10px" }}>{d.company}</td><td style={{ padding: "6px 10px" }}>{d.stage}</td><td style={{ padding: "6px 10px" }}>{d.owner}</td><td style={{ padding: "6px 10px", color: "#6b7280" }}>{d.lastActivity}</td></tr>))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Closed/Lost (within range)</div>
                    {(() => {
                      const rows = salesDeals.filter(d => d.stage === "Closed/Lost" && inRange(d.closedDate, startDate, endDate));
                      return (
                        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                          <table style={{ width: "100%", fontSize: 14 }}>
                            <thead style={{ background: "#f9fafb", color: "#6b7280" }}><tr><th style={{ textAlign: "left", padding: "6px 10px" }}>Deal</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Reason</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Owner</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Date</th></tr></thead>
                            <tbody>
                              {rows.length === 0 && <tr><td style={{ padding: "8px 10px", color: "#6b7280" }} colSpan={4}>No closed/lost in the selected range.</td></tr>}
                              {rows.map((d) => (<tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}><td style={{ padding: "6px 10px" }}>{d.company}</td><td style={{ padding: "6px 10px" }}>{d.closedReason || "—"}</td><td style={{ padding: "6px 10px" }}>{d.owner}</td><td style={{ padding: "6px 10px" }}>{d.closedDate || "—"}</td></tr>))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {reportTab === "Closed/Lost" && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <label style={{ fontSize: 14 }}>Reason
                    <select value={closedReason} onChange={(e)=>setClosedReason(e.target.value)} style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                      <option>All</option>
                      <option>Price</option>
                      <option>Lost to Competitor</option>
                      <option>Requoted - Reduced Service Level</option>
                      <option>Requoted - Other</option>
                      <option>Delayed to future date</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <button style={{ marginLeft: "auto", padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>Export CSV</button>
                </div>
                {(() => {
                  const rows = salesDeals.filter(d => d.stage === "Closed/Lost" && inRange(d.closedDate, startDate, endDate) && (closedReason==="All" || d.closedReason === closedReason));
                  return (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                      <table style={{ width: "100%", fontSize: 14 }}>
                        <thead style={{ background: "#f9fafb", color: "#6b7280" }}><tr><th style={{ textAlign: "left", padding: "6px 10px" }}>Deal</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Reason</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Owner</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Closed Date</th><th style={{ textAlign: "left", padding: "6px 10px" }}>TCV</th></tr></thead>
                        <tbody>
                          {rows.length === 0 && <tr><td style={{ padding: "8px 10px", color: "#6b7280" }} colSpan={5}>No results.</td></tr>}
                          {rows.map((d) => (<tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}><td style={{ padding: "6px 10px" }}>{d.company}</td><td style={{ padding: "6px 10px" }}>{d.closedReason || "—"}</td><td style={{ padding: "6px 10px" }}>{d.owner}</td><td style={{ padding: "6px 10px" }}>{d.closedDate || "—"}</td><td style={{ padding: "6px 10px" }}>{currency(d.amount)}</td></tr>))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {reportTab === "Lead Source" && (
              <div style={{ marginTop: 16 }}>
                {(() => {
                  const agg = {};
                  salesDeals.forEach(d => {
                    const key = d.source || "Unknown";
                    agg[key] = agg[key] || { count: 0, value: 0, won: 0 };
                    agg[key].count += 1;
                    agg[key].value += d.amount || 0;
                    if (d.stage === "Closed/Won") agg[key].won += 1;
                  });
                  const rows = Object.entries(agg).map(([k,v]) => ({ source: k, ...v, conv: v.count ? Math.round((v.won/v.count)*100) : 0 }));
                  return (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                      <table style={{ width: "100%", fontSize: 14 }}>
                        <thead style={{ background: "#f9fafb", color: "#6b7280" }}><tr><th style={{ textAlign: "left", padding: "6px 10px" }}>Lead Source</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Deals</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Total Value</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Closed Won</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Conversion</th></tr></thead>
                        <tbody>
                          {rows.map((r,i)=>(<tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}><td style={{ padding: "6px 10px" }}>{r.source}</td><td style={{ padding: "6px 10px" }}>{r.count}</td><td style={{ padding: "6px 10px" }}>{currency(r.value)}</td><td style={{ padding: "6px 10px" }}>{r.won}</td><td style={{ padding: "6px 10px" }}>{r.conv}%</td></tr>))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {reportTab === "Rep Performance" && (
              <div style={{ marginTop: 16 }}>
                {(() => {
                  const agg = {};
                  salesDeals.forEach(d => {
                    const key = d.owner || "Unassigned";
                    const ev = (d.amount || 0) * (stageConfig[d.stage]?.prob ?? 0);
                    if (!agg[key]) agg[key] = { deals: 0, value: 0, ev: 0, quotes: 0, won: 0 };
                    agg[key].deals += 1;
                    agg[key].value += d.amount || 0;
                    agg[key].ev += ev;
                    if (d.stage === "Quote Sent" || d.stage === "Quoted Follow Up") agg[key].quotes += 1;
                    if (d.stage === "Closed/Won") agg[key].won += 1;
                  });
                  const rows = Object.entries(agg).map(([k,v]) => ({ rep: k, ...v }));
                  return (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                      <table style={{ width: "100%", fontSize: 14 }}>
                        <thead style={{ background: "#f9fafb", color: "#6b7280" }}><tr><th style={{ textAlign: "left", padding: "6px 10px" }}>Rep</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Deals</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Pipeline Value</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Expected Value</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Quotes Sent</th><th style={{ textAlign: "left", padding: "6px 10px" }}>Closed Won</th></tr></thead>
                        <tbody>
                          {rows.map((r,i)=>(<tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}><td style={{ padding: "6px 10px" }}>{r.rep}</td><td style={{ padding: "6px 10px" }}>{r.deals}</td><td style={{ padding: "6px 10px" }}>{currency(r.value)}</td><td style={{ padding: "6px 10px" }}>{currency(r.ev)}</td><td style={{ padding: "6px 10px" }}>{r.quotes}</td><td style={{ padding: "6px 10px" }}>{r.won}</td></tr>))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {reportTab === "Goals vs Actual" && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14 }}>
                  <label>Period
                    <select value={goalsPeriod} onChange={(e)=>setGoalsPeriod(e.target.value)} style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </label>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {SAMPLE_USERS.filter(u=>u.role==='REP').map(u=>{
                    const g = (goals[u.id]?.[goalsPeriod]) || {};
                    const myDeals = salesDeals.filter(d=>d.owner===u.name);
                    const booked = myDeals.filter(d=>d.stage==='Call Booked').length;
                    const attended = Number(g.attendedActual || 0); // manual input elsewhere
                    const quotes = myDeals.filter(d=>d.stage==='Quote Sent' || d.stage==='Quoted Follow Up').length;
                    const totalQuote = myDeals.filter(d=>d.stage==='Quote Sent' || d.stage==='Quoted Follow Up').reduce((s,d)=>s+(d.amount||0),0);
                    const avgQuote = quotes ? Math.round(totalQuote/quotes) : 0;
                    const closed = myDeals.filter(d=>d.stage==='Closed/Won').length;
                    const Row = ({label, val, target}) => (
                      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr 6fr 1fr", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 6 }}>
                        <div style={{ color: "#6b7280" }}>{label}</div>
                        <div>{label.includes("Quote") ? currency(val) : val}</div>
                        <div style={{ height: 8, background: "#e5e7eb", borderRadius: 6 }}>
                          <div style={{ height: 8, width: `${target>0?Math.min(100, Math.round((val/target)*100)):0}%`, background: "#2563eb", borderRadius: 6 }} />
                        </div>
                        <div style={{ textAlign: "right", color: "#6b7280" }}>{target || 0}</div>
                      </div>
                    );
                    return (
                      <div key={u.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                        <div style={{ fontWeight: 500, marginBottom: 8 }}>{u.name}</div>
                        <Row label="Meetings Booked" val={booked} target={Number(g.booked||0)} />
                        <Row label="Meetings Attended" val={attended} target={Number(g.attended||0)} />
                        <Row label="Quotes Sent" val={quotes} target={Number(g.quotes||0)} />
                        <Row label="Total Quote $" val={totalQuote} target={Number(g.totalQuote||0)} />
                        <Row label="Avg Quote $" val={avgQuote} target={Number(g.avgQuote||0)} />
                        <Row label="Closed Deals" val={closed} target={Number(g.closed||0)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "settings" && (
          <SettingsPage
            stageConfig={stageConfig}
            setStageConfig={setStageConfig}
            sources={sources}
            setSources={setSources}
            templates={templates}
            setTemplates={setTemplates}
            users={SAMPLE_USERS}
            goals={goals}
            setGoals={setGoals}
          />
        )}
      </div>

      <LeadDrawer
        open={!!drawer}
        onClose={()=>setDrawer(null)}
        stages={tab === "sales" ? SALES_STAGES : tab === "sell" ? SELL_SIDE_STAGES : BUY_SIDE_STAGES}
        deal={drawer}
        onOpenDedupe={(d)=>setDedupe({ left: d, right: { ...d, contact: "Possible Duplicate" } })}
        onOpenQuote={(d)=>setQuoteOpen(d)}
        onMarkWon={(d)=>setHandoffOpen(d)}
        setDealNotes={setDealNotes}
      />
      <DedupeModal open={!!dedupe} onClose={()=>setDedupe(null)} left={dedupe?.left || null} right={dedupe?.right || null} />
      <QuoteBuilder open={!!quoteOpen} onClose={()=>setQuoteOpen(null)} deal={quoteOpen} />
      <OnboardingChecklist open={!!handoffOpen} onClose={()=>setHandoffOpen(null)} deal={handoffOpen} />
      <ProspectTriage
        open={triageOpen.open}
        onClose={()=>setTriageOpen({ open: false, response: null })}
        response={triageOpen.response}
        templates={templates}
        onKill={(reason, reply)=>{ window.alert(`Killed as ${reason}. Reply sent? ${!!reply}`); setTriageOpen({ open: false, response: null }); }}
        onPromote={(reply)=>{ window.alert(`Promoted to Lead. Reply sent? ${!!reply}`); setTriageOpen({ open: false, response: null }); }}
      />
      <ShareUpdateModal open={shareOpen} onClose={()=>setShareOpen(false)} moduleTitle={tab === "buy" ? "Buy‑Side" : "Sell‑Side"} />
    </div>
  );
}
