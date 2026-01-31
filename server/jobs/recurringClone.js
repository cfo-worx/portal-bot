// server/jobs/recurringClone.js

import cron from 'node-cron';
import { poolPromise, sql } from '../db.js';
import ProjectModel from '../models/Project.js'; // cloneRecurringProject(...)
import dayjs from 'dayjs';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------
// 1) Determine where our log file lives on disk:
const LOG_DIR  = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../logs');
const LOG_PATH = path.join(LOG_DIR, 'recurringClone.log');

// Ensure the logs directory exists:
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ---------------------------------------------------------
// 2) Helper: append one line to the log file, then purge if >300 lines
async function appendAndPurgeLogLine(line) {
  // Append the new line (with newline at end)
  fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');

  // Now read entire file, split into lines, purge older if necessary:
  const allContents = fs.readFileSync(LOG_PATH, 'utf8');
  const lines = allContents.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length > 300) {
    // Keep only the last 300 lines
    const last300 = lines.slice(-300);
    fs.writeFileSync(LOG_PATH, last300.join('\n') + '\n', 'utf8');
  }
}

// ---------------------------------------------------------
// 3) Find all “due” recurring projects (only originals: ParentProjectID IS NULL)
async function fetchDueRecurringProjects() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT
      p.ProjectID,
      p.RecurrenceType,
      p.IntervalValue,
      p.RecurrenceIndex,
      p.PeriodCount,
      p.StartDate
    FROM Projects AS p
    WHERE 
      p.Recurring = 1
      AND p.ParentProjectID IS NULL
      AND (
        p.PeriodCount IS NULL
        OR p.RecurrenceIndex < p.PeriodCount
      )
      AND (
        CASE
          WHEN p.RecurrenceType IN ('weekly', 'biweekly') THEN
            DATEADD(WEEK, p.IntervalValue * (p.RecurrenceIndex + 1), p.StartDate)
          WHEN p.RecurrenceType = 'monthly' THEN
            DATEADD(MONTH, p.IntervalValue * (p.RecurrenceIndex + 1), p.StartDate)
          WHEN p.RecurrenceType = 'quarterly' THEN
            DATEADD(MONTH, p.IntervalValue * (p.RecurrenceIndex + 1) * 3, p.StartDate)
          WHEN p.RecurrenceType IN ('yearly', 'annually') THEN
            DATEADD(YEAR, p.IntervalValue * (p.RecurrenceIndex + 1), p.StartDate)
          ELSE
            NULL
        END
      ) <= CAST(GETDATE() AS DATE)
  `);
  return result.recordset; // array of originals that are due
}

// ---------------------------------------------------------
// 4) For a single “original” project ID, clone it and bump its RecurrenceIndex.
//    Then log to our file.
async function performCloneForProject(oldProjectID) {
  // a) Clone the project (this returns a new GUID)
  const newId = await ProjectModel.cloneRecurringProject(oldProjectID);

  // b) Update RecurrenceIndex on the original project
  {
    const pool = await poolPromise;
    await pool.request()
      .input('ProjectID', sql.UniqueIdentifier, oldProjectID)
      .query(`
        UPDATE Projects
        SET RecurrenceIndex = RecurrenceIndex + 1,
            UpdatedDate    = GETDATE()
        WHERE ProjectID = @ProjectID;
      `);
  }

  // c) Write one line to our flat-file log
  const timestamp = dayjs().toISOString();
  const logLine = `${timestamp} | OldProjectID: ${oldProjectID} | NewProjectID: ${newId}`;
  await appendAndPurgeLogLine(logLine);

  console.log(`[recurringClone] ${timestamp} → cloned ${oldProjectID} → new ${newId}`);
}

// ---------------------------------------------------------
// 5) Schedule a daily cron job at 02:00 UTC:
export function scheduleRecurringCloneJob() {
  cron.schedule(
    '0 2 * * *',
    async () => {
      const now = dayjs().toISOString();
      console.log(`[recurringClone] ${now} → Checking for due recurring projects...`);
      try {
        const dueProjects = await fetchDueRecurringProjects();
        if (dueProjects.length === 0) {
          console.log('[recurringClone]   No projects due today.');
        } else {
          for (const row of dueProjects) {
            try {
              await performCloneForProject(row.ProjectID);
            } catch (innerErr) {
              console.error(`[recurringClone]   Failed to clone ${row.ProjectID}:`, innerErr);
            }
          }
        }
      } catch (err) {
        console.error('[recurringClone] Error during cron iteration:', err);
      }
    },
    {
      timezone: 'Etc/UTC' // run at 02:00 UTC daily
    }
  );

  console.log('[recurringClone] Scheduled daily 2:00 AM (UTC) job.');
}
