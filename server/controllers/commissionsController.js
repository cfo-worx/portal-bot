import Commission from '../models/Commission.js';
import { poolPromise } from '../db.js';
import sql from 'mssql';

export const listQboCustomerMappings = async (req, res) => {
  try {
    const rows = await Commission.listCustomerMappings();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list QBO mappings', error: e.message });
  }
};

export const upsertQboCustomerMapping = async (req, res) => {
  try {
    const { clientId, qboCustomerId, qboCustomerDisplayName } = req.body || {};
    if (!clientId || !qboCustomerId) return res.status(400).json({ message: 'clientId and qboCustomerId are required' });
    const row = await Commission.upsertCustomerMapping({
      clientId,
      qboCustomerId,
      qboCustomerDisplayName: qboCustomerDisplayName || null,
      approvedBy: req.user?.email || 'system',
    });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: 'Failed to upsert QBO mapping', error: e.message });
  }
};

export const importQboPayments = async (req, res) => {
  try {
    const { payments } = req.body || {};
    if (!Array.isArray(payments)) return res.status(400).json({ message: 'payments[] is required' });
    const summary = await Commission.importPayments({ payments, importedBy: req.user?.email || 'system' });
    res.json(summary);
  } catch (e) {
    res.status(500).json({ message: 'Failed to import QBO payments', error: e.message });
  }
};

export const listAgreements = async (req, res) => {
  try {
    const rows = await Commission.listAgreements();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list commission agreements', error: e.message });
  }
};

export const upsertAgreement = async (req, res) => {
  try {
    const { contractId, clientId, isEligible = true, ineligibleReason = null, leadSource = null, quotedAmount = null } = req.body || {};
    if (!contractId || !clientId) return res.status(400).json({ message: 'contractId and clientId are required' });
    const row = await Commission.upsertAgreement({
      contractId,
      clientId,
      isEligible,
      ineligibleReason,
      leadSource,
      quotedAmount,
      createdBy: req.user?.email || 'system',
    });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: 'Failed to upsert commission agreement', error: e.message });
  }
};

export const upsertSplits = async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { splits } = req.body || {};
    if (!agreementId) return res.status(400).json({ message: 'agreementId is required' });
    if (!Array.isArray(splits)) return res.status(400).json({ message: 'splits[] is required' });
    const rows = await Commission.replaceSplits({ agreementId, splits, updatedBy: req.user?.email || 'system' });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to update splits', error: e.message });
  }
};

export const calculateAccruals = async (req, res) => {
  try {
    const { asOfDate } = req.body || {};
    const result = await Commission.calculateAccruals({ asOfDate: asOfDate || null });
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: 'Failed to calculate commissions', error: e.message });
  }
};

export const listAccruals = async (req, res) => {
  try {
    const { status = null } = req.query;
    const rows = await Commission.listAccruals({ status });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list commissions', error: e.message });
  }
};

// Aliases for route compatibility
export const listCommissionAgreements = listAgreements;
export const upsertCommissionAgreement = upsertAgreement;
export const calculateCommissionAccruals = calculateAccruals;
export const listCommissionAccruals = listAccruals;

export const markCommissionAccrualPaid = async (req, res) => {
  try {
    const { accrualId } = req.params;
    const { paidOn } = req.body || {};
    if (!accrualId) return res.status(400).json({ message: 'accrualId is required' });
    
    const pool = await poolPromise;
    
    await pool
      .request()
      .input('AccrualID', sql.UniqueIdentifier, accrualId)
      .input('PaidOn', sql.Date, paidOn ? new Date(paidOn) : new Date())
      .query(`
        UPDATE CommissionAccrual
        SET Status = 'PAID', PaidOn = @PaidOn
        WHERE CommissionAccrualID = @AccrualID
      `);
    
    res.json({ ok: true, accrualId, paidOn: paidOn || new Date().toISOString().slice(0, 10) });
  } catch (e) {
    res.status(500).json({ message: 'Failed to mark commission accrual as paid', error: e.message });
  }
};
