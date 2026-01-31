// server/models/Benchmark.js
import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class Benchmark {
  static async getByClientId(clientId) {
    const pool = await poolPromise;
    try {
      const result = await pool
        .request()
        .input('ClientID', sql.UniqueIdentifier, clientId)
        .query(`
            SELECT 
  b.BenchmarkID, 
  b.ClientID, 
  b.ConsultantID, 
  b.Role, 
  b.LowRangeHours, 
  b.TargetHours, 
  b.HighRangeHours,
  b.WeeklyHours,
  b.CreatedOn, 
  b.UpdatedOn,
  b.BillRate,
  b.calculatedBenchmark,
  b.EffectiveDate,
  b.DistributionType,
  (c.FirstName + ' ' + c.LastName) AS ConsultantName

          FROM Benchmark b
          JOIN Consultant c ON b.ConsultantID = c.ConsultantID
          WHERE b.ClientID = @ClientID
        `);
      console.log('Fetched benchmarks:', result.recordset);
      return result.recordset;
    } catch (error) {
      console.error('Error fetching benchmarks:', error);
      throw error;
    }
  }

  static async create(data) {
    const pool = await poolPromise;
    console.log('Creating benchmark with data:', data);
    try {
      const result = await pool
        .request()
        .input('BenchmarkID', sql.UniqueIdentifier, data.BenchmarkID)
        .input('ClientID', sql.UniqueIdentifier, data.ClientID)
        .input('ConsultantID', sql.UniqueIdentifier, data.ConsultantID)
        .input('Role', sql.NVarChar, data.Role)
        .input('LowRangeHours', sql.Decimal(18, 2), data.LowRangeHours || 0)
        .input('TargetHours', sql.Decimal(18, 2), data.TargetHours || 0)
        .input('HighRangeHours', sql.Decimal(18, 2), data.HighRangeHours || 0)
        .input('CreatedOn', sql.DateTime, data.CreatedOn)
        .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
        .input('calculatedBenchmark', sql.Bit, data.calculatedBenchmark)
        .input('BillRate', sql.Decimal(18, 2), data.BillRate)    
.input('EffectiveDate', sql.DateTime, data.EffectiveDate)
        .input('DistributionType', sql.NVarChar(50), data.DistributionType || 'linear')         

        .query(`
          INSERT INTO Benchmark (
            BenchmarkID, ClientID, ConsultantID, Role, LowRangeHours, 
            TargetHours, HighRangeHours, CreatedOn, UpdatedOn, calculatedBenchmark,
    EffectiveDate, BillRate, DistributionType
          ) 
          VALUES (
            @BenchmarkID, @ClientID, @ConsultantID, @Role, @LowRangeHours, 
            @TargetHours, @HighRangeHours, @CreatedOn, @UpdatedOn, @calculatedBenchmark, @EffectiveDate, @BillRate, @DistributionType
          )
        `);
      console.log('Benchmark created successfully.');
      return data; // Return the created data
    } catch (error) {
      console.error('Error creating benchmark:', error);
      throw error;
    }
  }

  static async update(id, data) {
    console.log('Updating benchmark with ID:', id, 'and data:', data);
    const pool = await poolPromise;

    try {
      // 1. Fetch the existing record
      const existingResult = await pool
        .request()
        .input('BenchmarkID', sql.UniqueIdentifier, id)
        .query(`
          SELECT 
            b.BenchmarkID, 
            b.ClientID, 
            b.ConsultantID, 
            b.Role, 
            b.LowRangeHours, 
            b.TargetHours, 
            b.HighRangeHours,
            b.WeeklyHours,
            b.CreatedOn, 
            b.UpdatedOn,
            b.BillRate,
            b.calculatedBenchmark,
            b.EffectiveDate,
            b.DistributionType
          FROM Benchmark b
          WHERE b.BenchmarkID = @BenchmarkID
        `);

      if (existingResult.recordset.length === 0) {
        throw new Error('Benchmark not found, cannot update.');
      }

      const currentBenchmark = existingResult.recordset[0];

      // 2. Insert into BenchmarkHistory
      // Use "StartDate" from the front-end as the "EndDate" for the history record
      // If the front-end didn't send one, you can fallback to new Date() or handle the error
      const endDateValue = data.StartDate ? new Date(data.StartDate) : new Date();
      const now = new Date();

      // Prepare the history insert
      const historyId = uuidv4();
      await pool.request()
        .input('BenchmarkHistoryID', sql.UniqueIdentifier, historyId)
        .input('BenchmarkID', sql.UniqueIdentifier, currentBenchmark.BenchmarkID)
        .input('ClientID', sql.UniqueIdentifier, currentBenchmark.ClientID)
        .input('ConsultantID', sql.UniqueIdentifier, currentBenchmark.ConsultantID)
        .input('Role', sql.NVarChar(50), currentBenchmark.Role)
        .input('LowRangeHours', sql.Decimal(18, 2), currentBenchmark.LowRangeHours)
        .input('TargetHours', sql.Decimal(18, 2), currentBenchmark.TargetHours)
        .input('HighRangeHours', sql.Decimal(18, 2), currentBenchmark.HighRangeHours)
        .input('CreatedOn', sql.DateTime, now)
        .input('UpdatedOn', sql.DateTime, now)
        .input('EndDate', sql.DateTime, endDateValue)
        .input('calculatedBenchmark', sql.Bit, currentBenchmark.calculatedBenchmark)
        .input('EffectiveDate', sql.DateTime, currentBenchmark.EffectiveDate)
        .input('BillRate', sql.Decimal(18, 2), currentBenchmark.BillRate)
        .input('DistributionType', sql.NVarChar(50), currentBenchmark.DistributionType || 'linear')
        .query(`
          INSERT INTO BenchmarkHistory (
            BenchmarkHistoryID,
            BenchmarkID,
            ClientID,
            ConsultantID,
            Role,
            LowRangeHours,
            TargetHours,
            HighRangeHours,
            CreatedOn,
            UpdatedOn,
            EndDate,
            BillRate,
            calculatedBenchmark,
            EffectiveDate,
            DistributionType
          )
          VALUES (
            @BenchmarkHistoryID,
            @BenchmarkID,
            @ClientID,
            @ConsultantID,
            @Role,
            @LowRangeHours,
            @TargetHours,
            @HighRangeHours,
            @CreatedOn,
            @UpdatedOn,
            @EndDate,
            @BillRate,
            @calculatedBenchmark,
            @EffectiveDate,
            @DistributionType
          )
        `);

      console.log('Inserted benchmark history record with ID:', historyId);

      // 3. Perform the actual UPDATE on Benchmark
      await pool
        .request()
        .input('BenchmarkID', sql.UniqueIdentifier, id)
        .input('ConsultantID', sql.UniqueIdentifier, data.ConsultantID)
        .input('Role', sql.NVarChar(50), data.Role)
        .input('LowRangeHours', sql.Decimal(18, 2), data.LowRangeHours)
        .input('TargetHours', sql.Decimal(18, 2), data.TargetHours)
        .input('HighRangeHours', sql.Decimal(18, 2), data.HighRangeHours)
        .input('UpdatedOn', sql.DateTime, new Date())
        .input('calculatedBenchmark', sql.Bit, data.calculatedBenchmark)  
.input('EffectiveDate', sql.DateTime, data.EffectiveDate)
        .input('DistributionType', sql.NVarChar(50), data.DistributionType || 'linear')
.input('BillRate', sql.Decimal(18, 2), data.BillRate)     

        .query(`
          UPDATE Benchmark
          SET 
            ConsultantID = @ConsultantID,
            Role = @Role,
            LowRangeHours = @LowRangeHours,
            TargetHours = @TargetHours,
            HighRangeHours = @HighRangeHours,
            BillRate = @BillRate,
            calculatedBenchmark = @calculatedBenchmark,
            EffectiveDate = @EffectiveDate,
            DistributionType = @DistributionType,
            UpdatedOn = @UpdatedOn
          WHERE BenchmarkID = @BenchmarkID
        `);

      // 4. Fetch & return the updated record
      const updatedResult = await pool
        .request()
        .input('BenchmarkID', sql.UniqueIdentifier, id)
        .query(`
          SELECT 
            b.BenchmarkID, 
            b.ClientID, 
            b.ConsultantID, 
            b.Role, 
            b.LowRangeHours, 
            b.TargetHours, 
            b.HighRangeHours,
            b.WeeklyHours,
            b.CreatedOn,
            b.BillRate,
            b.calculatedBenchmark,
            b.EffectiveDate,
            b.DistributionType,
            b.UpdatedOn,
            (c.FirstName + ' ' + c.LastName) AS ConsultantName
          FROM Benchmark b
          JOIN Consultant c ON b.ConsultantID = c.ConsultantID
          WHERE b.BenchmarkID = @BenchmarkID
        `);

      if (updatedResult.recordset.length === 0) {
        throw new Error('Benchmark not found after update.');
      }

      console.log('Updated benchmark:', updatedResult.recordset[0]);
      return updatedResult.recordset[0]; // Return the updated record
    } catch (error) {
      console.error('Error during SQL query for updating benchmark:', error);
      throw error;
    }
  }

  static async delete(id) {
    const pool = await poolPromise;
    console.log('Deleting benchmark with ID:', id);

    try {
      // 1. Fetch the existing record
      const existingResult = await pool
        .request()
        .input('BenchmarkID', sql.UniqueIdentifier, id)
        .query(`
          SELECT 
            b.BenchmarkID, 
            b.ClientID, 
            b.ConsultantID, 
            b.Role, 
            b.LowRangeHours, 
            b.TargetHours, 
            b.HighRangeHours,
            b.WeeklyHours,
            b.CreatedOn, 
            b.UpdatedOn,
            b.BillRate,
            b.calculatedBenchmark,
            b.EffectiveDate,
            b.DistributionType
          FROM Benchmark b
          WHERE b.BenchmarkID = @BenchmarkID
        `);

      if (existingResult.recordset.length === 0) {
        console.warn('Benchmark not found, cannot delete:', id);
        return false;
      }

      const currentBenchmark = existingResult.recordset[0];

      // 2. Insert the record into BenchmarkHistory with EndDate = 01/01/2199
      const historyId = uuidv4();
      const endDateValue = new Date('2199-01-01'); // or '01/01/2199' as a string
      const now = new Date();
      
      await pool.request()
        .input('BenchmarkHistoryID', sql.UniqueIdentifier, historyId)
        .input('BenchmarkID', sql.UniqueIdentifier, currentBenchmark.BenchmarkID)
        .input('ClientID', sql.UniqueIdentifier, currentBenchmark.ClientID)
        .input('ConsultantID', sql.UniqueIdentifier, currentBenchmark.ConsultantID)
        .input('Role', sql.NVarChar(50), currentBenchmark.Role)
        .input('LowRangeHours', sql.Decimal(18, 2), currentBenchmark.LowRangeHours)
        .input('TargetHours', sql.Decimal(18, 2), currentBenchmark.TargetHours)
        .input('HighRangeHours', sql.Decimal(18, 2), currentBenchmark.HighRangeHours)
        .input('CreatedOn', sql.DateTime, now)
        .input('UpdatedOn', sql.DateTime, now)
        .input('EndDate', sql.DateTime, endDateValue)
        .input('BillRate', sql.Decimal(18, 2), currentBenchmark.BillRate)
        .input('DistributionType', sql.NVarChar(50), currentBenchmark.DistributionType || 'linear')
        .input('calculatedBenchmark', sql.Bit, currentBenchmark.calculatedBenchmark)
.input('EffectiveDate', sql.DateTime, currentBenchmark.EffectiveDate)
        .query(`
          INSERT INTO BenchmarkHistory (
            BenchmarkHistoryID,
            BenchmarkID,
            ClientID,
            ConsultantID,
            Role,
            LowRangeHours,
            TargetHours,
            HighRangeHours,
            CreatedOn,
            UpdatedOn,
            EndDate,
            BillRate,
            calculatedBenchmark,
            EffectiveDate,
            DistributionType
          )
          VALUES (
            @BenchmarkHistoryID,
            @BenchmarkID,
            @ClientID,
            @ConsultantID,
            @Role,
            @LowRangeHours,
            @TargetHours,
            @HighRangeHours,
            @CreatedOn,
            @UpdatedOn,
            @EndDate,
            @BillRate,
            @calculatedBenchmark,
            @EffectiveDate,
            @DistributionType
          )
        `);

      console.log('Inserted benchmark history record with ID:', historyId);

      // 3. Delete the record from the Benchmark table
      const deleteResult = await pool
        .request()
        .input('BenchmarkID', sql.UniqueIdentifier, id)
        .query(`
          DELETE FROM Benchmark
          WHERE BenchmarkID = @BenchmarkID
        `);

      // 4. Check if rows were affected
      const deletedCount = deleteResult.rowsAffected[0];
      return deletedCount > 0;
    } catch (error) {
      console.error('Error deleting benchmark:', error);
      throw error;
    }
  }

  static async getAll() {
    const pool = await poolPromise;
    try {
      const result = await pool.request().query(`
        SELECT 
          b.BenchmarkID,
          b.ClientID,
          b.ConsultantID,
          b.Role,
          b.DistributionType,
          c.ClientName,
          (cons.FirstName + ' ' + cons.LastName) AS ConsultantName
        FROM Benchmark b
        JOIN Client c ON b.ClientID = c.ClientID
        JOIN Consultant cons ON b.ConsultantID = cons.ConsultantID
        ORDER BY c.ClientName, b.Role, cons.LastName, cons.FirstName
      `);
      return result.recordset;
    } catch (error) {
      console.error('Error fetching all benchmarks:', error);
      throw error;
    }
  }

  static async bulkUpdateDistributionType(benchmarkIds, distributionType) {
    const pool = await poolPromise;
    try {
      const updates = [];
      for (const benchmarkId of benchmarkIds) {
        // Fetch existing benchmark for history
        const existingResult = await pool
          .request()
          .input('BenchmarkID', sql.UniqueIdentifier, benchmarkId)
          .query(`
            SELECT * FROM Benchmark WHERE BenchmarkID = @BenchmarkID
          `);

        if (existingResult.recordset.length === 0) continue;

        const current = existingResult.recordset[0];
        const now = new Date();

        // Insert into history
        const historyId = uuidv4();
        await pool.request()
          .input('BenchmarkHistoryID', sql.UniqueIdentifier, historyId)
          .input('BenchmarkID', sql.UniqueIdentifier, benchmarkId)
          .input('ClientID', sql.UniqueIdentifier, current.ClientID)
          .input('ConsultantID', sql.UniqueIdentifier, current.ConsultantID)
          .input('Role', sql.NVarChar, current.Role)
          .input('LowRangeHours', sql.Decimal(18, 2), current.LowRangeHours)
          .input('TargetHours', sql.Decimal(18, 2), current.TargetHours)
          .input('HighRangeHours', sql.Decimal(18, 2), current.HighRangeHours)
          .input('BillRate', sql.Decimal(18, 2), current.BillRate)
          .input('EffectiveDate', sql.DateTime, current.EffectiveDate)
          .input('EndDate', sql.DateTime, now)
          .input('calculatedBenchmark', sql.Bit, current.calculatedBenchmark)
          .input('DistributionType', sql.NVarChar(50), current.DistributionType)
          .query(`
            INSERT INTO BenchmarkHistory (
              BenchmarkHistoryID, BenchmarkID, ClientID, ConsultantID, Role,
              LowRangeHours, TargetHours, HighRangeHours, BillRate, EffectiveDate, EndDate,
              calculatedBenchmark, DistributionType
            ) VALUES (
              @BenchmarkHistoryID, @BenchmarkID, @ClientID, @ConsultantID, @Role,
              @LowRangeHours, @TargetHours, @HighRangeHours, @BillRate, @EffectiveDate, @EndDate,
              @calculatedBenchmark, @DistributionType
            )
          `);

        // Update benchmark
        await pool.request()
          .input('BenchmarkID', sql.UniqueIdentifier, benchmarkId)
          .input('DistributionType', sql.NVarChar(50), distributionType)
          .input('UpdatedOn', sql.DateTime, now)
          .query(`
            UPDATE Benchmark
            SET DistributionType = @DistributionType, UpdatedOn = @UpdatedOn
            WHERE BenchmarkID = @BenchmarkID
          `);

        updates.push(benchmarkId);
      }
      return { updated: updates.length, benchmarkIds: updates };
    } catch (error) {
      console.error('Error bulk updating distribution types:', error);
      throw error;
    }
  }
}

export default Benchmark;
