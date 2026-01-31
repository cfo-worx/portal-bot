// server/models/SupportRequest.js
import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

class SupportRequest {
  static async getByProject(projectId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ProjectID', sql.UniqueIdentifier, projectId)
      .query(`
        SELECT 
          sr.*, 
          p.ProjectName,
          t.TaskName,
          st.SubTaskName,
          c.ClientName
        FROM SupportRequests sr
        JOIN Projects p ON sr.ProjectID = p.ProjectID
        JOIN Tasks t ON sr.TaskID = t.TaskID
        JOIN Subtasks st ON sr.SubTaskID = st.SubTaskID
        JOIN Client c ON p.ClientID = c.ClientID
        WHERE sr.ProjectID = @ProjectID
      `);
    return result.recordset;
  }

  static async create(requestData) {
    const pool = await poolPromise;
    const newId = uuidv4();
  
    // Insert into SQL first
    await pool.request()
      .input('RequestID', sql.UniqueIdentifier, newId)
      .input('ProjectID', sql.UniqueIdentifier, requestData.ProjectID)
      .input('TaskID', sql.UniqueIdentifier, requestData.TaskID)
      .input('SubTaskID', sql.UniqueIdentifier, requestData.SubTaskID)
      .input('Question', sql.NVarChar(sql.MAX), requestData.Question)
      .input('Status', sql.NVarChar(50), requestData.Status || 'Received')
      .query(`
        INSERT INTO SupportRequests (
          RequestID, ProjectID, TaskID, SubTaskID, Question, Status, CreatedDate, UpdatedDate
        ) VALUES (
          @RequestID, @ProjectID, @TaskID, @SubTaskID, @Question, @Status, GETDATE(), GETDATE()
        )
      `);
  
    // Get full context for the webhook call
    const contextQuery = await pool.request()
      .input('RequestID', sql.UniqueIdentifier, newId)
      .query(`
        SELECT 
          sr.RequestID,
          sr.Question,
          p.ProjectName,
          c.ClientName,
          t.TaskName,
          st.SubTaskName
        FROM SupportRequests sr
        JOIN Projects p ON sr.ProjectID = p.ProjectID
        JOIN Client c ON p.ClientID = c.ClientID
        JOIN Tasks t ON sr.TaskID = t.TaskID
        JOIN Subtasks st ON sr.SubTaskID = st.SubTaskID
        WHERE sr.RequestID = @RequestID
      `);
  
    const row = contextQuery.recordset[0];
  
    // Build payload matching Power Automate's schema
    const payload = {
      supportRequestId: newId,
      projectName: row.ProjectName,
      clientName: row.ClientName,
      taskName: row.TaskName,
      subTaskName: row.SubTaskName,
      clientQuestion: row.Question,
      consultantEmails: requestData.consultantEmails || []
    };
  
    // Trigger the webhook
    try {
      await axios.post(
        'https://prod-56.westus.logic.azure.com:443/workflows/b5d251d4c8cd4731aa08514808fbf47c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=nr4GQA7Ht9OEbOxf2UPV0ObQp_WEP31tLVXwezDNhAw',
        payload
      );
      console.log('✅ Power Automate webhook triggered.');
    } catch (err) {
      console.error('❌ Failed to trigger Power Automate:', err.message);
    }
  
    return newId;
  }

  static async updateStatus(id, newStatus) {
    const pool = await poolPromise;
    await pool.request()
      .input('RequestID', sql.UniqueIdentifier, id)
      .input('Status', sql.NVarChar(50), newStatus)
      .query(`
        UPDATE SupportRequests
        SET Status = @Status, UpdatedDate = GETDATE()
        WHERE RequestID = @RequestID
      `);
  }
}

export default SupportRequest;