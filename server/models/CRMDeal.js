import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class CRMDeal {
  static async getAll(filters = {}) {
    const pool = await poolPromise;
    let query = `
      SELECT 
        d.*,
        s.StageName,
        s.Module AS StageModule,
        ls.SourceName AS LeadSourceName,
        c.FirstName + ' ' + c.LastName AS OwnerName,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        (SELECT COUNT(*) FROM CRMDealNote WHERE DealID = d.DealID) AS NoteCount,
        (SELECT COUNT(*) FROM CRMDealActivity WHERE DealID = d.DealID) AS ActivityCount,
        (SELECT TOP 1 ActivityDescription FROM CRMDealActivity WHERE DealID = d.DealID ORDER BY ActivityDate DESC) AS LastActivity,
        (SELECT TOP 1 ActivityDate FROM CRMDealActivity WHERE DealID = d.DealID ORDER BY ActivityDate DESC) AS LastActivityDate
      FROM CRMDeal d
      LEFT JOIN CRMStage s ON d.StageID = s.StageID
      LEFT JOIN CRMLeadSource ls ON d.LeadSourceID = ls.LeadSourceID
      LEFT JOIN Consultant c ON d.OwnerID = c.ConsultantID
      LEFT JOIN Users u ON d.CreatedBy = u.UserID
      WHERE d.IsActive = 1
    `;
    const request = pool.request();

    if (filters.module) {
      query += ' AND d.Module = @Module';
      request.input('Module', sql.NVarChar, filters.module);
    }

    if (filters.stageId) {
      query += ' AND d.StageID = @StageID';
      request.input('StageID', sql.UniqueIdentifier, filters.stageId);
    }

    if (filters.ownerId) {
      query += ' AND d.OwnerID = @OwnerID';
      request.input('OwnerID', sql.UniqueIdentifier, filters.ownerId);
    }

    if (filters.search) {
      query += ' AND (d.Company LIKE @Search OR d.Contact LIKE @Search)';
      request.input('Search', sql.NVarChar, `%${filters.search}%`);
    }

    query += ' ORDER BY d.UpdatedOn DESC';
    const result = await request.query(query);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('DealID', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          d.*,
          s.StageName,
          s.Module AS StageModule,
          ls.SourceName AS LeadSourceName,
          c.FirstName + ' ' + c.LastName AS OwnerName,
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM CRMDeal d
        LEFT JOIN CRMStage s ON d.StageID = s.StageID
        LEFT JOIN CRMLeadSource ls ON d.LeadSourceID = ls.LeadSourceID
        LEFT JOIN Consultant c ON d.OwnerID = c.ConsultantID
        LEFT JOIN Users u ON d.CreatedBy = u.UserID
        WHERE d.DealID = @DealID
      `);
    return result.recordset[0] || null;
  }

  // Helper function to calculate TCV from MRR, ContractTerm, and OnboardingFee
  static calculateTCV(mrr, contractTerm, onboardingFee) {
    const mrrValue = mrr ? parseFloat(mrr) : 0;
    const termValue = contractTerm ? parseInt(contractTerm) : 0;
    const feeValue = onboardingFee ? parseFloat(onboardingFee) : 0;
    
    if (mrrValue && termValue) {
      return mrrValue * termValue + feeValue;
    }
    return null;
  }

  static async create(data) {
    const pool = await poolPromise;
    const dealId = data.DealID || uuidv4();
    
    const toDecimalOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : num;
    };

    const toIntOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseInt(value) : value;
      return isNaN(num) ? null : num;
    };

    // Auto-calculate TCV if MRR and ContractTerm are provided
    // If Amount is explicitly provided, use it; otherwise calculate from MRR × Term + OnboardingFee
    let calculatedAmount = null;
    if (data.MRR && data.ContractTerm) {
      calculatedAmount = this.calculateTCV(data.MRR, data.ContractTerm, data.OnboardingFee || 0);
    }
    const finalAmount = data.Amount !== undefined && data.Amount !== null && data.Amount !== '' 
      ? toDecimalOrNull(data.Amount) 
      : calculatedAmount;

    const result = await pool
      .request()
      .input('DealID', sql.UniqueIdentifier, dealId)
      .input('Module', sql.NVarChar, data.Module)
      .input('Company', sql.NVarChar, data.Company)
      .input('Contact', sql.NVarChar, data.Contact || null)
      .input('ContactTitle', sql.NVarChar, data.ContactTitle || null)
      .input('ContactEmail', sql.NVarChar, data.ContactEmail || null)
      .input('ContactPhone', sql.NVarChar, data.ContactPhone || null)
      .input('Amount', sql.Decimal(18, 2), toDecimalOrNull(finalAmount))
      .input('MRR', sql.Decimal(18, 2), toDecimalOrNull(data.MRR))
      .input('ContractTerm', sql.Int, toIntOrNull(data.ContractTerm))
      .input('OnboardingFee', sql.Decimal(18, 2), toDecimalOrNull(data.OnboardingFee))
      .input('OwnerID', sql.UniqueIdentifier, data.OwnerID || null)
      .input('LeadSourceID', sql.UniqueIdentifier, data.LeadSourceID || null)
      .input('StageID', sql.UniqueIdentifier, data.StageID)
      .input('CompanySize', sql.NVarChar, data.CompanySize || null)
      .input('Notes', sql.NVarChar(sql.MAX), data.Notes || null)
      .input('DetailsJson', sql.NVarChar(sql.MAX), data.DetailsJson ? JSON.stringify(data.DetailsJson) : null)
      .input('ManualScoreBoost', sql.Int, data.ManualScoreBoost || 0)
      .input('CreatedBy', sql.UniqueIdentifier, data.CreatedBy || null)
      .input('IsActive', sql.Bit, data.IsActive !== undefined ? data.IsActive : 1)
      .query(`
        INSERT INTO CRMDeal (
          DealID, Module, Company, Contact, ContactTitle, ContactEmail, ContactPhone,
          Amount, MRR, ContractTerm, OnboardingFee, OwnerID, LeadSourceID, StageID, CompanySize,
          Notes, DetailsJson, ManualScoreBoost, CreatedBy, IsActive
        )
        VALUES (
          @DealID, @Module, @Company, @Contact, @ContactTitle, @ContactEmail, @ContactPhone,
          @Amount, @MRR, @ContractTerm, @OnboardingFee, @OwnerID, @LeadSourceID, @StageID, @CompanySize,
          @Notes, @DetailsJson, @ManualScoreBoost, @CreatedBy, @IsActive
        );
        SELECT * FROM CRMDeal WHERE DealID = @DealID;
      `);
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    
    const toDecimalOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : num;
    };

    const toIntOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseInt(value) : value;
      return isNaN(num) ? null : num;
    };

    // Get current deal to check existing values
    const currentDeal = await this.getById(id);
    if (!currentDeal) {
      throw new Error('Deal not found');
    }

    // Determine MRR, ContractTerm, and OnboardingFee values (use updated or existing)
    const mrr = data.MRR !== undefined ? data.MRR : currentDeal.MRR;
    const contractTerm = data.ContractTerm !== undefined ? data.ContractTerm : currentDeal.ContractTerm;
    const onboardingFee = data.OnboardingFee !== undefined ? data.OnboardingFee : currentDeal.OnboardingFee;

    // Auto-calculate TCV if MRR and ContractTerm are available
    // Only auto-calculate if Amount is not explicitly provided (prevent manual override)
    let calculatedAmount = null;
    if (mrr && contractTerm) {
      calculatedAmount = this.calculateTCV(mrr, contractTerm, onboardingFee || 0);
    }
    
    // Only update Amount if it's not explicitly provided (to prevent manual entry)
    // If MRR/ContractTerm changed, recalculate Amount
    const shouldRecalculateAmount = (data.MRR !== undefined || data.ContractTerm !== undefined || data.OnboardingFee !== undefined);
    const finalAmount = shouldRecalculateAmount && calculatedAmount !== null 
      ? calculatedAmount 
      : (data.Amount !== undefined ? toDecimalOrNull(data.Amount) : currentDeal.Amount);

    // Build dynamic update query
    const updates = [];
    const request = pool.request().input('DealID', sql.UniqueIdentifier, id);

    if (data.Module !== undefined) {
      updates.push('Module = @Module');
      request.input('Module', sql.NVarChar, data.Module);
    }
    if (data.Company !== undefined) {
      updates.push('Company = @Company');
      request.input('Company', sql.NVarChar, data.Company);
    }
    if (data.Contact !== undefined) {
      updates.push('Contact = @Contact');
      request.input('Contact', sql.NVarChar, data.Contact);
    }
    if (data.ContactTitle !== undefined) {
      updates.push('ContactTitle = @ContactTitle');
      request.input('ContactTitle', sql.NVarChar, data.ContactTitle);
    }
    if (data.ContactEmail !== undefined) {
      updates.push('ContactEmail = @ContactEmail');
      request.input('ContactEmail', sql.NVarChar, data.ContactEmail);
    }
    if (data.ContactPhone !== undefined) {
      updates.push('ContactPhone = @ContactPhone');
      request.input('ContactPhone', sql.NVarChar, data.ContactPhone);
    }
    if (shouldRecalculateAmount && calculatedAmount !== null) {
      updates.push('Amount = @Amount');
      request.input('Amount', sql.Decimal(18, 2), toDecimalOrNull(finalAmount));
    } else if (data.Amount !== undefined) {
      // Only allow manual Amount if MRR/ContractTerm are not set
      if (!mrr || !contractTerm) {
        updates.push('Amount = @Amount');
        request.input('Amount', sql.Decimal(18, 2), toDecimalOrNull(data.Amount));
      }
    }
    if (data.MRR !== undefined) {
      updates.push('MRR = @MRR');
      request.input('MRR', sql.Decimal(18, 2), toDecimalOrNull(data.MRR));
    }
    if (data.ContractTerm !== undefined) {
      updates.push('ContractTerm = @ContractTerm');
      request.input('ContractTerm', sql.Int, toIntOrNull(data.ContractTerm));
    }
    if (data.OnboardingFee !== undefined) {
      updates.push('OnboardingFee = @OnboardingFee');
      request.input('OnboardingFee', sql.Decimal(18, 2), toDecimalOrNull(data.OnboardingFee));
    }
    if (data.OwnerID !== undefined) {
      updates.push('OwnerID = @OwnerID');
      request.input('OwnerID', sql.UniqueIdentifier, data.OwnerID);
    }
    if (data.LeadSourceID !== undefined) {
      updates.push('LeadSourceID = @LeadSourceID');
      request.input('LeadSourceID', sql.UniqueIdentifier, data.LeadSourceID);
    }
    if (data.StageID !== undefined) {
      updates.push('StageID = @StageID');
      request.input('StageID', sql.UniqueIdentifier, data.StageID);
    }
    if (data.CompanySize !== undefined) {
      updates.push('CompanySize = @CompanySize');
      request.input('CompanySize', sql.NVarChar, data.CompanySize);
    }
    if (data.ClosedReason !== undefined) {
      updates.push('ClosedReason = @ClosedReason');
      request.input('ClosedReason', sql.NVarChar, data.ClosedReason);
    }
    if (data.ClosedDate !== undefined) {
      updates.push('ClosedDate = @ClosedDate');
      request.input('ClosedDate', sql.DateTime2, data.ClosedDate);
    }
    if (data.Notes !== undefined) {
      updates.push('Notes = @Notes');
      request.input('Notes', sql.NVarChar(sql.MAX), data.Notes);
    }
    if (data.DetailsJson !== undefined) {
      updates.push('DetailsJson = @DetailsJson');
      request.input('DetailsJson', sql.NVarChar(sql.MAX), data.DetailsJson ? JSON.stringify(data.DetailsJson) : null);
    }
    if (data.ManualScoreBoost !== undefined) {
      updates.push('ManualScoreBoost = @ManualScoreBoost');
      request.input('ManualScoreBoost', sql.Int, data.ManualScoreBoost);
    }
    if (data.IsActive !== undefined) {
      updates.push('IsActive = @IsActive');
      request.input('IsActive', sql.Bit, data.IsActive);
    }

    if (updates.length === 0) {
      return await this.getById(id);
    }

    updates.push('UpdatedOn = GETDATE()');

    const result = await request.query(`
      UPDATE CRMDeal
      SET ${updates.join(', ')}
      WHERE DealID = @DealID;
      SELECT * FROM CRMDeal WHERE DealID = @DealID;
    `);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('DealID', sql.UniqueIdentifier, id)
      .query('UPDATE CRMDeal SET IsActive = 0 WHERE DealID = @DealID');
    return true;
  }
}

export default CRMDeal;

