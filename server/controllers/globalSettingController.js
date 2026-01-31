import GlobalSetting from '../models/GlobalSetting.js';
import HolidayCalendar from '../models/HolidayCalendar.js';

/* GET  /api/globalSettings/calendarLocked */
export const getCalendarLocked = async (req, res) => {
  try {
    const locked = await GlobalSetting.getCalendarLocked();
    res.json({ calendarLocked: locked });
  } catch (err) {
    console.error('GlobalSetting fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/* PUT  /api/globalSettings/calendarLocked   body:{calendarLocked:true|false} */
export const updateCalendarLocked = async (req, res) => {
  try {
    const { calendarLocked } = req.body;
    if (typeof calendarLocked !== 'boolean') {
      return res.status(400).json({ error: 'calendarLocked must be boolean' });
    }
    const locked = await GlobalSetting.setCalendarLocked(calendarLocked);
    res.json({ calendarLocked: locked });
  } catch (err) {
    console.error('GlobalSetting update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/* GET  /api/globalSettings/performanceReporting */
export const getPerformanceReportingSettings = async (req, res) => {
  try {
    const settings = await GlobalSetting.getPerformanceReportingSettings();
    res.json(settings);
  } catch (err) {
    console.error('Performance reporting settings fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/* PUT  /api/globalSettings/performanceReporting */
export const updatePerformanceReportingSettings = async (req, res) => {
  try {
    const {
      HoursVarianceWarnPct,
      HoursVarianceCriticalPct,
      BusinessDaysOnlyDefault,
      IncludeSubmittedDefault,
      WorkdayHoursDefault,
      AttentionRiskDays,
      DefaultDistributionType,
    } = req.body ?? {};

    const warn = Number(HoursVarianceWarnPct);
    const crit = Number(HoursVarianceCriticalPct);
    const workday = Number(WorkdayHoursDefault);
    const attn = Number(AttentionRiskDays);
    const dist = (DefaultDistributionType ?? '').toString().trim().toLowerCase();

    if (!Number.isFinite(warn) || warn <= 0 || warn >= 1) {
      return res.status(400).json({ error: 'HoursVarianceWarnPct must be a number between 0 and 1' });
    }
    if (!Number.isFinite(crit) || crit <= 0 || crit >= 1) {
      return res.status(400).json({ error: 'HoursVarianceCriticalPct must be a number between 0 and 1' });
    }
    if (crit <= warn) {
      return res.status(400).json({ error: 'HoursVarianceCriticalPct must be greater than HoursVarianceWarnPct' });
    }
    if (typeof BusinessDaysOnlyDefault !== 'boolean') {
      return res.status(400).json({ error: 'BusinessDaysOnlyDefault must be boolean' });
    }
    if (typeof IncludeSubmittedDefault !== 'boolean') {
      return res.status(400).json({ error: 'IncludeSubmittedDefault must be boolean' });
    }
    if (!Number.isFinite(workday) || workday <= 0 || workday > 24) {
      return res.status(400).json({ error: 'WorkdayHoursDefault must be a positive number (<=24)' });
    }
    if (!Number.isFinite(attn) || attn < 0 || attn > 365) {
      return res.status(400).json({ error: 'AttentionRiskDays must be a number between 0 and 365' });
    }

    const allowed = new Set(['linear', 'front_loaded', 'back_loaded', 'u_shaped', 'custom']);
    if (!allowed.has(dist)) {
      return res.status(400).json({ error: `DefaultDistributionType must be one of: ${[...allowed].join(', ')}` });
    }

    const settings = await GlobalSetting.setPerformanceReportingSettings({
      HoursVarianceWarnPct: warn,
      HoursVarianceCriticalPct: crit,
      BusinessDaysOnlyDefault,
      IncludeSubmittedDefault,
      WorkdayHoursDefault: workday,
      AttentionRiskDays: attn,
      DefaultDistributionType: dist,
    });

    res.json(settings);
  } catch (err) {
    console.error('Performance reporting settings update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/* Holiday calendar endpoints (Admin-managed) */

/* GET /api/globalSettings/holidayCalendar */
export const getHolidayCalendar = async (req, res) => {
  try {
    const holidays = await HolidayCalendar.getAll();
    res.json(holidays);
  } catch (err) {
    console.error('HolidayCalendar fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/* POST /api/globalSettings/holidayCalendar  body:{holidayDate:'YYYY-MM-DD', holidayName?:string} */
export const addHoliday = async (req, res) => {
  try {
    const { holidayDate, holidayName } = req.body ?? {};
    if (!holidayDate || typeof holidayDate !== 'string') {
      return res.status(400).json({ error: 'holidayDate is required (YYYY-MM-DD)' });
    }
    const created = await HolidayCalendar.add({ holidayDate, holidayName: holidayName ?? null });
    res.status(201).json(created);
  } catch (err) {
    console.error('HolidayCalendar add error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/* DELETE /api/globalSettings/holidayCalendar/:holidayDate */
export const deleteHoliday = async (req, res) => {
  try {
    const { holidayDate } = req.params;
    if (!holidayDate) return res.status(400).json({ error: 'holidayDate param required' });
    await HolidayCalendar.remove(holidayDate);
    res.status(204).send();
  } catch (err) {
    console.error('HolidayCalendar delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
