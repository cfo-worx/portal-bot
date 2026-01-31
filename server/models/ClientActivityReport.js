import sql from 'mssql';
import { poolPromise } from '../db.js';

/**
 * Client Activity Reporting
 *
 * - Summary report: by ISO week and month, broken down by role/person/category
 * - Detailed report: daily log with deliverable category + optional notes
 *
 * For client exports:
 * - Summary: no notes
 * - Detailed: includes notes
 */

function isoWeek(datestr) {
  const date = new Date(datestr);
  // ISO week date weeks start on Monday
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function toISODateOnly(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export class ClientActivityReport {
  static async build({
    clientID,
    startDate,
    endDate,
    includeWeekends = true,
    approvedOnly = true,
    includeNotes = false,
  }) {
    const pool = await poolPromise;
    const statusFilter = approvedOnly ? "AND tcl.Status = 'Approved'" : "AND tcl.Status IN ('Approved','Submitted')";
    const weekendFilter = includeWeekends
      ? ''
      : "AND DATENAME(WEEKDAY, tcl.TimesheetDate) NOT IN ('Saturday','Sunday')";

    const result = await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, clientID)
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate)
      .query(`
        SELECT
          tcl.TimecardLineID,
          tcl.TimesheetDate,
          tcl.ConsultantID,
          c.FirstName,
          c.LastName,
          c.JobTitle AS RoleTitle,
          tcl.ProjectID,
          p.ProjectName,
          tcl.ProjectTask,
          tcl.ClientFacingHours,
          tcl.NonClientFacingHours,
          tcl.OtherTaskHours,
          (COALESCE(tcl.ClientFacingHours,0)+COALESCE(tcl.NonClientFacingHours,0)+COALESCE(tcl.OtherTaskHours,0)) AS TotalHours,
          tcl.Notes
        FROM TimecardLines tcl
        INNER JOIN Consultant c ON c.ConsultantID = tcl.ConsultantID
        LEFT JOIN Projects p ON p.ProjectID = tcl.ProjectID
        WHERE tcl.ClientID = @ClientID
          AND tcl.TimesheetDate >= @StartDate AND tcl.TimesheetDate <= @EndDate
          ${statusFilter}
          ${weekendFilter}
        ORDER BY tcl.TimesheetDate ASC;
      `);

    const rows = result.recordset || [];
    const summaryByWeek = new Map();
    const summaryByMonth = new Map();
    const summaryByPerson = new Map();
    const summaryByCategory = new Map();

    for (const r of rows) {
      const dateISO = toISODateOnly(r.TimesheetDate) || String(r.TimesheetDate).slice(0, 10);
      const week = isoWeek(dateISO);
      const month = String(dateISO).slice(0, 7);
      const person = `${r.FirstName} ${r.LastName}`;
      const role = r.RoleTitle || '—';
      const category = 'Uncategorized';

      const add = (map, key, inc) => map.set(key, (map.get(key) || 0) + inc);
      add(summaryByWeek, `${week}||${role}||${person}||${category}`, r.TotalHours);
      add(summaryByMonth, `${month}||${role}||${person}||${category}`, r.TotalHours);
      add(summaryByPerson, `${role}||${person}`, r.TotalHours);
      add(summaryByCategory, category, r.TotalHours);
    }

    const toArr = (map, shapeFn) => Array.from(map.entries()).map(([k, v]) => shapeFn(k, v));
    const summary = {
      byWeek: toArr(summaryByWeek, (k, hours) => {
        const [isoWeekKey, role, person, category] = k.split('||');
        return { isoWeek: isoWeekKey, role, person, category, hours: Number(hours.toFixed(2)) };
      }),
      byMonth: toArr(summaryByMonth, (k, hours) => {
        const [month, role, person, category] = k.split('||');
        return { month, role, person, category, hours: Number(hours.toFixed(2)) };
      }),
      byPerson: toArr(summaryByPerson, (k, hours) => {
        const [role, person] = k.split('||');
        return { role, person, hours: Number(hours.toFixed(2)) };
      }),
      byCategory: toArr(summaryByCategory, (category, hours) => ({ category, hours: Number(hours.toFixed(2)) })),
    };

    const detail = rows.map((r) => ({
      date: toISODateOnly(r.TimesheetDate) || r.TimesheetDate,
      consultantID: r.ConsultantID,
      person: `${r.FirstName} ${r.LastName}`,
      role: r.RoleTitle,
      project: r.ProjectName,
      task: r.ProjectTask,
      category: 'Uncategorized',
      hours: Number((r.TotalHours || 0).toFixed(2)),
      ...(includeNotes ? { notes: r.Notes } : {}),
    }));

    return { clientID, startDate, endDate, includeWeekends, approvedOnly, includeNotes, summary, detail };
  }

  static async exportCsv({
    clientId,
    startDate,
    endDate,
    includeWeekends = true,
    includeNotes = false,
  }) {
    const data = await this.build({
      clientID: clientId,
      startDate,
      endDate,
      includeWeekends,
      approvedOnly: true,
      includeNotes,
    });

    // Build CSV from detail rows
    const headers = ['Date', 'Person', 'Role', 'Project', 'Task', 'Category', 'Hours'];
    if (includeNotes) headers.push('Notes');

    const rows = [headers.join(',')];

    for (const d of data.detail) {
      const row = [
        d.date,
        `"${(d.person || '').replace(/"/g, '""')}"`,
        `"${(d.role || '').replace(/"/g, '""')}"`,
        `"${(d.project || '').replace(/"/g, '""')}"`,
        `"${(d.task || '').replace(/"/g, '""')}"`,
        `"${(d.category || '').replace(/"/g, '""')}"`,
        d.hours,
      ];
      if (includeNotes) {
        row.push(`"${(d.notes || '').replace(/"/g, '""')}"`);
      }
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}

export default ClientActivityReport;
