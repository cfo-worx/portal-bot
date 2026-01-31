import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class ContractPDF {
  static async getByContractId(contractId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ContractID', sql.UniqueIdentifier, contractId)
      .query('SELECT * FROM ContractPDF WHERE ContractID = @ContractID ORDER BY CreatedOn DESC');
    return result.recordset;
  }

  static async create(data) {
    const pool = await poolPromise;
    const pdfId = data.PDFID || uuidv4();
    const result = await pool
      .request()
      .input('PDFID', sql.UniqueIdentifier, pdfId)
      .input('ContractID', sql.UniqueIdentifier, data.ContractID)
      .input('FilePath', sql.NVarChar(500), data.FilePath)
      .input('FileName', sql.NVarChar(255), data.FileName)
      .input('FileSize', sql.BigInt, data.FileSize || null)
      .input('CreatedOn', sql.DateTime, data.CreatedOn || new Date())
      .query(`
        INSERT INTO ContractPDF (PDFID, ContractID, FilePath, FileName, FileSize, CreatedOn)
        VALUES (@PDFID, @ContractID, @FilePath, @FileName, @FileSize, @CreatedOn);
        SELECT * FROM ContractPDF WHERE PDFID = @PDFID;
      `);
    return result.recordset[0];
  }

  static async delete(pdfId) {
    const pool = await poolPromise;
    // Get the PDF record first to get file path
    const pdf = await pool
      .request()
      .input('PDFID', sql.UniqueIdentifier, pdfId)
      .query('SELECT * FROM ContractPDF WHERE PDFID = @PDFID');
    
    if (pdf.recordset.length === 0) {
      throw new Error('PDF not found');
    }

    // Delete from database
    await pool
      .request()
      .input('PDFID', sql.UniqueIdentifier, pdfId)
      .query('DELETE FROM ContractPDF WHERE PDFID = @PDFID');

    return pdf.recordset[0];
  }

  static async getById(pdfId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('PDFID', sql.UniqueIdentifier, pdfId)
      .query('SELECT * FROM ContractPDF WHERE PDFID = @PDFID');
    return result.recordset[0] || null;
  }
}

export default ContractPDF;

