# CFO Worx CRM — Exportable Preview Module

**What’s included**
- A self‑contained React component (`CRMApp.jsx`) that renders the new CRM UX:
  - **Sales CRM** pipeline with Prospect → Lead → Call Booked → Follow Up → Quote Sent → Quoted Follow Up → Closed/Won → Closed/Lost
  - **M&A Sell‑Side** pipeline (Teaser, NDA flow, CIM, IOI, LOI, DD)
  - **M&A Buy‑Side** pipeline (Positive Response → Call Scheduled → NDA → Financials → IOI → LOI → DD) with **email digest composer** (deal‑level only; no PII)
  - **Reporting**: Closed/Lost (with reason filter), **Lead Source**, **Rep Performance**, **Goals vs Actual**, KPIs, and **date range** pickers
  - **Settings**: Stage probabilities & stale thresholds, Lead Sources, **Canned Replies**, and **Per‑Rep Goals** (weekly/monthly/quarterly)
  - **Prospect triage** queue (review/kill/promote + canned replies), **De‑dupe** modal, **Quote Builder** (DocuSign CTA), and **Onboarding checklist** (triggered after DocuSign)
- Integration stubs in `/src/integrations/*` for **ListKit**, **Dripify**, **DocuSign**, and **Read.ai**.

> This bundle is front‑end only with mock data. Replace the SAMPLE_* arrays and wire the integration stubs to your backend when ready.

---

## Screens & flows

### 1) Sales CRM (all roles see)
- Kanban board by stage; each card shows company, owner, value, source, last activity.
- **Prospect** cards include **Review** and **Kill** buttons (fast triage).
- Card and Drawer support **Notes** (visible to all roles).
- **Quote Builder** computes **MRR**, **TCV**, and provides **Send via DocuSign**.
- When DocuSign completes, trigger **Onboarding checklist** (client creation + link via `info@cfo-worx.com`).

### 2) M&A Sell‑Side / Buy‑Side
- Separate pipelines to avoid polluting Sales CRM.
- **Buy‑Side email digest composer**: “deal‑level only” status table + notes, sent from `info@cfo-worx.com`.

### 3) Reports (historic & filters)
- Date range pickers (start / end) for **historic** reporting.
- **Closed/Lost** table with **Reason** filter + export stub.
- **Lead Source**: deals, value, closed‑won, conversion %.
- **Rep Performance**: pipeline $, EV (stage prob × TCV), quotes sent, wins.
- **Goals vs Actual**: per‑rep progress bars for booked, attended (manual), quotes, total/avg quote $, and closed.

### 4) Settings
- **Stage probabilities** & **Stale thresholds** (days) — defaults included; editable in app.
- **Lead Sources** and **Canned Replies** editors.
- **Targets & Goals** per rep (weekly / monthly / quarterly).

---

## Key behaviors modeled
- **Fast negative triage** (Review/Kill) to keep Prospect inbox clean.
- **De‑dupe** by email/domain with side‑by‑side resolution.
- **Auto‑onboarding** path once quote is DocuSigned (checklist modal).
- **Admin‑only exports**; managers/reps see their deals (RBAC wire‑up pending).

---

## Integration touchpoints (stubs)
- **ListKit.io**: ingest replies to Prospect queue; send canned replies back.
- **Dripify**: auto‑promote to Prospect on response; canned replies.
- **DocuSign**: one envelope per quote; on `completed` → onboarding flow.
- **Read.ai**: meeting summaries feed to support quoting & follow‑ups.

Wire these through your backend for auth/secret management. See `/src/integrations/*.js`.

---

## Data model (front‑end shape)
`Deal` (subset shown): 
```js
{
  id, module: "sales"|"sell"|"buy", company, contact, title?,
  amount?, mrr?, owner, source, stage, lastActivity?,
  lastActivityDays?, activityCount?, companySize? ("S"|"M"|"L"),
  closedReason?, closedDate?, notes?,
  details?: { /* Sales Data Variables from spec (QBO, revenue, EBITDA, etc.) */ }
}
```

**Lead Score (heuristic example):**
- Stage prob (×40), Value (TCV + 12×MRR scaled to max 30), Activity (count & recency up to ~30), Company size (up to 15), Manual boost.
- Capped to 100. (See `computeLeadScore` in `CRMApp.jsx`.)

---

## How to integrate (frontend)
1. **Copy files** to your project, e.g. `src/modules/crm/`.
2. **Import & route** into your portal (React):
   ```jsx
   import CRMApp from "./modules/crm/CRMApp";
   // ...
   <Route path="/crm" element={<CRMApp />} />
   ```
3. If your app uses Tailwind or MUI already, styling will blend. Otherwise, this module uses **inline styles** and minimal classes — no extra deps.

### Backend/API
- Add endpoints to proxy ListKit, Dripify, DocuSign, Read.ai (server stores secrets).
- Persist stage config, lead sources, templates, goals, notes, and deals to your DB.
- Enforce **RBAC**: reps see own deals; managers/admin see all; exports admin‑only.
- Add **OOO forwarding** and **termination reassignment** flows (scoped to Sales deals).

---

## Next steps
- Replace mock SAMPLE_* with real data.
- Hook **DocuSign → onboarding** and **Buy‑Side digest email**.
- Persist **goals** and **notes**.
- Add **historic exports** & pinned **stale deals** widget on home.
- Optional: **Night mode toggle**, OOO forwarding, termination reassignment.