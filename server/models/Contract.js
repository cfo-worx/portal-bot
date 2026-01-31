import { poolPromise, sql } from '../db.js';

class Contract {
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Contract');
    return result.recordset;
  }

  static async getByClientId(clientId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, clientId)
      .query('SELECT * FROM Contract WHERE ClientID = @ClientID ORDER BY ContractStartDate DESC');
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ContractID', sql.UniqueIdentifier, id)
      .query('SELECT * FROM Contract WHERE ContractID = @ContractID');
    return result.recordset[0] || null;
  }

  static async create(data) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ContractID', sql.UniqueIdentifier, data.ContractID)
      .input('ClientID', sql.UniqueIdentifier, data.ClientID)
      .input('ContractName', sql.NVarChar, data.ContractName || null)
      .input('ContractType', sql.NVarChar, data.ContractType)
      .input('ContractLength', sql.Int, data.ContractLength)
      .input('OnboardingFee', sql.Decimal(18, 2), data.OnboardingFee)
      .input('AssignedCFO', sql.NVarChar, data.AssignedCFO)
      .input('AssignedCFORate', sql.Decimal(18, 2), data.AssignedCFORate)
      .input('AssignedController', sql.NVarChar, data.AssignedController)
      .input('AssignedControllerRate', sql.Decimal(18, 2), data.AssignedControllerRate)
      .input('AssignedSeniorAccountant', sql.NVarChar, data.AssignedSeniorAccountant)
      .input('AssignedSeniorAccountantRate', sql.Decimal(18, 2), data.AssignedSeniorAccountantRate)
      .input('AssignedSoftware', sql.NVarChar, data.AssignedSoftware || null)
      .input('AssignedSoftwareRate', sql.Decimal(18, 2), data.AssignedSoftwareRate || null)
      .input('AssignedSoftwareQuantity', sql.Int, data.AssignedSoftwareQuantity || null)
      .input('AssignedSoftwareCost', sql.Decimal(18, 2), data.AssignedSoftwareCost || null)
      .input('AssignedSoftwareProvidedFree', sql.Bit, data.AssignedSoftwareProvidedFree ? 1 : 0)
      .input('ContractStartDate', sql.Date, data.ContractStartDate)
      .input('ContractEndDate', sql.Date, data.ContractEndDate)
      .input('ContractEndReason', sql.NVarChar, data.ContractEndReason)
      .input('TotalProjectFee', sql.Decimal(18, 2), data.TotalProjectFee)
      .input('PercentageOfCompanySale', sql.Decimal(18, 2), data.PercentageOfCompanySale)
      .input('HourlyRateLow', sql.Decimal(18, 2), data.HourlyRateLow)
      .input('HourlyRateHigh', sql.Decimal(18, 2), data.HourlyRateHigh)
      .input('MonthlyFee', sql.Decimal(18, 2), data.MonthlyFee)
      .input('MonthlyFeeLow', sql.Decimal(18, 2), data.MonthlyFeeLow || null)
      .input('MonthlyFeeHigh', sql.Decimal(18, 2), data.MonthlyFeeHigh || null)
      .input('AdditionalStaff', sql.NVarChar(sql.MAX), data.AdditionalStaff)
      // Legacy fields for backward compatibility
      .input('MonthlyRevenue', sql.Decimal(18, 2), data.MonthlyRevenue)
      .input('PricingType', sql.NVarChar, data.PricingType)
      .input('TotalFee', sql.Decimal(18, 2), data.TotalFee)
      .input('LowerFee', sql.Decimal(18, 2), data.LowerFee)
      .input('HigherFee', sql.Decimal(18, 2), data.HigherFee)
      .input('CreatedOn', sql.DateTime, data.CreatedOn)
      .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
      .query(`
        INSERT INTO Contract (
          ContractID,
          ClientID,
          ContractName,
          ContractType,
          ContractLength,
          OnboardingFee,
          AssignedCFO,
          AssignedCFORate,
          AssignedController,
          AssignedControllerRate,
          AssignedSeniorAccountant,
          AssignedSeniorAccountantRate,
          AssignedSoftware,
          AssignedSoftwareRate,
          AssignedSoftwareQuantity,
          AssignedSoftwareCost,
          AssignedSoftwareProvidedFree,
          ContractStartDate,
          ContractEndDate,
          ContractEndReason,
          TotalProjectFee,
          PercentageOfCompanySale,
          HourlyRateLow,
          HourlyRateHigh,
          MonthlyFee,
          MonthlyFeeLow,
          MonthlyFeeHigh,
          AdditionalStaff,
          MonthlyRevenue,
          PricingType,
          TotalFee,
          LowerFee,
          HigherFee,
          CreatedOn,
          UpdatedOn
        ) VALUES (
          @ContractID,
          @ClientID,
          @ContractName,
          @ContractType,
          @ContractLength,
          @OnboardingFee,
          @AssignedCFO,
          @AssignedCFORate,
          @AssignedController,
          @AssignedControllerRate,
          @AssignedSeniorAccountant,
          @AssignedSeniorAccountantRate,
          @AssignedSoftware,
          @AssignedSoftwareRate,
          @AssignedSoftwareQuantity,
          @AssignedSoftwareCost,
          @AssignedSoftwareProvidedFree,
          @ContractStartDate,
          @ContractEndDate,
          @ContractEndReason,
          @TotalProjectFee,
          @PercentageOfCompanySale,
          @HourlyRateLow,
          @HourlyRateHigh,
          @MonthlyFee,
          @MonthlyFeeLow,
          @MonthlyFeeHigh,
          @AdditionalStaff,
          @MonthlyRevenue,
          @PricingType,
          @TotalFee,
          @LowerFee,
          @HigherFee,
          @CreatedOn,
          @UpdatedOn
        );
        
        SELECT * FROM Contract WHERE ContractID = @ContractID;
      `);
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ContractID', sql.UniqueIdentifier, id)
      .input('ClientID', sql.UniqueIdentifier, data.ClientID)
      .input('ContractName', sql.NVarChar, data.ContractName || null)
      .input('ContractType', sql.NVarChar, data.ContractType)
      .input('ContractLength', sql.Int, data.ContractLength)
      .input('OnboardingFee', sql.Decimal(18, 2), data.OnboardingFee)
      .input('AssignedCFO', sql.NVarChar, data.AssignedCFO)
      .input('AssignedCFORate', sql.Decimal(18, 2), data.AssignedCFORate)
      .input('AssignedController', sql.NVarChar, data.AssignedController)
      .input('AssignedControllerRate', sql.Decimal(18, 2), data.AssignedControllerRate)
      .input('AssignedSeniorAccountant', sql.NVarChar, data.AssignedSeniorAccountant)
      .input('AssignedSeniorAccountantRate', sql.Decimal(18, 2), data.AssignedSeniorAccountantRate)
      .input('AssignedSoftware', sql.NVarChar, data.AssignedSoftware)
      .input('AssignedSoftwareRate', sql.Decimal(18, 2), data.AssignedSoftwareRate)
      .input('AssignedSoftwareQuantity', sql.Int, data.AssignedSoftwareQuantity || null)
      .input('AssignedSoftwareCost', sql.Decimal(18, 2), data.AssignedSoftwareCost || null)
      .input('AssignedSoftwareProvidedFree', sql.Bit, data.AssignedSoftwareProvidedFree ? 1 : 0)
      .input('ContractStartDate', sql.Date, data.ContractStartDate)
      .input('ContractEndDate', sql.Date, data.ContractEndDate)
      .input('ContractEndReason', sql.NVarChar, data.ContractEndReason)
      .input('TotalProjectFee', sql.Decimal(18, 2), data.TotalProjectFee)
      .input('PercentageOfCompanySale', sql.Decimal(18, 2), data.PercentageOfCompanySale)
      .input('HourlyRateLow', sql.Decimal(18, 2), data.HourlyRateLow)
      .input('HourlyRateHigh', sql.Decimal(18, 2), data.HourlyRateHigh)
      .input('MonthlyFee', sql.Decimal(18, 2), data.MonthlyFee)
      .input('MonthlyFeeLow', sql.Decimal(18, 2), data.MonthlyFeeLow || null)
      .input('MonthlyFeeHigh', sql.Decimal(18, 2), data.MonthlyFeeHigh || null)
      .input('AdditionalStaff', sql.NVarChar(sql.MAX), data.AdditionalStaff)
      // Legacy fields for backward compatibility
      .input('MonthlyRevenue', sql.Decimal(18, 2), data.MonthlyRevenue)
      .input('PricingType', sql.NVarChar, data.PricingType)
      .input('TotalFee', sql.Decimal(18, 2), data.TotalFee)
      .input('LowerFee', sql.Decimal(18, 2), data.LowerFee)
      .input('HigherFee', sql.Decimal(18, 2), data.HigherFee)
      .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
      .query(`
        UPDATE Contract
        SET 
          ClientID = @ClientID,
          ContractName = @ContractName,
          ContractType = @ContractType,
          ContractLength = @ContractLength,
          OnboardingFee = @OnboardingFee,
          AssignedCFO = @AssignedCFO,
          AssignedCFORate = @AssignedCFORate,
          AssignedController = @AssignedController,
          AssignedControllerRate = @AssignedControllerRate,
          AssignedSeniorAccountant = @AssignedSeniorAccountant,
          AssignedSeniorAccountantRate = @AssignedSeniorAccountantRate,
          AssignedSoftware = @AssignedSoftware,
          AssignedSoftwareRate = @AssignedSoftwareRate,
          AssignedSoftwareQuantity = @AssignedSoftwareQuantity,
          AssignedSoftwareCost = @AssignedSoftwareCost,
          AssignedSoftwareProvidedFree = @AssignedSoftwareProvidedFree,
          ContractStartDate = @ContractStartDate,
          ContractEndDate = @ContractEndDate,
          ContractEndReason = @ContractEndReason,
          TotalProjectFee = @TotalProjectFee,
          PercentageOfCompanySale = @PercentageOfCompanySale,
          HourlyRateLow = @HourlyRateLow,
          HourlyRateHigh = @HourlyRateHigh,
          MonthlyFee = @MonthlyFee,
          MonthlyFeeLow = @MonthlyFeeLow,
          MonthlyFeeHigh = @MonthlyFeeHigh,
          AdditionalStaff = @AdditionalStaff,
          MonthlyRevenue = @MonthlyRevenue,
          PricingType = @PricingType,
          TotalFee = @TotalFee,
          LowerFee = @LowerFee,
          HigherFee = @HigherFee,
          UpdatedOn = @UpdatedOn
        WHERE ContractID = @ContractID;
        
        SELECT * FROM Contract WHERE ContractID = @ContractID;
      `);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('ContractID', sql.UniqueIdentifier, id)
      .query('DELETE FROM Contract WHERE ContractID = @ContractID');
  }

  static async deleteByClientId(clientId) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, clientId)
      .query('DELETE FROM Contract WHERE ClientID = @ClientID');
  }
}

export default Contract;