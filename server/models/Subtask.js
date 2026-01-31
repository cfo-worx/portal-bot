// server/models/Subtask.js
import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class Subtask {
  static async getByTask(taskId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('TaskID', sql.UniqueIdentifier, taskId)
      .query('SELECT * FROM Subtasks WHERE TaskID = @TaskID');
    return result.recordset;
  }

  static async create(subtaskData) {
    const pool = await poolPromise;
    const newId = uuidv4();
    
    await pool.request()
      .input('SubTaskID', sql.UniqueIdentifier, newId)
      .input('TaskID', sql.UniqueIdentifier, subtaskData.TaskID)
      .input('SubTaskName', sql.NVarChar(255), subtaskData.SubTaskName)
      .input('PlannedHours', sql.Decimal(18,2), subtaskData.PlannedHours || 0)
      .input('DueDate', sql.Date, subtaskData.DueDate)
      .input('Status', sql.NVarChar(50), subtaskData.Status || 'NotStarted')
      .query(`
        INSERT INTO Subtasks (
          SubTaskID, TaskID, SubTaskName, PlannedHours, DueDate, Status, CreatedDate, UpdatedDate
        ) VALUES (
          @SubTaskID, @TaskID, @SubTaskName, @PlannedHours, @DueDate, @Status, GETDATE(), GETDATE()
        )
      `);

    return newId;
  }

static async update(id, updates) {
  const pool = await poolPromise;
  const request = pool.request()
    .input('SubTaskID', sql.UniqueIdentifier, id);

  const setClauses = [];
  const validFields = ['SubTaskName', 'PlannedHours', 'DueDate', 'Status'];

  // Build SET clause & bind inputs
  Object.entries(updates).forEach(([key, value]) => {
    if (validFields.includes(key)) {
      setClauses.push(`${key} = @${key}`);
      const type =
        key === 'PlannedHours' ? sql.Decimal(18, 2) :
        key === 'Status'       ? sql.NVarChar(50)  :
                                 sql.NVarChar(255);
      request.input(key, type, value);
    }
  });

  if (setClauses.length === 0) {
    throw new Error('No valid fields to update');
  }

  setClauses.push('UpdatedDate = GETDATE()');

  // 1) Update the subtask record
  await request.query(`
    UPDATE Subtasks
    SET ${setClauses.join(', ')}
    WHERE SubTaskID = @SubTaskID
  `);

  // 2) If the status was updated, check if we need to update the project status
if (updates.Status) {
  const { recordset: subtaskRec } = await pool.request()
    .input('SubTaskID', sql.UniqueIdentifier, id)
    .query(`
      SELECT t.ProjectID
      FROM Subtasks s
      INNER JOIN Tasks t ON s.TaskID = t.TaskID
      WHERE s.SubTaskID = @SubTaskID
    `);

  const projectId = subtaskRec[0]?.ProjectID;

  if (projectId) {
    const { recordset: countRec } = await pool.request()
      .input('ProjectID', sql.UniqueIdentifier, projectId)
      .query(`
        SELECT COUNT(*) AS OpenCount
        FROM Subtasks s
        INNER JOIN Tasks t ON s.TaskID = t.TaskID
        WHERE t.ProjectID = @ProjectID
          AND s.Status <> 'Completed'
      `);

    const openCount = countRec[0]?.OpenCount || 0;

    // Now check the *existing* project status first
    const { recordset: projectStatusRec } = await pool.request()
      .input('ProjectID', sql.UniqueIdentifier, projectId)
      .query(`
        SELECT Status FROM Projects WHERE ProjectID = @ProjectID
      `);

    const currentStatus = projectStatusRec[0]?.Status;
    const shouldBeStatus = openCount === 0 ? 'Completed' : 'Active';

    // Only update if status needs to change
    if (currentStatus !== shouldBeStatus) {
      await pool.request()
        .input('ProjectID', sql.UniqueIdentifier, projectId)
        .input('NewStatus', sql.NVarChar(50), shouldBeStatus)
        .query(`
          UPDATE Projects
          SET Status = @NewStatus,
              UpdatedDate = GETDATE()
          WHERE ProjectID = @ProjectID
        `);
    }
  }
}}

  static async delete(id) {
    const pool = await poolPromise;
    await pool.request()
      .input('SubTaskID', sql.UniqueIdentifier, id)
      .query('DELETE FROM Subtasks WHERE SubTaskID = @SubTaskID');
  }
}

export default Subtask;