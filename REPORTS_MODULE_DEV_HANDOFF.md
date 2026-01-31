# Developer Handoff – Reports Module Patch (Top 25 Fixes)

## What’s in this patch
- Fixes the biggest correctness/usability issues in the new Reports module (filters, date logic, expected vs. actual, inactive filtering, and broken screens).
- Adds missing wiring in the API/controller so multi-select client/consultant filters *actually work*.
- Improves the quality of the “Trends”, “Client Health”, “Consultant Utilization”, “Issues Queue”, “Contracts”, and “Settings” tabs.
- Adds benchmark distribution support (front/back-loaded) via `DistributionType` on Benchmarks (plus global default fallback).

## Files changed (high level)
### Front-end
- `client/src/modules/reports/ReportsPage.jsx` (period/as-of logic, active-only toggles, stable filters, sorting)
- `client/src/modules/reports/components/TrendsTab.jsx` (uses backend trend data; fixed expected progress)
- `client/src/modules/reports/components/ClientHealthTab.jsx` (MTD/EOM variance columns, severity coloring, drilldown chart)
- `client/src/modules/reports/components/ConsultantUtilizationTab.jsx` (currency formatting, normalized utilization, assignment detail)
- `client/src/modules/reports/components/IssuesQueueTab.jsx` (fixed API wiring, snooze month-end, correct issue type)
- `client/src/modules/reports/components/ContractsTab.jsx` (correct API response handling, days-until-end display)
- `client/src/modules/reports/components/SettingsTab.jsx` (exposes + persists settings, removes hard-coded defaults)
- `client/src/modules/admin/components/Clients/BenchmarkForm.jsx` (adds `DistributionType` field)
- `client/src/api/performanceReports.js` (adds missing `role` param; weekly issues role)

### Back-end
- `server/controllers/performanceReportController.js` (proper parsing of array query params; role pass-through)
- `server/routes/performanceReportRoutes.js` (adds `/roles` endpoint)
- `server/models/PerformanceReport.js` (role filtering; variances in byClient/byRole; assignments array; improved contracts ending)
- `server/models/Benchmark.js` (supports `DistributionType`, including history)
- `server/models/GlobalSetting.js` + `server/controllers/globalSettingController.js` (adds + validates new performance reporting settings)

## DB changes / migrations
### 1) GlobalSettings columns
Run:
- `server/migrations/add_globalsettings_reporting_fields.sql`

This adds:
- `GlobalSettings.AttentionRiskDays`
- `GlobalSettings.DefaultDistributionType`

### 2) Benchmark distribution column
This repo already has a migration adding Benchmark distribution fields (`create_performance_reporting_tables.sql`), but verify:
- `Benchmark.DistributionType` exists
- `BenchmarkHistory.DistributionType` exists

If `BenchmarkHistory.DistributionType` does *not* exist in your DB, add it to match the query in `PerformanceReport.js`.

## Deploy / smoke test steps
1. **Run migrations** (above).
2. Restart server + client.
3. Go to **Reports** → confirm:
   - Changing **Client** filter *actually changes* results (verify by selecting a single client).
   - Turning on **Include Submitted** changes numbers (approved-only vs include-submitted).
   - **Period** supports Next Month and Custom Range; **As-of** supports Custom date.
   - **Client Health** shows MTD + EOM variances and row highlights.
   - **Issues Queue**: opening a row, adding a note + decision saves and persists; snooze “End of period” sets a future date.
   - **Contracts** shows contracts in the next N days (default 60) with correct days-until.
4. Spot-check values:
   - Use a known client with active benchmarks and entered timecards.
   - Validate “Actual MTD” equals approved timecard hours up to the As-of date.
   - Validate “Expected MTD” increases across the month (not tiny near-zero values).

## Known limitations (not part of this Top 25)
See `REPORTS_REMAINING_FIXES_NEXT.md` for the prioritized backlog.
