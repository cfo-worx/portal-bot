import api from './index';

export const listQboMappings = async () => {
  const res = await api.get('/commissions/qbo/mappings');
  return res.data;
};

export const upsertQboMapping = async (payload) => {
  const res = await api.post('/commissions/qbo/mappings', payload);
  return res.data;
};

export const importQboPayments = async (payments) => {
  const res = await api.post('/commissions/qbo/payments/import', { payments });
  return res.data;
};

export const listCommissionAgreements = async () => {
  const res = await api.get('/commissions/agreements');
  return res.data;
};

export const upsertCommissionAgreement = async (payload) => {
  const res = await api.post('/commissions/agreements', payload);
  return res.data;
};

// Aliases for compatibility
export const listAgreements = listCommissionAgreements;
export const upsertAgreement = upsertCommissionAgreement;

export const calculateCommissionAccruals = async ({ asOfDate }) => {
  const res = await api.post('/commissions/accruals/calculate', { asOfDate });
  return res.data;
};

// Alias for compatibility
export const calculateAccruals = calculateCommissionAccruals;

export const listCommissionAccruals = async ({ status, fromDate, toDate, userId } = {}) => {
  const res = await api.get('/commissions/accruals', { params: { status, fromDate, toDate, userId } });
  return res.data;
};

// Alias for compatibility
export const listAccruals = listCommissionAccruals;

export const markAccrualPaid = async ({ commissionAccrualId, payrollRunId }) => {
  const res = await api.post('/commissions/accruals/mark-paid', { commissionAccrualId, payrollRunId });
  return res.data;
};
