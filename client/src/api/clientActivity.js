import api from './index';

export const getClientActivityReport = async ({ clientId, startDate, endDate, includeWeekends = true, includeNotes = false }) => {
  const params = new URLSearchParams();
  params.append('clientId', clientId);
  params.append('startDate', startDate);
  params.append('endDate', endDate);
  params.append('includeWeekends', includeWeekends.toString());
  params.append('includeNotes', includeNotes.toString());
  
  const res = await api.get(`/client-activity/report?${params.toString()}`);
  return res.data;
};

export const getClientActivityCsv = async ({ clientId, startDate, endDate, includeWeekends = true, includeNotes = false }) => {
  const params = new URLSearchParams();
  params.append('clientId', clientId);
  params.append('startDate', startDate);
  params.append('endDate', endDate);
  params.append('includeWeekends', includeWeekends.toString());
  params.append('includeNotes', includeNotes.toString());
  
  const res = await api.get(`/client-activity/report.csv?${params.toString()}`, {
    responseType: 'text',
  });
  return res.data;
};

