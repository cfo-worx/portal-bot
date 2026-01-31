import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class LeadImportBatch {
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        b.*,
        u.FirstName + ' ' + u.LastName AS CreatedByName
      FROM LeadImportBatch b
      LEFT JOIN Users u ON b.CreatedBy = u.UserID
      ORDER BY b.CreatedOn DESC
    `);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('BatchID', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          b.*,
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM LeadImportBatch b
        LEFT JOIN Users u ON b.CreatedBy = u.UserID
        WHERE b.BatchID = @BatchID
      `);
    return result.recordset[0] || null;
  }

  static async create(data) {
    const pool = await poolPromise;
    const batchId = data.BatchID || uuidv4();
    
    const result = await pool
      .request()
      .input('BatchID', sql.UniqueIdentifier, batchId)
      .input('FileName', sql.NVarChar, data.FileName)
      .input('FilePath', sql.NVarChar, data.FilePath || null)
      .input('TotalRows', sql.Int, data.TotalRows || 0)
      .input('ImportedRows', sql.Int, data.ImportedRows || 0)
      .input('ErrorRows', sql.Int, data.ErrorRows || 0)
      .input('DuplicateRows', sql.Int, data.DuplicateRows || 0)
      .input('Status', sql.NVarChar, data.Status || 'Pending')
      .input('ErrorSummary', sql.NVarChar(sql.MAX), data.ErrorSummary || null)
      .input('CreatedBy', sql.UniqueIdentifier, data.CreatedBy || null)
      .query(`
        INSERT INTO LeadImportBatch (
          BatchID, FileName, FilePath, TotalRows, ImportedRows, ErrorRows, 
          DuplicateRows, Status, ErrorSummary, CreatedBy
        )
        VALUES (
          @BatchID, @FileName, @FilePath, @TotalRows, @ImportedRows, @ErrorRows,
          @DuplicateRows, @Status, @ErrorSummary, @CreatedBy
        );
        SELECT * FROM LeadImportBatch WHERE BatchID = @BatchID;
      `);
    
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    const updates = [];
    const request = pool.request().input('BatchID', sql.UniqueIdentifier, id);
    
    if (data.TotalRows !== undefined) {
      updates.push('TotalRows = @TotalRows');
      request.input('TotalRows', sql.Int, data.TotalRows);
    }
    
    if (data.ImportedRows !== undefined) {
      updates.push('ImportedRows = @ImportedRows');
      request.input('ImportedRows', sql.Int, data.ImportedRows);
    }
    
    if (data.ErrorRows !== undefined) {
      updates.push('ErrorRows = @ErrorRows');
      request.input('ErrorRows', sql.Int, data.ErrorRows);
    }
    
    if (data.DuplicateRows !== undefined) {
      updates.push('DuplicateRows = @DuplicateRows');
      request.input('DuplicateRows', sql.Int, data.DuplicateRows);
    }
    
    if (data.Status !== undefined) {
      updates.push('Status = @Status');
      request.input('Status', sql.NVarChar, data.Status);
    }
    
    if (data.ErrorSummary !== undefined) {
      updates.push('ErrorSummary = @ErrorSummary');
      request.input('ErrorSummary', sql.NVarChar(sql.MAX), data.ErrorSummary || null);
    }
    
    if (data.CompletedOn !== undefined) {
      updates.push('CompletedOn = @CompletedOn');
      request.input('CompletedOn', sql.DateTime2, data.CompletedOn || null);
    }
    
    if (updates.length === 0) {
      return await this.getById(id);
    }
    
    const query = `UPDATE LeadImportBatch SET ${updates.join(', ')} WHERE BatchID = @BatchID; SELECT * FROM LeadImportBatch WHERE BatchID = @BatchID;`;
    const result = await request.query(query);
    return result.recordset[0];
  }

  static async getErrors(batchId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('BatchID', sql.UniqueIdentifier, batchId)
      .query(`
        SELECT * FROM LeadImportError
        WHERE BatchID = @BatchID
        ORDER BY RowNumber
      `);
    return result.recordset;
  }
}

export default LeadImportBatch;

