import PayrollRun from '../models/PayrollRun.js';
import { poolPromise } from '../db.js';
import sql from 'mssql';
import { v4 as uuidv4 } from 'uuid';

export const listPayrollRuns = async (req, res) => {
  try {
    const rows = await PayrollRun.list();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list payroll runs', error: e.message });
  }
};

export const createPayrollRun = async (req, res) => {
  try {
    const createdBy = req.user?.email || req.user?.name || 'system';
    const run = await PayrollRun.create({ ...req.body, createdBy });
    res.json(run);
  } catch (e) {
    res.status(500).json({ message: 'Failed to create payroll run', error: e.message });
  }
};

export const getPayrollRun = async (req, res) => {
  try {
    const payrollRunId = req.params.payrollRunId;
    const run = await PayrollRun.getById(payrollRunId);
    if (!run) return res.status(404).json({ message: 'Payroll run not found' });
    res.json(run);
  } catch (e) {
    res.status(500).json({ message: 'Failed to load payroll run', error: e.message });
  }
};

export const calculatePayrollRun = async (req, res) => {
  try {
    const payrollRunId = req.params.payrollRunId;
    const result = await PayrollRun.calculate(payrollRunId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: 'Failed to calculate payroll run', error: e.message });
  }
};

export const finalizePayrollRun = async (req, res) => {
  try {
    const payrollRunId = req.params.payrollRunId;
    const finalizedBy = req.user?.email || req.user?.name || 'system';
    const result = await PayrollRun.finalize(payrollRunId, finalizedBy);
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: 'Failed to finalize payroll run', error: e.message });
  }
};

export const listPayrollRunExceptions = async (req, res) => {
  try {
    const payrollRunId = req.params.payrollRunId;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunId)
      .query(`
        SELECT pre.*, c.FirstName, c.LastName
        FROM PayrollRunException pre
        LEFT JOIN Consultant c ON c.ConsultantID = pre.ConsultantID
        WHERE pre.PayrollRunID = @PayrollRunID
        ORDER BY pre.Severity DESC, pre.WorkDate DESC
      `);
    res.json(result.recordset);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list payroll run exceptions', error: e.message });
  }
};

export const upsertPayrollAdjustment = async (req, res) => {
  try {
    const { payrollAdjustmentID, consultantID, periodStart, periodEnd, adjustmentType, amount, hours, description } = req.body;
    const createdBy = req.user?.email || req.user?.name || 'system';
    const pool = await poolPromise;

    if (payrollAdjustmentID) {
      // Update existing adjustment
      await pool
        .request()
        .input('PayrollAdjustmentID', sql.UniqueIdentifier, payrollAdjustmentID)
        .input('ConsultantID', sql.UniqueIdentifier, consultantID)
        .input('PeriodStart', sql.Date, periodStart)
        .input('PeriodEnd', sql.Date, periodEnd)
        .input('AdjustmentType', sql.NVarChar(30), adjustmentType)
        .input('Amount', sql.Decimal(18, 2), amount)
        .input('Hours', sql.Decimal(10, 2), hours)
        .input('Description', sql.NVarChar(500), description)
        .query(`
          UPDATE PayrollAdjustment
          SET ConsultantID = @ConsultantID,
              PeriodStart = @PeriodStart,
              PeriodEnd = @PeriodEnd,
              AdjustmentType = @AdjustmentType,
              Amount = @Amount,
              Hours = @Hours,
              Description = @Description
          WHERE PayrollAdjustmentID = @PayrollAdjustmentID
        `);
      
      const result = await pool
        .request()
        .input('PayrollAdjustmentID', sql.UniqueIdentifier, payrollAdjustmentID)
        .query(`SELECT * FROM PayrollAdjustment WHERE PayrollAdjustmentID = @PayrollAdjustmentID`);
      
      res.json(result.recordset[0]);
    } else {
      // Create new adjustment
      const newID = uuidv4();
      await pool
        .request()
        .input('PayrollAdjustmentID', sql.UniqueIdentifier, newID)
        .input('ConsultantID', sql.UniqueIdentifier, consultantID)
        .input('PeriodStart', sql.Date, periodStart)
        .input('PeriodEnd', sql.Date, periodEnd)
        .input('AdjustmentType', sql.NVarChar(30), adjustmentType)
        .input('Amount', sql.Decimal(18, 2), amount)
        .input('Hours', sql.Decimal(10, 2), hours)
        .input('Description', sql.NVarChar(500), description)
        .input('CreatedBy', sql.NVarChar(255), createdBy)
        .query(`
          INSERT INTO PayrollAdjustment (
            PayrollAdjustmentID, ConsultantID, PeriodStart, PeriodEnd,
            AdjustmentType, Amount, Hours, Description, CreatedBy, CreatedOn
          ) VALUES (
            @PayrollAdjustmentID, @ConsultantID, @PeriodStart, @PeriodEnd,
            @AdjustmentType, @Amount, @Hours, @Description, @CreatedBy, GETUTCDATE()
          )
        `);
      
      const result = await pool
        .request()
        .input('PayrollAdjustmentID', sql.UniqueIdentifier, newID)
        .query(`SELECT * FROM PayrollAdjustment WHERE PayrollAdjustmentID = @PayrollAdjustmentID`);
      
      res.json(result.recordset[0]);
    }
  } catch (e) {
    res.status(500).json({ message: 'Failed to upsert payroll adjustment', error: e.message });
  }
};

export const exportPayrollRunCsv = async (req, res) => {
  try {
    const csv = await PayrollRun.exportCsv(req.params.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll_run_${req.params.id}.csv"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ message: 'Failed to export payroll CSV', error: e.message });
  }
};