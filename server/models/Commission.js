import { v4 as uuidv4 } from 'uuid';
import sql from 'mssql';
import { poolPromise } from '../db.js';

/**
 * Commission tracking (15/10/5, cash-based)
 *
 * IMPORTANT: This implementation is intentionally "integration-ready".
 * Brian's team uses QuickBooks Online as the source of truth for invoices and payments.
 * This code stores imported QBO payments into SQL and then computes accrual rows.
 *
 * The qbo ingestion can be wired later using OAuth tokens and the Intuit APIs.
 */

const COMMISSION_RATES = [0.15, 0.10, 0.05];

function endOfNextMonth(dateStr) {
  const d = new Date(dateStr);
  const next = new Date(d.getFullYear(), d.getMonth() + 2, 0); // last day of next month
  return next.toISOString().slice(0, 10);
}

export class Commission {
  static async upsertQboCustomerMapping({ clientID, qboCustomerId, qboDisplayName, confidence = 0.5, approvedBy = null }) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, clientID)
      .input('QboCustomerId', sql.NVarChar(100), qboCustomerId)
      .input('QboDisplayName', sql.NVarChar(255), qboDisplayName)
      .input('Confidence', sql.Decimal(5, 4), confidence)
      .input('ApprovedBy', sql.NVarChar(255), approvedBy)
      .query(`
        MERGE QboCustomerMapping AS tgt
        USING (SELECT @ClientID AS ClientID) AS src
          ON tgt.ClientID = src.ClientID
        WHEN MATCHED THEN
          UPDATE SET
            QboCustomerId = @QboCustomerId,
            QboDisplayName = @QboDisplayName,
            Confidence = @Confidence,
            ApprovedBy = COALESCE(@ApprovedBy, ApprovedBy),
            ApprovedOn = CASE WHEN @ApprovedBy IS NOT NULL THEN GETDATE() ELSE ApprovedOn END,
            UpdatedOn = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (QboCustomerMappingID, ClientID, QboCustomerId, QboDisplayName, Confidence, ApprovedBy, ApprovedOn, CreatedOn, UpdatedOn)
          VALUES (NEWID(), @ClientID, @QboCustomerId, @QboDisplayName, @Confidence, @ApprovedBy, CASE WHEN @ApprovedBy IS NOT NULL THEN GETDATE() ELSE NULL END, GETDATE(), GETDATE());
      `);
    return { ok: true };
  }

  static async importQboPayments({ payments = [], importedBy = 'system' }) {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const p of payments) {
        const req = new sql.Request(tx);
        req.input('QboPaymentId', sql.NVarChar(100), String(p.qboPaymentId || p.PaymentId || p.Id));
        req.input('QboInvoiceId', sql.NVarChar(100), p.qboInvoiceId ? String(p.qboInvoiceId) : null);
        req.input('QboCustomerId', sql.NVarChar(100), p.qboCustomerId ? String(p.qboCustomerId) : null);
        req.input('PaymentDate', sql.Date, p.paymentDate);
        req.input('Amount', sql.Decimal(18, 2), p.amount);
        req.input('ImportedBy', sql.NVarChar(255), importedBy);
        req.input('RawPayload', sql.NVarChar(sql.MAX), JSON.stringify(p.raw || p));

        await req.query(`
          IF NOT EXISTS (SELECT 1 FROM QboPayment WHERE QboPaymentId = @QboPaymentId)
          BEGIN
            INSERT INTO QboPayment (QboPaymentRowID, QboPaymentId, QboInvoiceId, QboCustomerId, PaymentDate, Amount, ImportedBy, RawPayload, ImportedOn)
            VALUES (NEWID(), @QboPaymentId, @QboInvoiceId, @QboCustomerId, @PaymentDate, @Amount, @ImportedBy, @RawPayload, GETDATE());
          END
        `);
      }
      await tx.commit();
      return { imported: payments.length };
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  static async createAgreement({ contractID, clientID, isEligible = true, ineligibleReason = null, createdBy = null, notes = null }) {
    const pool = await poolPromise;
    const agreementID = uuidv4();
    await pool
      .request()
      .input('AgreementID', sql.UniqueIdentifier, agreementID)
      .input('ContractID', sql.UniqueIdentifier, contractID)
      .input('ClientID', sql.UniqueIdentifier, clientID)
      .input('IsEligible', sql.Bit, isEligible)
      .input('IneligibleReason', sql.NVarChar(255), ineligibleReason)
      .input('CreatedBy', sql.NVarChar(255), createdBy)
      .query(`
        INSERT INTO CommissionAgreement (CommissionAgreementID, ContractID, ClientID, IsEligible, IneligibleReason, CreatedBy, CreatedOn, UpdatedOn)
        VALUES (@AgreementID, @ContractID, @ClientID, @IsEligible, @IneligibleReason, @CreatedBy, GETDATE(), GETDATE());
      `);
    return { commissionAgreementID: agreementID };
  }

  static async upsertSplits({ commissionAgreementID, splits = [] }) {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // Remove existing
      await new sql.Request(tx)
        .input('AgreementID', sql.UniqueIdentifier, commissionAgreementID)
        .query(`DELETE FROM CommissionSplit WHERE CommissionAgreementID = @AgreementID;`);

      // Insert new
      for (const s of splits) {
        await new sql.Request(tx)
          .input('SplitID', sql.UniqueIdentifier, uuidv4())
          .input('AgreementID', sql.UniqueIdentifier, commissionAgreementID)
          .input('UserID', sql.UniqueIdentifier, s.userID)
          .input('SplitPercent', sql.Decimal(5, 2), s.splitPercent)
          .query(`
            INSERT INTO CommissionSplit (CommissionSplitID, CommissionAgreementID, UserID, SplitPercent, CreatedOn)
            VALUES (@SplitID, @AgreementID, @UserID, @SplitPercent, GETDATE());
          `);
      }
      await tx.commit();
      return { ok: true };
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  static async listAgreements() {
    const pool = await poolPromise;
    const res = await pool.request().query(`
      SELECT
        a.CommissionAgreementID,
        a.ContractID,
        a.DealID,
        a.ClientID,
        c.ClientName,
        a.IsEligible,
        a.IneligibleReason,
        a.OverrideEligible,
        a.CreatedBy,
        a.CreatedOn,
        a.UpdatedOn
      FROM CommissionAgreement a
      LEFT JOIN Client c ON c.ClientID = a.ClientID
      ORDER BY a.UpdatedOn DESC;
    `);
    return res.recordset;
  }

  static async computeAccruals({ asOfDate = null } = {}) {
    const pool = await poolPromise;
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    const asOfStr = asOf.toISOString().slice(0, 10);

    // Pull agreements + splits
    const agreements = await pool.request().query(`
      SELECT a.CommissionAgreementID, a.ContractID, a.ClientID, a.IsEligible
      FROM CommissionAgreement a;
    `);
    const splits = await pool.request().query(`
      SELECT CommissionAgreementID, UserID, SplitPercent
      FROM CommissionSplit;
    `);
    const splitsByAgreement = new Map();
    for (const s of splits.recordset) {
      if (!splitsByAgreement.has(s.CommissionAgreementID)) splitsByAgreement.set(s.CommissionAgreementID, []);
      splitsByAgreement.get(s.CommissionAgreementID).push(s);
    }

    // Map client->qboCustomerId
    const mappingsRes = await pool.request().query(`SELECT ClientID, QboCustomerId FROM QboCustomerMapping;`);
    const qboByClient = new Map(mappingsRes.recordset.map((r) => [r.ClientID, r.QboCustomerId]));

    // Pull payments up to as-of
    const paymentsRes = await pool
      .request()
      .input('AsOf', sql.Date, asOfStr)
      .query(`SELECT QboPaymentId, QboInvoiceId, QboCustomerId, PaymentDate, Amount FROM QboPayment WHERE PaymentDate <= @AsOf;`);

    // Clear and recompute accruals for simplicity (developer may later optimize to diff-based)
    await pool.request().query(`DELETE FROM CommissionAccrual;`);

    for (const a of agreements.recordset) {
      if (!a.IsEligible) continue;
      const qboCustomerId = qboByClient.get(a.ClientID);
      if (!qboCustomerId) continue;

      // We don't have invoice ordering in the portal yet.
      // Practical heuristic: assign commission rates by chronological payment date per invoice.
      const custPayments = paymentsRes.recordset
        .filter((p) => p.QboCustomerId === qboCustomerId)
        .sort((x, y) => new Date(x.PaymentDate) - new Date(y.PaymentDate));

      // Group payments by invoice id; keep the earliest payment date as the "invoice sequence" key.
      const invoiceMap = new Map();
      for (const p of custPayments) {
        const key = p.QboInvoiceId || p.QboPaymentId;
        const existing = invoiceMap.get(key) || { invoiceId: key, payments: [], firstPaymentDate: p.PaymentDate };
        existing.payments.push(p);
        if (new Date(p.PaymentDate) < new Date(existing.firstPaymentDate)) existing.firstPaymentDate = p.PaymentDate;
        invoiceMap.set(key, existing);
      }

      const invoices = Array.from(invoiceMap.values()).sort((x, y) => new Date(x.firstPaymentDate) - new Date(y.firstPaymentDate));
      const firstThree = invoices.slice(0, 3);
      const splitsForAgreement = splitsByAgreement.get(a.CommissionAgreementID) || [];
      if (splitsForAgreement.length === 0) continue;

      for (let i = 0; i < firstThree.length; i++) {
        const inv = firstThree[i];
        const rate = COMMISSION_RATES[i] ?? 0;
        for (const pay of inv.payments) {
          const payablePeriodEnd = endOfNextMonth(pay.PaymentDate);
          // Payable period starts at the beginning of the month after payment
          const payablePeriodStart = new Date(new Date(pay.PaymentDate).getFullYear(), new Date(pay.PaymentDate).getMonth() + 1, 1).toISOString().slice(0, 10);
          const status = new Date(payablePeriodEnd) <= asOf ? 'PAYABLE' : 'ACCRUED';

          for (const sp of splitsForAgreement) {
            const commissionAmount = Number((Number(pay.Amount) * rate * (Number(sp.SplitPercent) / 100)).toFixed(2));
            await pool
              .request()
              .input('AccrualID', sql.UniqueIdentifier, uuidv4())
              .input('AgreementID', sql.UniqueIdentifier, a.CommissionAgreementID)
              .input('UserID', sql.UniqueIdentifier, sp.UserID)
              .input('MonthIndex', sql.Int, i + 1)
              .input('CommissionRate', sql.Decimal(6, 4), rate)
              .input('SplitPercent', sql.Decimal(5, 2), sp.SplitPercent)
              .input('QboPaymentTxnID', sql.NVarChar(100), pay.QboPaymentId)
              .input('PaymentDate', sql.Date, pay.PaymentDate)
              .input('BaseAmount', sql.Decimal(18, 2), pay.Amount)
              .input('CommissionAmount', sql.Decimal(18, 2), commissionAmount)
              .input('Status', sql.NVarChar(30), status)
              .input('PayablePeriodStart', sql.Date, payablePeriodStart)
              .input('PayablePeriodEnd', sql.Date, payablePeriodEnd)
              .query(`
                INSERT INTO CommissionAccrual (
                  CommissionAccrualID, CommissionAgreementID, UserID, MonthIndex, CommissionRate, SplitPercent,
                  QboPaymentTxnID, PaymentDate, BaseAmount, CommissionAmount, Status, PayablePeriodStart, PayablePeriodEnd,
                  CreatedOn
                ) VALUES (
                  @AccrualID, @AgreementID, @UserID, @MonthIndex, @CommissionRate, @SplitPercent,
                  @QboPaymentTxnID, @PaymentDate, @BaseAmount, @CommissionAmount, @Status, @PayablePeriodStart, @PayablePeriodEnd,
                  GETUTCDATE()
                );
              `);
          }
        }
      }
    }

    return { ok: true, asOf: asOfStr };
  }

  static async listAccruals({ userID = null, status = null } = {}) {
    const pool = await poolPromise;
    const req = pool.request();
    const filters = [];
    if (userID) {
      req.input('UserID', sql.UniqueIdentifier, userID);
      filters.push('ca.UserID = @UserID');
    }
    if (status) {
      req.input('Status', sql.NVarChar(30), status);
      filters.push('ca.Status = @Status');
    }
    const filter = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const res = await req.query(`
      SELECT
        ca.CommissionAccrualID,
        ca.CommissionAgreementID,
        ca.UserID,
        CONCAT(u.FirstName, ' ', u.LastName) AS UserName,
        ca.MonthIndex,
        ca.CommissionRate,
        ca.SplitPercent,
        ca.QboPaymentTxnID,
        ca.PaymentDate,
        ca.BaseAmount,
        ca.CommissionAmount,
        ca.Status,
        ca.PayablePeriodStart,
        ca.PayablePeriodEnd,
        ca.PaidOn,
        a.ContractID,
        a.ClientID,
        c.ClientName
      FROM CommissionAccrual ca
      LEFT JOIN CommissionAgreement a ON a.CommissionAgreementID = ca.CommissionAgreementID
      LEFT JOIN Client c ON c.ClientID = a.ClientID
      LEFT JOIN Users u ON u.UserID = ca.UserID
      ${filter}
      ORDER BY ca.PaymentDate DESC;
    `);
    return res.recordset;
  }

  // Aliases for controller compatibility
  static async listCustomerMappings() {
    const pool = await poolPromise;
    const res = await pool.request().query(`
      SELECT
        qcm.QboCustomerMappingID,
        qcm.ClientID,
        c.ClientName,
        qcm.QboCustomerID,
        qcm.QboCustomerName,
        qcm.ConfidenceScore,
        qcm.IsApproved,
        qcm.ApprovedBy,
        qcm.ApprovedOn,
        qcm.CreatedOn,
        qcm.UpdatedOn
      FROM QboCustomerMapping qcm
      LEFT JOIN Client c ON c.ClientID = qcm.ClientID
      ORDER BY qcm.UpdatedOn DESC;
    `);
    return res.recordset;
  }

  static async upsertCustomerMapping({ clientId, qboCustomerId, qboCustomerDisplayName, approvedBy = null }) {
    return this.upsertQboCustomerMapping({
      clientID: clientId,
      qboCustomerId,
      qboDisplayName: qboCustomerDisplayName,
      approvedBy,
    });
  }

  static async importPayments({ payments, importedBy }) {
    return this.importQboPayments({ payments, importedBy });
  }

  static async upsertAgreement({ contractId, clientId, isEligible = true, ineligibleReason = null, leadSource = null, quotedAmount = null, createdBy = null }) {
    // Note: leadSource and quotedAmount are not in the schema yet, but keeping for future compatibility
    // Notes column doesn't exist in CommissionAgreement table, so we ignore it
    return this.createAgreement({
      contractID: contractId,
      clientID: clientId,
      isEligible,
      ineligibleReason,
      createdBy,
      notes: null, // Notes column doesn't exist in the table
    });
  }

  static async replaceSplits({ agreementId, splits, updatedBy = null }) {
    return this.upsertSplits({
      commissionAgreementID: agreementId,
      splits: splits.map(s => ({
        userID: s.userId || s.userID,
        splitPercent: s.splitPercent,
      })),
    });
  }

  static async calculateAccruals({ asOfDate = null }) {
    return this.computeAccruals({ asOfDate });
  }
}

export default Commission;
