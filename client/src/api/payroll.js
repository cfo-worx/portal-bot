import api from './index';

export const listPayrollRuns = async () => {
  const res = await api.get('/payroll/runs');
  return res.data;
};

export const createPayrollRun = async (payload) => {
  const res = await api.post('/payroll/runs', payload);
  return res.data;
};

export const getPayrollRun = async (payrollRunId) => {
  const res = await api.get(`/payroll/runs/${payrollRunId}`);
  return res.data;
};

export const calculatePayrollRun = async (payrollRunId) => {
  const res = await api.post(`/payroll/runs/${payrollRunId}/calculate`);
  return res.data;
};

export const finalizePayrollRun = async (payrollRunId) => {
  const res = await api.post(`/payroll/runs/${payrollRunId}/finalize`);
  return res.data;
};

export const listPayrollExceptions = async (payrollRunId) => {
  const res = await api.get(`/payroll/runs/${payrollRunId}/exceptions`);
  return res.data;
};

export const listPayrollRunExceptions = listPayrollExceptions; // Alias for compatibility

export const upsertPayrollAdjustment = async (payload) => {
  const res = await api.post('/payroll/adjustments', payload);
  return res.data;
};
