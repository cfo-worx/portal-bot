# Reports Module – Fixes Applied (Top 25)

This patch focuses on correctness of filters/date logic, usability of the reporting UI, and data integrity for MTD/EOM performance monitoring.

## 1) Filters / Routing / Wiring
1. **Fixed filter thrash / repeated refetch** by memoizing the `filters` object in `client/src/modules/reports/ReportsPage.jsx`.
2. **Fixed Express query parsing for multi-select filters** (clientIds / consultantIds) to handle both `?clientIds=1&clientIds=2` and `?clientIds=1,2` in `server/controllers/performanceReportController.js`.
3. **Wired `includeSubmitted` end-to-end** (Reports tabs + weekly issues) so the backend receives and respects the flag.
4. **Wired the Role filter end-to-end** (UI → API → backend), including weekly issues.

## 2) Date & Period UX (As-of, MTD, Next Month)
5. Added Period option: **Next Month** (for projection). `ReportsPage.jsx`.
6. Added Period option: **Custom Range** (start/end date). `ReportsPage.jsx`.
7. Added **As-of preset**: Period Start / Today / Period End / Custom Date. `ReportsPage.jsx`.
8. Added **clamp + validation** so As-of always stays within the active Period window. `ReportsPage.jsx`.

## 3) Dropdown Quality (sorting + active-only)
9. Client dropdown now defaults to **Active clients only**, with a toggle to include inactive. `ReportsPage.jsx`.
10. Consultant dropdown now defaults to **Active consultants only**, with a toggle to include inactive. `ReportsPage.jsx`.
11. Client dropdown **alphabetized** by ClientName. `ReportsPage.jsx`.
12. Consultant dropdown **alphabetized** by LastName, FirstName. `ReportsPage.jsx`.
13. When “All” is selected and Active-only toggles are ON, the report calls are automatically filtered to the **active IDs list** (so inactive clients do not pollute dashboards). `ReportsPage.jsx`.

## 4) Trends Tab – Expected Progress + Real Data
14. Fixed Trends to use backend `trend` series (removed broken `dailyTrends` placeholder). `client/src/modules/reports/components/TrendsTab.jsx`.
15. Split Trends into two charts:
    - **Earned Revenue vs Earned GM (cumulative)**
    - **Hours progress: Actual vs Expected (cumulative)**

## 5) Client Health Tab – Variance Visibility + Drilldown
16. Added/standardized **MTD and EOM variance fields** in backend byClient aggregation (variance hours + variance %). `server/models/PerformanceReport.js`.
17. Updated Client Health table columns to:
    - Actual MTD, Expected MTD, Hours Var MTD
    - Proj EOM, Benchmark EOM, Hours Var EOM
18. Added **ratio bars** (Actual vs Expected) and severity shading based on warn/crit tolerances. `ClientHealthTab.jsx`.
19. Replaced fake drilldown with a **real drilldown chart** using a client-filtered report trend. `ClientHealthTab.jsx`.

## 6) Consultant Utilization Tab – Money Formatting + Assignment Detail
20. Fixed Bench Cost formatting to **USD cents** (2 decimals). `ConsultantUtilizationTab.jsx`.
21. Normalized utilization values to avoid 0–1 vs 0–100 scaling errors. `ConsultantUtilizationTab.jsx`.
22. Added **assignment detail** list in backend byConsultant output and used it for the drilldown table. `server/models/PerformanceReport.js` + `ConsultantUtilizationTab.jsx`.

## 7) Issues Queue – Correct API Calls + Snooze
23. Fixed issues query building to pass arrays (no string `.forEach` bug) and include Role/includeSubmitted correctly. `IssuesQueueTab.jsx`.
24. Fixed note upsert payload to send **`issueType` correctly**, and added **month-end snooze**. `IssuesQueueTab.jsx`.

## 8) Contracts Watchlist – Correct Shape + Days Ahead
25. Fixed contracts watchlist to:
    - Consume the correct `{ contracts: [...] }` API shape
    - Respect daysAhead in backend query
    - Include client name/status and computed Initial Term End / Effective End
    `server/models/PerformanceReport.js` + `ContractsTab.jsx`.

