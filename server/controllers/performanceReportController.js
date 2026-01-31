import PerformanceReport from '../models/PerformanceReport.js';
import ReportIssueNote from '../models/ReportIssueNote.js';
import WeeklyReviewSession from '../models/WeeklyReviewSession.js';

/* GET /api/performance-reports/capacity-planning */
export const getCapacityPlanning = async (req, res) => {
  try {
    const { asOfDate } = req.query;

    if (!asOfDate) {
      return res.status(400).json({ error: 'asOfDate is required (YYYY-MM-DD)' });
    }

    // Set a longer timeout for this endpoint (10 seconds)
    req.setTimeout(10000);

    const planning = await PerformanceReport.getCapacityPlanning({
      asOfDate,
    });

    res.json(planning);
  } catch (err) {
    console.error('Capacity planning error:', err);
    if (err.message && err.message.includes('timeout')) {
      return res.status(504).json({ error: 'Request timeout. Please try again or contact support.' });
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* GET /api/performance-reports */
export const getPerformanceReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      asOfDate,
      clientIds,
      consultantIds,
      role,
      includeSubmitted,
      businessDaysOnly,
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
    }


    const normalizeIdList = (value) => {
      if (Array.isArray(value)) {
        return value.map(s => String(s).trim()).filter(Boolean);
      }
      if (typeof value === 'string' && value.length) {
        return value.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };
    const clientIdList = normalizeIdList(clientIds);
    const consultantIdList = normalizeIdList(consultantIds);

    const report = await PerformanceReport.getPerformanceReport({
      startDate,
      endDate,
      asOfDate: asOfDate || null,
      clientIds: clientIdList,
      consultantIds: consultantIdList,
      role: (role != null && String(role).trim() !== '') ? String(role) : null,
      includeSubmitted: includeSubmitted === 'true' || includeSubmitted === true,
      businessDaysOnly: businessDaysOnly === 'false' ? false : true,
    });

    res.json(report);
  } catch (err) {
    console.error('Performance report error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* GET /api/performance-reports/issues */
export const getWeeklyIssues = async (req, res) => {
  try {
    const {
      weekStart,
      weekEnd,
      clientIds,
      consultantIds,
      role,
      includeSubmitted,
      businessDaysOnly,
      lookbackWeeks,
    } = req.query;

    if (!weekStart || !weekEnd) {
      return res.status(400).json({ error: 'weekStart and weekEnd are required (YYYY-MM-DD)' });
    }


    const normalizeIdList = (value) => {
      if (Array.isArray(value)) {
        return value.map(s => String(s).trim()).filter(Boolean);
      }
      if (typeof value === 'string' && value.length) {
        return value.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };
    const clientIdList = normalizeIdList(clientIds);
    const consultantIdList = normalizeIdList(consultantIds);

    const data = await PerformanceReport.getWeeklyIssues({
      weekStart,
      weekEnd,
      clientIds: clientIdList,
      consultantIds: consultantIdList,
      role: (role != null && String(role).trim() !== '') ? String(role) : null,
      includeSubmitted: includeSubmitted === 'true' || includeSubmitted === true,
      businessDaysOnly: businessDaysOnly === 'false' ? false : true,
      lookbackWeeks: lookbackWeeks != null ? Number(lookbackWeeks) : 8,
    });

    res.json(data);
  } catch (err) {
    console.error('Weekly issues error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* PUT /api/performance-reports/issue-note */
export const upsertIssueNote = async (req, res) => {
  try {
    const {
      issueKey,
      issueType,
      severity,
      periodStart,
      periodEnd,
      clientId,
      consultantId,
      role,
      status,
      decision,
      snoozedUntil,
      notes,
    } = req.body ?? {};

    if (!issueKey || !issueType || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'issueKey, issueType, periodStart, and periodEnd are required' });
    }

    const acknowledgedBy = req.user?.email ?? null;
    const acknowledgedAt = (status === 'acknowledged' || status === 'closed') ? new Date() : null;

    const saved = await ReportIssueNote.upsert({
      IssueKey: issueKey,
      IssueType: issueType,
      Severity: severity ?? null,
      PeriodStart: periodStart,
      PeriodEnd: periodEnd,
      ClientID: (clientId != null && clientId !== '') ? clientId : null,
      ConsultantID: (consultantId != null && consultantId !== '') ? consultantId : null,
      Role: role ?? null,
      Status: status ?? 'open',
      Decision: decision ?? null,
      SnoozedUntil: snoozedUntil ?? null,
      Notes: notes ?? null,
      AcknowledgedBy: acknowledgedBy,
      AcknowledgedAt: acknowledgedAt,
    });

    res.json(saved);
  } catch (err) {
    console.error('Issue note upsert error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* GET /api/performance-reports/contracts-ending */
export const getContractsEnding = async (req, res) => {
  try {
    const { asOfDate, daysAhead, clientIds } = req.query;

    const normalizeIdList = (value) => {
      if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [];
    };

    const list = normalizeIdList(clientIds);

    const contracts = await PerformanceReport.getContractsEnding({
      asOfDate,
      daysAhead: daysAhead ? parseInt(daysAhead, 10) : 30,
      clientIds: list,
    });

    res.json({ contracts });
  } catch (error) {
    console.error('Error generating contracts ending report:', error);
    res.status(500).json({ message: error.message });
  }
};


/* GET /api/performance-reports/roles */
export const getReportRoles = async (req, res) => {
  try {
    const roles = await PerformanceReport.getDistinctRoles();
    res.json({ roles });
  } catch (err) {
    console.error('Report roles error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* GET /api/performance-reports/weekly-review-sessions */
export const getWeeklyReviewSessions = async (req, res) => {
  try {
    const { weekStart, weekEnd, clientId, consultantId } = req.query;

    if (!weekStart || !weekEnd) {
      return res.status(400).json({ error: 'weekStart and weekEnd are required (YYYY-MM-DD)' });
    }

    const sessions = await WeeklyReviewSession.getAllByWeek(
      weekStart,
      weekEnd
    );

    res.json({ sessions });
  } catch (err) {
    console.error('Weekly review sessions error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* GET /api/performance-reports/weekly-review-sessions/prior-week */
export const getPriorWeekReviewSessions = async (req, res) => {
  try {
    const { weekStart, clientId, consultantId } = req.query;

    if (!weekStart) {
      return res.status(400).json({ error: 'weekStart is required (YYYY-MM-DD)' });
    }

    const sessions = await WeeklyReviewSession.getPriorWeekSessions(
      weekStart,
      clientId || null,
      consultantId || null
    );

    res.json({ sessions });
  } catch (err) {
    console.error('Prior week review sessions error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* POST /api/performance-reports/weekly-review-sessions */
/* PUT /api/performance-reports/weekly-review-sessions/:sessionId */
export const upsertWeeklyReviewSession = async (req, res) => {
  try {
    const {
      ReviewSessionID,
      WeekStartDate,
      WeekEndDate,
      ClientID,
      ConsultantID,
      Notes,
      ActionItems,
      Status,
      CarriedForwardFromSessionID,
    } = req.body;

    if (!WeekStartDate || !WeekEndDate) {
      return res.status(400).json({ error: 'WeekStartDate and WeekEndDate are required' });
    }

    const userId = req.user?.UserID || req.user?.userID || null;

    const session = await WeeklyReviewSession.upsert({
      ReviewSessionID: req.params.sessionId || ReviewSessionID || null,
      WeekStartDate,
      WeekEndDate,
      ClientID: ClientID || null,
      ConsultantID: ConsultantID || null,
      Notes: Notes || null,
      ActionItems: ActionItems || null,
      Status: Status || 'draft',
      CreatedByUserID: userId,
      UpdatedByUserID: userId,
      CarriedForwardFromSessionID: CarriedForwardFromSessionID || null,
    });

    res.json(session);
  } catch (err) {
    console.error('Weekly review session upsert error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* DELETE /api/performance-reports/weekly-review-sessions/:sessionId */
export const deleteWeeklyReviewSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const deleted = await WeeklyReviewSession.delete(sessionId);

    if (deleted) {
      res.json({ message: 'Review session deleted successfully' });
    } else {
      res.status(404).json({ error: 'Review session not found' });
    }
  } catch (err) {
    console.error('Weekly review session delete error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
