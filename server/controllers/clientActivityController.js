import ClientActivityReport from '../models/ClientActivityReport.js';

export const getClientActivityReport = async (req, res) => {
  try {
    const { clientId, startDate, endDate, includeWeekends = 'true', includeNotes = 'false' } = req.query;
    if (!clientId || !startDate || !endDate) {
      return res.status(400).json({ message: 'clientId, startDate, endDate are required' });
    }

    const includeWeekendsBool = includeWeekends === true || includeWeekends === 'true';
    const includeNotesBool = includeNotes === true || includeNotes === 'true';

    const data = await ClientActivityReport.build({
      clientID: clientId,
      startDate,
      endDate,
      includeWeekends: includeWeekendsBool,
      includeNotes: includeNotesBool,
    });

    res.json(data);
  } catch (e) {
    res.status(500).json({ message: 'Failed to build client activity report', error: e.message });
  }
};

export const exportClientActivityCsv = async (req, res) => {
  try {
    const { clientId, startDate, endDate, includeWeekends = 'true', includeNotes = 'false' } = req.query;
    if (!clientId || !startDate || !endDate) {
      return res.status(400).json({ message: 'clientId, startDate, endDate are required' });
    }
    const includeWeekendsBool = includeWeekends === true || includeWeekends === 'true';
    const includeNotesBool = includeNotes === true || includeNotes === 'true';

    const csv = await ClientActivityReport.exportCsv({
      clientId,
      startDate,
      endDate,
      includeWeekends: includeWeekendsBool,
      includeNotes: includeNotesBool,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="client_activity_${clientId}_${startDate}_${endDate}.csv"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ message: 'Failed to export client activity CSV', error: e.message });
  }
};
