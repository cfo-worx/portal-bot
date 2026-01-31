# Reports Module – Remaining Fixes / Enhancements (Next Iteration)

Below are the highest-value remaining items after the Top 25 fixes. These are prioritized for impact and risk.

## P0 – Correctness / Data Integrity
1. **Client “attention risk” signal is not implemented end-to-end**
   - Add a clear definition (e.g., expected vs. actual “client attention” hours or last-touch timestamp per client), then generate an issue when outside tolerance.
   - Wire into weekly issues + client health.

2. **Contract revenue recognition edge cases need explicit rules**
   - Mid-month starts/ends and “earned-at-completion” project revenue should be reflected consistently in daily earned revenue and projections.

3. **Benchmark distribution management needs a per-client UX**
   - The patch adds *Benchmark DistributionType* and a *global default*, but there’s no bulk/per-client editor.

## P1 – UX / Manager Workflow
4. **Weekly Review Session object (CFO meeting workflow)**
   - Persist “weekly review notes” by week, client, and consultant, with prior-week carry-forward.

5. **Snooze patterns**
   - Add additional snooze options: `+2 weeks`, `+30 days`, `until next payroll`, etc.

6. **Improve table drilldowns**
   - Add click-through from summary tables to “client/consultant detail” pages with the same filter context.

## P2 – Reporting Depth / Forecasting
7. **Trailing 3-month GM expectation recommendations**
   - Compute trailing GM% and alert if expectation differs by >X% (configurable).

8. **Software revenue/cost tracking**
   - Add separate lines and reporting for software revenue and software COGS; allow “provided free” cases.

9. **Capacity planning (next month) with contract ending signals**
   - Show projected utilization next month using active benchmarks and known term end dates.
