# CFO Worx Portal — CRM UI vNext (Developer Notes)

This ZIP focuses on delivering a **finished, navigable CRM UI** across:
- Sales pipeline
- M&A Sell-Side pipeline
- M&A Buy-Side pipeline (with Client/Campaign filters)
- Prospect Queue (claim unassigned prospects)
- Lead Database (Admin/Manager UI-first upload + filtering preview)
- Reports (Admin/Manager UI-first summary)

It is intentionally **UI-first**: some items require additional backend tables/endpoints and integration keys.

---

## What was updated

### 1) Sales role routing + nav
**Files updated:**
- `client/src/App.jsx`
- `client/src/components/Layout/DashboardLayout.jsx`

**What changed:**
- Added `/dashboard/sales/*` routes:
  - `/dashboard/sales/crm`
  - `/dashboard/sales/history` (timecard history)
- Added Sales portal menu items ("CRM", "Timesheets")
- Added role redirect support for Sales.

---

## CRM UI updates

### Tabs + screens
**File updated:**
- `client/src/modules/crm/CRMPage.jsx`

**Tabs (role gated):**
- Sales Pipeline (all roles that have CRM access)
- Lead Database (Admin + Manager)
- Prospect Queue (Sales + Admin + Manager)
- M&A Sell-Side Pipeline
- M&A Buy-Side Pipeline (Client/Campaign filters from DetailsJson)
- Reports (Admin + Manager)
- Settings (Admin + Manager)

---

### Pipeline UI
**File updated:**
- `client/src/modules/crm/components/SalesCRM.jsx`

**Key UI features now implemented:**
- **Board view + Table view toggle**
  - Board: Kanban columns, scrollable
  - Table: DataGrid
- **Drag & drop move between stages** (Board view)
  - Uses `react-beautiful-dnd`
  - Persists stage changes via `PUT /api/crm/deals/:dealId`
- **Quick “Log Call”**
  - Available from card or table actions
  - Outcome: No answer / Voicemail left / Answered
  - Saves to timeline via `POST /api/crm/deals/:dealId/timeline`
- **Buy-side client/campaign filtering**
  - Enabled when `enableClientCampaignFilters` prop is true
  - Reads from `DetailsJson` using keys:
    - client: `buySideClient`, `client`, `clientName`, `client_company`
    - campaign: `campaign`, `campaignName`, `strategy`, `pipeline`
  - UI: 2 Autocomplete selectors + Clear button

**Important behavior:**
- For roles `Sales` and `Consultant`:
  - Sales + Sell modules default to **ownerId = current user consultantId**
  - Buy module defaults to **all deals** (per your earlier direction: sales can see all buy-side campaigns)

> If you want stricter permissions (sales only see assigned buy-side items), adjust the `loadData` filter logic in `SalesCRM.jsx`.

---

### Prospect Queue
**New file:**
- `client/src/modules/crm/components/ProspectQueue.jsx`

**What it does (current implementation):**
- Fetches all Sales module deals
- Filters queue to:
  - `OwnerID IS NULL`
  - `StageName === 'Prospect'`
- Allows Sales users to **Claim**:
  - Updates `OwnerID` to `auth.user.consultantId`
  - Uses existing `updateDeal()` API

**Backend follow-up recommended:**
- Add a server-side filter `unassigned=true` for scalability:
  - `WHERE d.OwnerID IS NULL`
- Add assignment method options in settings (round robin / specialty / workload / performance weighting).

---

### Lead Database (UI-first preview)
**New file:**
- `client/src/modules/crm/components/LeadDatabase.jsx`

**What it does now:**
- Allows Admin/Manager to upload CSV/XLS/XLSX
- Parses file with `xlsx`
- Renders DataGrid with search

**Backend work required to make it “real”:**
- Create Lead/Account schema and endpoints (suggested below).

---

### Reports (UI-first summary)
**New file:**
- `client/src/modules/crm/components/CRMReports.jsx`

**What it does now:**
- Loads deals for modules: sales, sell, buy
- Shows:
  - Total deals
  - Open deals
  - Closed won
  - Pipeline value
  - Stage breakdown (count + value)

**Backend work required to match full spec:**
- KPI aggregation endpoints (calls made, meetings booked, quotes sent, follow-ups completed)
- SLA miss metrics per rep (daily/weekly/monthly)
- Targets + trend visualization (daily/weekly/monthly/quarterly).

---

## Backend TODO checklist (expanded)

### A) Data model & endpoints
1. **Lead / Account database**
   - Tables:
     - `CRMAccount` (Company)
     - `CRMContact` (many contacts per account)
     - `CRMLead` (optional if you separate lead vs account; or use Account + Status)
     - `CRMFieldProvenance` (tracks source for each auto-filled field)
   - Endpoints:
     - `GET /api/crm/leads` (filter/sort/search; role-gated)
     - `POST /api/crm/leads/import` (CSV/XLS import, de-dupe)
     - `POST /api/crm/leads` (create)
     - `PUT /api/crm/leads/:id` (update)
     - `DELETE /api/crm/leads/:id` (admin-only)
   - De-duplication rules (recommended):
     - By email (contact)
     - By domain + normalized company name (account)

2. **Tasks & reminders**
   - Table: `CRMTask`
     - Types: call, email, follow-up, meeting prep, quote prep, other
     - Due datetime
     - Completed datetime
     - Assigned to
     - Related to: dealId + (optional) leadId
   - Endpoints:
     - CRUD tasks, plus `GET /api/crm/tasks?assignedTo=...&dueBefore=...`
   - UI wiring:
     - Add a “Tasks” tab or embedded panel in the deal drawer.

3. **Automations engine**
   - Table: `CRMAutomationRule`
   - Core actions (per your spec):
     - Create task “call within 1 hour”
     - Mark contacted/uncontacted, update score, add tag
     - Create prospect for review when:
       - score > 70 AND website visit > 20 seconds (Snitcher)
   - Needed:
     - Event bus or job runner (BullMQ, cron, etc.)
     - Idempotency keys for webhooks

4. **Closed/Lost reason capture**
   - Add required field on deal close:
     - `ClosedLostReason` and optional notes
   - Enforce:
     - UI + backend validation (allow “Unknown”)

5. **Permission enforcement**
   - Roles:
     - Admin: full
     - Manager: full except deletes and exports
     - Sales: view assigned activities; create/edit deals; move stages; cannot delete; reports only self + targets; (you can also allow “all buy-side campaigns” as current UI)
     - Consultant: no CRM (as per your note)
   - Implement server-side checks using JWT roles.

---

### B) Email + calendar integration
1. **Outlook email sync**
   - Microsoft Graph
   - Requirements:
     - OAuth per user (not shared service account) OR a delegated app if that fits your policies
   - Store:
     - messageId, threadId, from/to/cc, subject, snippet/body, timestamps
   - UI:
     - Deal drawer “Emails” panel (already in spec; not yet implemented)

2. **Outlook calendar integration**
   - Graph calendar events:
     - Create meeting event from CRM task/meeting
     - Store eventId -> dealId mapping
   - UI:
     - In-app calendar view + “Open in Outlook” link
   - Note:
     - You stated meeting titles vary; do not enforce event name matching—use contact association.

---

### C) Quote workflow
1. **Discovery notes -> scope draft**
   - ChatGPT usage:
     - Use internal service that calls OpenAI API with a controlled prompt template
     - Store:
       - input notes
       - generated scope version history
2. **Canva collateral + quote updates**
   - Likely manual API integration (Canva has APIs; confirm scope + access)
   - UI:
     - “Collateral” library tab and quick-send
3. **DocuSign**
   - Create envelope from quote PDF
   - Track envelope status (sent, viewed, signed)
   - Update deal stage automatically on signature if desired

---

### D) Data sources + enrichment
You listed tools:
- LinkedIn (company page + Sales Navigator)
- Smartlead
- Listkit.io
- Clay
- Seamless.ai
- Dripify
- Snitcher
- (considering) Opensend

Recommended integration pattern:
1. **Normalized “DataSource” layer**
   - `CRMDataSourceEvent` table for inbound events (reply, visit, enrichment update)
2. **Field provenance**
   - For every auto-filled field, store:
     - source tool
     - timestamp
     - raw payload reference
3. **Rate limiting + retries**
   - Background worker
   - Dead-letter queue for failures

---

### E) Security / compliance / auditing
1. **Export auditing**
   - Requirement: any Lead Database export triggers email alert to Brian@cfo-worx.com
   - Implement:
     - `CRMExportAudit` table
     - server email notification hook
2. **Role-gated exports**
   - Only Admin can export
3. **PII handling**
   - Redaction options in exports if needed
   - Access logs for admin screens

---

## Environment / API keys (you will need to supply)
- Microsoft Graph (Outlook email/calendar)
- DocuSign
- OpenAI API key (for discovery -> quote workflow)
- Snitcher (web visit events)
- Smartlead / Clay / Listkit / Seamless / Dripify / Opensend (as applicable)
- Any internal SMTP / transactional email provider (SendGrid/Postmark/etc.)

---

## Quick local run
From repo root:
1. `cd client && npm install && npm run dev`
2. `cd server && npm install && npm run dev`
3. Ensure API base URL is correct in `client/src/api/api.js`

---

## Notes on buy-side client/campaign filters
The current UI expects buy-side deals to have DetailsJson like:
```json
{
  "clientName": "Client A",
  "campaignName": "Roofing",
  "criteria": {
    "revenue": "10-50M",
    "industry": "Roofing",
    "geography": ["TX","OK"]
  }
}
```

You can extend the Deal create/edit UI to capture these and persist in `DetailsJson`.

