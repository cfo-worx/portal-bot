import cron from "node-cron";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { poolPromise } from "../db.js";
import { getGovernanceSettings } from "../models/GovernanceSettings.js";
import { sendTeamsWebhookMessage } from "../utils/teamsWebhook.js";

dayjs.extend(utc);
dayjs.extend(timezone);

function formatDate(d) {
  try {
    return dayjs(d).format("YYYY-MM-DD");
  } catch {
    return String(d);
  }
}

export function scheduleGovernanceDigestJob() {
  // Note: schedule uses cron expression stored in GovernanceSettings.
  // If settings can't be read, default to 08:30 daily.
  (async () => {
    let settings;
    try {
      settings = await getGovernanceSettings();
    } catch (e) {
      console.error("Governance digest: failed to read settings, using defaults.", e);
      settings = { DigestEnabled: false, DigestCron: "30 8 * * *", Timezone: "America/New_York" };
    }

    const cronExpr = settings?.DigestCron || "30 8 * * *";
    const tz = settings?.Timezone || process.env.APP_TIMEZONE || "America/New_York";

    cron.schedule(
      cronExpr,
      async () => {
        try {
          const latestSettings = await getGovernanceSettings();
          if (!latestSettings?.DigestEnabled) return;

          const webhookUrl = latestSettings?.TeamsWebhookUrl || process.env.TEAMS_WEBHOOK_URL;
          if (!webhookUrl) return;

          const now = dayjs().tz(tz);
          const today = now.startOf("day");
          const horizonDays = 60;
          const horizonEnd = today.add(horizonDays, "day");

          const pool = await poolPromise;

          // Pull open events within a generous window; filter with per-event LeadTimeDays in JS.
          const eventsRes = await pool.request()
            .input("StartDate", dayjs(today).toDate())
            .input("EndDate", dayjs(horizonEnd).toDate())
            .query(`
              SELECT e.EventID, e.ClientID, e.EventType, e.Title, e.Category, e.JurisdictionLevel, e.JurisdictionDetail,
                     e.VendorOrPolicyName, e.DueDate, e.LeadTimeDays, e.Status,
                     c.ClientName
              FROM dbo.GovernanceCalendarEvent e
              LEFT JOIN dbo.Client c ON e.ClientID = c.ClientID
              WHERE e.Status = 'Open'
                AND e.DueDate <= @EndDate
            `);

          const events = eventsRes.recordset || [];
          const dueSoon = [];
          const overdue = [];

          for (const ev of events) {
            const due = dayjs(ev.DueDate).tz(tz).startOf("day");
            if (due.isBefore(today)) {
              overdue.push(ev);
              continue;
            }
            const lead = Number(ev.LeadTimeDays ?? 14);
            const limitDate = today.add(lead, "day");
            if (due.isBefore(limitDate) || due.isSame(limitDate)) {
              dueSoon.push(ev);
            }
          }

          // Covenant alerts
          const alertsRes = await pool.request().query(`
            SELECT TOP 50 a.AlertID, a.AlertLevel, a.Message, a.CreatedAt,
                   cov.ClientID, c.ClientName, cov.CovenantName, cov.MetricKey
            FROM dbo.ClientCovenantAlert a
            INNER JOIN dbo.ClientCovenant cov ON a.CovenantID = cov.CovenantID
            INNER JOIN dbo.Client c ON cov.ClientID = c.ClientID
            WHERE a.IsAcknowledged = 0 AND (a.SnoozeUntil IS NULL OR a.SnoozeUntil <= CAST(GETUTCDATE() AS DATE))
            ORDER BY a.CreatedAt DESC
          `);

          const alerts = alertsRes.recordset || [];

          if (dueSoon.length === 0 && overdue.length === 0 && alerts.length === 0) {
            // Keep quiet if nothing actionable
            return;
          }

          const portalBase = process.env.PORTAL_BASE_URL || "";
          const govLink = portalBase ? `${portalBase}/dashboard/admin/governance` : "";

          const facts = [
            { name: "Overdue calendar items", value: String(overdue.length) },
            { name: "Due soon calendar items", value: String(dueSoon.length) },
            { name: "Open covenant alerts", value: String(alerts.length) },
            { name: "Date", value: now.format("YYYY-MM-DD") },
          ];

          const topEvents = [...overdue.slice(0, 5).map((e) => ({ ...e, __tag: "Overdue" })), ...dueSoon.slice(0, 5).map((e) => ({ ...e, __tag: "Due Soon" }))];

          const lines = [];
          if (govLink) lines.push(`[Open Governance Module](${govLink})`);
          if (topEvents.length) {
            lines.push("");
            lines.push("**Calendar highlights**");
            for (const e of topEvents) {
              const client = e.ClientName || "CFO Worx (Internal)";
              lines.push(`- **${e.__tag}** • ${formatDate(e.DueDate)} • ${client} • ${e.EventType} • ${e.Title}`);
            }
          }
          if (alerts.length) {
            lines.push("");
            lines.push("**Covenant alerts**");
            for (const a of alerts.slice(0, 5)) {
              lines.push(`- **${a.AlertLevel}** • ${a.ClientName} • ${a.CovenantName} (${a.MetricKey})`);
            }
          }

          await sendTeamsWebhookMessage({
            webhookUrl,
            title: "CFO Worx — Governance Digest (Calendar + Covenants)",
            text: lines.join("\n"),
            facts,
          });
        } catch (err) {
          console.error("Governance digest job error:", err);
        }
      },
      { timezone: tz }
    );

    console.log(`✅ Governance digest scheduled: '${cronExpr}' (${tz})`);
  })();
}

