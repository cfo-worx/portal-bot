import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class CRMDealAttachment {
  static async getByDeal(dealId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('DealID', sql.UniqueIdentifier, dealId)
      .query(`
        SELECT 
          a.*,
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM CRMDealAttachment a
        LEFT JOIN Users u ON a.CreatedBy = u.UserID
        WHERE a.DealID = @DealID
        ORDER BY a.CreatedOn DESC
      `);
    return result.recordset;
  }

  static async create(data) {
    const pool = await poolPromise;
    const attachmentId = data.AttachmentID || uuidv4();
    const result = await pool
      .request()
      .input('AttachmentID', sql.UniqueIdentifier, attachmentId)
      .input('DealID', sql.UniqueIdentifier, data.DealID)
      .input('FilePath', sql.NVarChar(500), data.FilePath)
      .input('FileName', sql.NVarChar(255), data.FileName)
      .input('FileSize', sql.BigInt, data.FileSize || null)
      .input('FileType', sql.NVarChar(50), data.FileType || null)
      .input('MimeType', sql.NVarChar(100), data.MimeType || null)
      .input('CreatedBy', sql.UniqueIdentifier, data.CreatedBy || null)
      .query(`
        INSERT INTO CRMDealAttachment (
          AttachmentID, DealID, FilePath, FileName, FileSize, FileType, MimeType, CreatedBy
        )
        VALUES (
          @AttachmentID, @DealID, @FilePath, @FileName, @FileSize, @FileType, @MimeType, @CreatedBy
        );
        SELECT 
          a.*,
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM CRMDealAttachment a
        LEFT JOIN Users u ON a.CreatedBy = u.UserID
        WHERE a.AttachmentID = @AttachmentID;
      `);
    return result.recordset[0];
  }

  static async delete(attachmentId) {
    const pool = await poolPromise;
    // Get the attachment record first to get file path
    const attachment = await pool
      .request()
      .input('AttachmentID', sql.UniqueIdentifier, attachmentId)
      .query('SELECT * FROM CRMDealAttachment WHERE AttachmentID = @AttachmentID');
    
    if (attachment.recordset.length === 0) {
      throw new Error('Attachment not found');
    }

    // Delete from database
    await pool
      .request()
      .input('AttachmentID', sql.UniqueIdentifier, attachmentId)
      .query('DELETE FROM CRMDealAttachment WHERE AttachmentID = @AttachmentID');

    return attachment.recordset[0];
  }

  static async getById(attachmentId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('AttachmentID', sql.UniqueIdentifier, attachmentId)
      .query(`
        SELECT 
          a.*,
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM CRMDealAttachment a
        LEFT JOIN Users u ON a.CreatedBy = u.UserID
        WHERE a.AttachmentID = @AttachmentID
      `);
    return result.recordset[0] || null;
  }
}

export default CRMDealAttachment;

