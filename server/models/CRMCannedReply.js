import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class CRMCannedReply {
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query('SELECT * FROM CRMCannedReply WHERE IsActive = 1 ORDER BY Title');
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('CannedReplyID', sql.UniqueIdentifier, id)
      .query('SELECT * FROM CRMCannedReply WHERE CannedReplyID = @CannedReplyID');
    return result.recordset[0] || null;
  }

  static async getByCategory(category) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('Category', sql.NVarChar, category)
      .query('SELECT * FROM CRMCannedReply WHERE IsActive = 1 AND Category = @Category ORDER BY Title');
    return result.recordset;
  }

  static async create(data) {
    const pool = await poolPromise;
    const replyId = data.CannedReplyID || uuidv4();
    const result = await pool
      .request()
      .input('CannedReplyID', sql.UniqueIdentifier, replyId)
      .input('Title', sql.NVarChar, data.Title)
      .input('Content', sql.NVarChar(sql.MAX), data.Content)
      .input('Category', sql.NVarChar, data.Category || null)
      .input('IsActive', sql.Bit, data.IsActive !== undefined ? data.IsActive : 1)
      .query(`
        INSERT INTO CRMCannedReply (CannedReplyID, Title, Content, Category, IsActive)
        VALUES (@CannedReplyID, @Title, @Content, @Category, @IsActive);
        SELECT * FROM CRMCannedReply WHERE CannedReplyID = @CannedReplyID;
      `);
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('CannedReplyID', sql.UniqueIdentifier, id)
      .input('Title', sql.NVarChar, data.Title)
      .input('Content', sql.NVarChar(sql.MAX), data.Content)
      .input('Category', sql.NVarChar, data.Category || null)
      .input('IsActive', sql.Bit, data.IsActive)
      .query(`
        UPDATE CRMCannedReply
        SET Title = @Title,
            Content = @Content,
            Category = @Category,
            IsActive = @IsActive,
            UpdatedOn = GETDATE()
        WHERE CannedReplyID = @CannedReplyID;
        SELECT * FROM CRMCannedReply WHERE CannedReplyID = @CannedReplyID;
      `);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('CannedReplyID', sql.UniqueIdentifier, id)
      .query('UPDATE CRMCannedReply SET IsActive = 0 WHERE CannedReplyID = @CannedReplyID');
    return true;
  }
}

export default CRMCannedReply;

