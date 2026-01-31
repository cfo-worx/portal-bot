import ExternalTime from '../models/ExternalTime.js';

export const listIntegrationLinks = async (req, res) => {
  try {
    const rows = await ExternalTime.listIntegrationLinks();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list integration links', error: e.message });
  }
};

export const upsertIntegrationLink = async (req, res) => {
  try {
    const result = await ExternalTime.upsertIntegrationLink(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: 'Failed to upsert integration link', error: e.message });
  }
};

/**
 * Import external time entries (generic).
 *
 * Payload:
 * {
 *   source: "UPWORK" | "HUBSTAFF",
 *   entries: [{ externalWorkerId, externalContractId?, workDate, hours, activityPercent?, rawPayload? }]
 * }
 */
export const importExternalTime = async (req, res) => {
  try {
    const { source, entries } = req.body;
    const importedBy = req.user?.email || req.user?.name || 'system';
    const result = await ExternalTime.importTimeEntries({ source, entries, importedBy });
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: 'Failed to import external time', error: e.message });
  }
};

export const importExternalTimeEntries = importExternalTime; // Alias for route compatibility

export const listExternalTime = async (req, res) => {
  try {
    const { source, startDate, endDate, consultantID } = req.query;
    const rows = await ExternalTime.listTimeEntries({ source, startDate, endDate, consultantID });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list external time', error: e.message });
  }
};

export const listExternalTimeEntries = listExternalTime; // Alias for route compatibility

export const getExternalTotals = async (req, res) => {
  try {
    const { source, startDate, endDate } = req.query;
    const rows = await ExternalTime.getTotalsByConsultant({ source, startDate, endDate });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to load external totals', error: e.message });
  }
};
