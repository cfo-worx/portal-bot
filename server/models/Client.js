import { poolPromise, sql } from '../db.js';

class Client {
  // Helper method to calculate revenue from active contracts (similar to financial reporting)
  static async calculateClientRevenue(clientId) {
    const pool = await poolPromise;
    
    // Get contracts
    const contractsResult = await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, clientId)
      .query(`
        SELECT 
          ContractID,
          ContractType,
          TotalProjectFee,
          MonthlyFee,
          MonthlyFeeLow,
          MonthlyFeeHigh,
          ContractStartDate,
          ContractEndDate,
          ContractLength,
          AssignedCFO,
          AssignedCFORate,
          AssignedController,
          AssignedControllerRate,
          AssignedSeniorAccountant,
          AssignedSeniorAccountantRate,
          AdditionalStaff
        FROM Contract
        WHERE ClientID = @ClientID
      `);
    
    // Get benchmarks for the client
    const benchmarksResult = await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, clientId)
      .query(`
        SELECT 
          b.ConsultantID,
          b.TargetHours,
          c.FirstName + ' ' + c.LastName AS ConsultantName
        FROM Benchmark b
        JOIN Consultant c ON b.ConsultantID = c.ConsultantID
        WHERE b.ClientID = @ClientID
      `);
    
    // Create a map of consultant names to target hours
    const benchmarkMap = {};
    benchmarksResult.recordset.forEach(benchmark => {
      const consultantName = benchmark.ConsultantName?.trim().toLowerCase();
      if (consultantName) {
        benchmarkMap[consultantName] = parseFloat(benchmark.TargetHours) || 0;
      }
    });
    
    const contracts = contractsResult.recordset;
    let recurringRevenue = 0;
    let projectRevenue = 0;

    for (const contract of contracts) {
      const contractType = contract.ContractType || 'Project';
      const contractLength = contract.ContractLength;

      if (contractType === 'Project' || contractType === 'M&A') {
        // Project revenue: TotalProjectFee
        projectRevenue += parseFloat(contract.TotalProjectFee) || 0;
      } else if (contractType === 'Recurring') {
        recurringRevenue += parseFloat(contract.MonthlyFee) || 0;
      } else if (contractType === 'Hourly') {
        // For Hourly contracts: loop through all staff, get target hours from benchmark, multiply by hourly rate, sum all
        let hourlyRevenue = 0;
        
        // Helper function to get target hours for a staff member by name
        const getTargetHours = (staffName) => {
          if (!staffName) return 0;
          const normalizedName = staffName.trim().toLowerCase();
          return benchmarkMap[normalizedName] || 0;
        };
        
        // Process AssignedCFO
        if (contract.AssignedCFO) {
          const targetHours = getTargetHours(contract.AssignedCFO);
          const rate = parseFloat(contract.AssignedCFORate) || 0;
          hourlyRevenue += targetHours * rate;
        }
        
        // Process AssignedController
        if (contract.AssignedController) {
          const targetHours = getTargetHours(contract.AssignedController);
          const rate = parseFloat(contract.AssignedControllerRate) || 0;
          hourlyRevenue += targetHours * rate;
        }
        
        // Process AssignedSeniorAccountant
        if (contract.AssignedSeniorAccountant) {
          const targetHours = getTargetHours(contract.AssignedSeniorAccountant);
          const rate = parseFloat(contract.AssignedSeniorAccountantRate) || 0;
          hourlyRevenue += targetHours * rate;
        }
        
        // Process AdditionalStaff (JSON array)
        if (contract.AdditionalStaff) {
          try {
            const additionalStaff = typeof contract.AdditionalStaff === 'string' 
              ? JSON.parse(contract.AdditionalStaff) 
              : contract.AdditionalStaff;
            
            if (Array.isArray(additionalStaff)) {
              additionalStaff.forEach(staff => {
                const staffName = staff.name || staff.Name || '';
                if (staffName) {
                  const targetHours = getTargetHours(staffName);
                  const rate = parseFloat(staff.rate || staff.Rate) || 0;
                  hourlyRevenue += targetHours * rate;
                }
              });
            }
          } catch (error) {
            console.error('Error parsing AdditionalStaff:', error);
          }
        }
        
        recurringRevenue += hourlyRevenue;
      }
    }

    return { RecurringRevenue: recurringRevenue, ProjectRevenue: projectRevenue };
  }

  static async getAll() {
    const pool = await poolPromise;
    const clients = await pool.request().query('SELECT * FROM Client');
    
    // Calculate revenue for each client
    const clientsWithRevenue = await Promise.all(
      clients.recordset.map(async (client) => {
        const revenue = await this.calculateClientRevenue(client.ClientID);
        return {
          ...client,
          RecurringRevenue: revenue.RecurringRevenue,
          ProjectRevenue: revenue.ProjectRevenue,
        };
      })
    );

    return clientsWithRevenue;
  }

  static async getActiveClients() {
    const pool = await poolPromise;
    const clients = await pool.request().query('SELECT * FROM Client WHERE ActiveStatus = 1');
    
    // Calculate revenue for each client
    const clientsWithRevenue = await Promise.all(
      clients.recordset.map(async (client) => {
        const revenue = await this.calculateClientRevenue(client.ClientID);
        return {
          ...client,
          RecurringRevenue: revenue.RecurringRevenue,
          ProjectRevenue: revenue.ProjectRevenue,
        };
      })
    );

    return clientsWithRevenue;
  }


 static async getActiveClientsForConsultant(consultantId) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('ConsultantID', sql.UniqueIdentifier, consultantId)
    .query(`
      SELECT DISTINCT
        c.*,
        embed.ProjectID,
        embed.ProjectName
      FROM Client c
      INNER JOIN Benchmark b ON c.ClientID = b.ClientID
      LEFT OUTER JOIN (
        SELECT DISTINCT
          tcons.ConsultantID,
          task.ProjectID,
          p.ProjectName,
          p.ClientID
        FROM Tasks task
        INNER JOIN TaskConsultants tcons ON tcons.TaskID = task.TaskID
        LEFT OUTER JOIN Projects p ON p.ProjectID = task.ProjectID AND p.Status = 'Active'
        WHERE tcons.ConsultantID = @ConsultantID
      ) AS embed ON embed.ClientID = c.ClientID
      WHERE c.ActiveStatus = 1 AND b.ConsultantID = @ConsultantID
    `);
  
  // Calculate revenue for each client
  const clientsWithRevenue = await Promise.all(
    result.recordset.map(async (client) => {
      const revenue = await this.calculateClientRevenue(client.ClientID);
      return {
        ...client,
        RecurringRevenue: revenue.RecurringRevenue,
        ProjectRevenue: revenue.ProjectRevenue,
      };
    })
  );

  return clientsWithRevenue;
}


static async create(data) {
  const pool = await poolPromise;
  
  // Helper function to convert to number or null
  const toDecimalOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? null : num;
  };
  
  const result = await pool
    .request()
    .input('ClientID', sql.UniqueIdentifier, data.ClientID)
    .input('ClientName', sql.NVarChar, data.ClientName || null)
    .input('ClientAddress', sql.NVarChar, data.ClientAddress || null)
    .input('BillingEmail', sql.NVarChar, data.BillingEmail || null)
    .input('PhoneNumber', sql.NVarChar, data.PhoneNumber || null)
    .input('InitialContractLength', sql.Int, data.InitialContractLength || null)
    .input('MonthlyRevenue', sql.Decimal(18, 2), data.MonthlyRevenue || null)
    .input('OnboardingFee', sql.Decimal(18, 2), data.OnboardingFee || null)
    .input('AccountingSystem', sql.NVarChar, data.AccountingSystem || null)
    .input('RevenueRange', sql.NVarChar, data.RevenueRange || null)
    .input('ActiveStatus', sql.Bit, data.ActiveStatus !== undefined ? data.ActiveStatus : false)
    .input('CreatedOn', sql.DateTime, data.CreatedOn)
    .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
    .input('GrossProfitTarget', sql.Numeric(16, 0), data.GrossProfitTarget || null)
    .input('PaymentMethodJson', sql.NVarChar(sql.MAX), data.PaymentMethodJson || null)
    .input('Industry', sql.NVarChar, data.Industry || null)
    .input('EIN', sql.NVarChar, data.EIN || null)
    .input('EntityType', sql.NVarChar, data.EntityType || null)
    .input('CustomEntity', sql.NVarChar, data.CustomEntity || null)
    .input('PrimaryOwner', sql.NVarChar, data.PrimaryOwner || null)
    .input('PrimaryOwnershipPct', sql.Decimal(5, 2), toDecimalOrNull(data.PrimaryOwnershipPct))
    .input('SecondaryOwner', sql.NVarChar, data.SecondaryOwner || null)
    .input('SecondaryOwnershipPct', sql.Decimal(5, 2), toDecimalOrNull(data.SecondaryOwnershipPct))
    .input('AddressLine1', sql.NVarChar, data.AddressLine1 || null)
    .input('AddressLine2', sql.NVarChar, data.AddressLine2 || null)
    .input('AddressLine3', sql.NVarChar, data.AddressLine3 || null)
    .input('City', sql.NVarChar, data.City || null)
    .input('State', sql.NVarChar, data.State || null)
    .input('Zip', sql.NVarChar, data.Zip || null)
    .input('FinancialSystemsJson', sql.NVarChar(sql.MAX), data.FinancialSystemsJson || null)
    .input('CollaborationToolsJson', sql.NVarChar(sql.MAX), data.CollaborationToolsJson || null)
    .query(`
      INSERT INTO Client (
        ClientID,
        ClientName,
        ClientAddress,
        BillingEmail,
        PhoneNumber,
        InitialContractLength,
        MonthlyRevenue,
        OnboardingFee,
        AccountingSystem,
        RevenueRange,
        ActiveStatus,
        CreatedOn,
        UpdatedOn,
        GrossProfitTarget,
        Industry,
        PaymentMethodJson,
        EIN,
        EntityType,
        CustomEntity,
        PrimaryOwner,
        PrimaryOwnershipPct,
        SecondaryOwner,
        SecondaryOwnershipPct,
        AddressLine1,
        AddressLine2,
        AddressLine3,
        City,
        State,
        Zip,
        FinancialSystemsJson,
        CollaborationToolsJson
      ) VALUES (
        @ClientID,
        @ClientName,
        @ClientAddress,
        @BillingEmail,
        @PhoneNumber,
        @InitialContractLength,
        @MonthlyRevenue,
        @OnboardingFee,
        @AccountingSystem,
        @RevenueRange,
        @ActiveStatus,
        @CreatedOn,
        @UpdatedOn,
        @GrossProfitTarget,
        @Industry,
        @PaymentMethodJson,
        @EIN,
        @EntityType,
        @CustomEntity,
        @PrimaryOwner,
        @PrimaryOwnershipPct,
        @SecondaryOwner,
        @SecondaryOwnershipPct,
        @AddressLine1,
        @AddressLine2,
        @AddressLine3,
        @City,
        @State,
        @Zip,
        @FinancialSystemsJson,
        @CollaborationToolsJson
      );
      
      SELECT * FROM Client WHERE ClientID = @ClientID;
    `);
  return result.recordset[0];
}


  static async update(id, data) {
    const pool = await poolPromise;
    
    // Helper function to convert to number or null
    const toDecimalOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : num;
    };
    
    const result = await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, id)
      .input('ClientName', sql.NVarChar, data.ClientName)
      .input('ClientAddress', sql.NVarChar, data.ClientAddress)
      .input('BillingEmail', sql.NVarChar, data.BillingEmail)
      .input('PhoneNumber', sql.NVarChar, data.PhoneNumber)
      .input('InitialContractLength', sql.Int, data.InitialContractLength)
      .input('MonthlyRevenue', sql.Decimal(18, 2), data.MonthlyRevenue)
      .input('OnboardingFee', sql.Decimal(18, 2), data.OnboardingFee)
      .input('AccountingSystem', sql.NVarChar, data.AccountingSystem)
      .input('RevenueRange', sql.NVarChar, data.RevenueRange)
      .input('ActiveStatus', sql.Bit, data.ActiveStatus)
      .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
      .input('Industry', sql.NVarChar, data.Industry)
      .input('GrossProfitTarget', sql.Numeric(16, 0), data.GrossProfitTarget)
      .input('PaymentMethodJson', sql.NVarChar(sql.MAX), data.PaymentMethodJson !== undefined ? data.PaymentMethodJson : null)
      .input('EIN', sql.NVarChar, data.EIN)
      .input('EntityType', sql.NVarChar, data.EntityType)
      .input('CustomEntity', sql.NVarChar, data.CustomEntity)
      .input('PrimaryOwner', sql.NVarChar, data.PrimaryOwner)
      .input('PrimaryOwnershipPct', sql.Decimal(5, 2), toDecimalOrNull(data.PrimaryOwnershipPct))
      .input('SecondaryOwner', sql.NVarChar, data.SecondaryOwner)
      .input('SecondaryOwnershipPct', sql.Decimal(5, 2), toDecimalOrNull(data.SecondaryOwnershipPct))
      .input('AddressLine1', sql.NVarChar, data.AddressLine1)
      .input('AddressLine2', sql.NVarChar, data.AddressLine2)
      .input('AddressLine3', sql.NVarChar, data.AddressLine3)
      .input('City', sql.NVarChar, data.City)
      .input('State', sql.NVarChar, data.State)
      .input('Zip', sql.NVarChar, data.Zip)
      .input('FinancialSystemsJson', sql.NVarChar(sql.MAX), data.FinancialSystemsJson !== undefined ? data.FinancialSystemsJson : null)
      .input('CollaborationToolsJson', sql.NVarChar(sql.MAX), data.CollaborationToolsJson !== undefined ? data.CollaborationToolsJson : null)
      .query(`
        UPDATE Client
        SET 
          ClientName = @ClientName,
          ClientAddress = @ClientAddress,
          BillingEmail = @BillingEmail,
          PhoneNumber = @PhoneNumber,
          InitialContractLength = @InitialContractLength,
          MonthlyRevenue = @MonthlyRevenue,
          OnboardingFee = @OnboardingFee,
          AccountingSystem = @AccountingSystem,
          RevenueRange = @RevenueRange,
          ActiveStatus = @ActiveStatus,
          UpdatedOn = @UpdatedOn,
          GrossProfitTarget = @GrossProfitTarget,
          Industry = @Industry,
          PaymentMethodJson = @PaymentMethodJson,
          EIN = @EIN,
          EntityType = @EntityType,
          CustomEntity = @CustomEntity,
          PrimaryOwner = @PrimaryOwner,
          PrimaryOwnershipPct = @PrimaryOwnershipPct,
          SecondaryOwner = @SecondaryOwner,
          SecondaryOwnershipPct = @SecondaryOwnershipPct,
          AddressLine1 = @AddressLine1,
          AddressLine2 = @AddressLine2,
          AddressLine3 = @AddressLine3,
          City = @City,
          State = @State,
          Zip = @Zip,
          FinancialSystemsJson = @FinancialSystemsJson,
          CollaborationToolsJson = @CollaborationToolsJson
        WHERE ClientID = @ClientID
      `);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, id)
      .query(`DELETE FROM Client WHERE ClientID = @ClientID`);
  }

  static async getOnboardingStep(clientId) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input('clientId', sql.UniqueIdentifier, clientId)
    .query('SELECT OnboardingStep FROM Client WHERE ClientID = @clientId');

  return result.recordset[0]?.OnboardingStep ?? 0;
}

static async updateOnboardingStep(clientId, step) {
  const pool = await poolPromise;
  await pool
    .request()
    .input('clientId', sql.UniqueIdentifier, clientId)
    .input('step', sql.Int, step)
    .query('UPDATE Client SET OnboardingStep = @step WHERE ClientID = @clientId');
}


  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, id)
      .query('SELECT * FROM Client WHERE ClientID = @ClientID');
    
    if (!result.recordset[0]) return null;
    
    const client = result.recordset[0];
    const revenue = await this.calculateClientRevenue(id);
    
    return {
      ...client,
      RecurringRevenue: revenue.RecurringRevenue,
      ProjectRevenue: revenue.ProjectRevenue,
    };
  }


  static async patch(id, data) {
    const pool = await poolPromise;
    const keys = Object.keys(data);
    if (keys.length === 0) return null;

    // Helper function to convert to number or null
    const toDecimalOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : num;
    };

    // Build "SET col1 = @col1, col2 = @col2, ..." dynamically
    const setClause = keys.map(k => `[${k}] = @${k}`).join(', ');

    // Attach inputs
    const req = pool.request().input('ClientID', sql.UniqueIdentifier, id);
    keys.forEach((col) => {
      // You might need to map JS field names to SQL types:
      let sqlType = sql.NVarChar;
      let value = data[col];
      
      // customize for numeric/date fields:
      if (['MonthlyRevenue','OnboardingFee'].includes(col)) {
        sqlType = sql.Decimal(18,2);
      } else if (col === 'PrimaryOwnershipPct' || col === 'SecondaryOwnershipPct') {
        sqlType = sql.Decimal(5, 2);
        value = toDecimalOrNull(value);
      } else if (col === 'InitialContractLength') {
        sqlType = sql.Int;
      } else if (col === 'ActiveStatus') {
        sqlType = sql.Bit;
      } else if (col === 'GrossProfitTarget') {
        sqlType = sql.Numeric(16,0);
      } else if (col === 'UpdatedOn') {
        sqlType = sql.DateTime;
      } else if (col === 'PaymentMethodJson' || col === 'FinancialSystemsJson' || col === 'CollaborationToolsJson') {
        sqlType = sql.NVarChar(sql.MAX);
      }
      // …and so on for any other typed columns…
      req.input(col, sqlType, value);
    });

    // Run UPDATE and then re‐fetch the row
    const query = `
      UPDATE Client
      SET ${setClause}
      WHERE ClientID = @ClientID;

      SELECT * FROM Client WHERE ClientID = @ClientID;
    `;

    const result = await req.query(query);
    return result.recordset[0] || null;
  }

}



export default Client;
