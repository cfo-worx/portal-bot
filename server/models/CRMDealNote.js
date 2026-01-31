import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class CRMDealNote {
  static async getByDeal(dealId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('DealID', sql.UniqueIdentifier, dealId)
      .query(`
        SELECT 
          n.*,
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM CRMDealNote n
        LEFT JOIN Users u ON n.CreatedBy = u.UserID
        WHERE n.DealID = @DealID
        ORDER BY n.CreatedOn DESC
      `);
    return result.recordset;
  }

  static async create(data) {
    const pool = await poolPromise;
    const noteId = data.NoteID || uuidv4();
    const result = await pool
      .request()
      .input('NoteID', sql.UniqueIdentifier, noteId)
      .input('DealID', sql.UniqueIdentifier, data.DealID)
      .input('NoteText', sql.NVarChar(sql.MAX), data.NoteText)
      .input('CreatedBy', sql.UniqueIdentifier, data.CreatedBy || null)
      .query(`
        INSERT INTO CRMDealNote (NoteID, DealID, NoteText, CreatedBy)
        VALUES (@NoteID, @DealID, @NoteText, @CreatedBy);
        SELECT * FROM CRMDealNote WHERE NoteID = @NoteID;
      `);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('NoteID', sql.UniqueIdentifier, id)
      .query('DELETE FROM CRMDealNote WHERE NoteID = @NoteID');
    return true;
  }
}

export default CRMDealNote;

