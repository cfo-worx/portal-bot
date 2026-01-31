// server/models/Task.js
import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class Task {
  // 1. Read Sequence and order by it
  static async getByProject(projectId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ProjectID', sql.UniqueIdentifier, projectId)
      .query(`
        SELECT
          t.*,
          STRING_AGG(c.ConsultantID, ',') AS AssignedConsultants
        FROM Tasks t
        LEFT JOIN TaskConsultants tc ON t.TaskID = tc.TaskID
        LEFT JOIN Consultant c ON tc.ConsultantID = c.ConsultantID
        WHERE t.ProjectID = @ProjectID
        GROUP BY
          t.TaskID, t.ProjectID, t.TaskName,
          t.DueDate, t.LoggedHours,
          t.CreatedDate, t.UpdatedDate,
          t.Sequence
        ORDER BY t.Sequence
      `);
    return result.recordset;
  }

  // 2. Compute next sequence in create()
  static async create(taskData) {
    const pool = await poolPromise;
    const newId = uuidv4();

    // compute next seq
    const seqResult = await pool.request()
      .input('ProjectID', sql.UniqueIdentifier, taskData.ProjectID)
      .query(`
        SELECT ISNULL(MAX(Sequence),0) + 1 AS NextSeq
        FROM Tasks
        WHERE ProjectID = @ProjectID
      `);
    const nextSeq = seqResult.recordset[0].NextSeq;

    await pool.request()
      .input('TaskID', sql.UniqueIdentifier, newId)
      .input('ProjectID', sql.UniqueIdentifier, taskData.ProjectID)
      .input('TaskName', sql.NVarChar(255), taskData.TaskName)
      .input('DueDate', sql.Date, taskData.DueDate)
      .input('LoggedHours', sql.Decimal(18,2), taskData.LoggedHours || 0)
      .input('Sequence', sql.Int, nextSeq)
      .query(`
        INSERT INTO Tasks (
          TaskID, ProjectID, TaskName, DueDate, LoggedHours,
          CreatedDate, UpdatedDate, Sequence
        ) VALUES (
          @TaskID, @ProjectID, @TaskName, @DueDate, @LoggedHours,
          GETDATE(), GETDATE(), @Sequence
        )
      `);

    return newId;
  }

  // 3. Allow updating Sequence via reorder
  static async update(id, updates) {
    const pool = await poolPromise;
    const request = pool.request().input('TaskID', sql.UniqueIdentifier, id);

    const setClauses = [];
    const validFields = ['TaskName','DueDate','LoggedHours','Sequence'];
    Object.entries(updates).forEach(([key, value]) => {
      if (validFields.includes(key)) {
        setClauses.push(`${key} = @${key}`);
        const type = key==='LoggedHours'
          ? sql.Decimal(18,2)
          : key==='Sequence'
            ? sql.Int
            : sql.NVarChar(255);
        request.input(key, type, value);
      }
    });
    if (!setClauses.length) throw new Error('No valid fields to update');
    setClauses.push('UpdatedDate = GETDATE()');

    await request.query(`
      UPDATE Tasks
      SET ${setClauses.join(', ')}
      WHERE TaskID = @TaskID
    `);
  }


  // server/models/Task.js
 // server/models/Task.js
static async reorder(projectId, taskIds) {
  const pool = await poolPromise;

  /*  ⬇️  Pass the type name right here                        */
  const tvp = new sql.Table('dbo.TaskOrderType');  // 👈 correct way
  tvp.columns.add('TaskID',   sql.UniqueIdentifier, { nullable: false });
  tvp.columns.add('Sequence', sql.Int,             { nullable: false });

  taskIds.forEach((id, i) => tvp.rows.add(id, i + 1));

  try {
    await pool.request()
      .input('ProjectID', sql.UniqueIdentifier, projectId)
      /* ⬇️  you just pass the table – no second arg necessary */
      .input('TaskOrder', tvp)
      .query(`
        UPDATE  t
        SET     t.Sequence = tvp.Sequence
        FROM    Tasks t
        INNER JOIN @TaskOrder AS tvp ON t.TaskID = tvp.TaskID
        WHERE   t.ProjectID = @ProjectID
      `);
  } catch (err) {
    console.error('Task reorder error:', err);
    throw new Error('Failed to reorder tasks: ' + err.message);
  }
}



static async assignConsultant(taskId, consultantId) {
  const pool = await poolPromise;
  await pool.request()
    .input('TaskID', sql.UniqueIdentifier, taskId)
    .input('ConsultantID', sql.UniqueIdentifier, consultantId)
    .query(`
      IF NOT EXISTS (
        SELECT 1 FROM TaskConsultants WHERE TaskID = @TaskID AND ConsultantID = @ConsultantID
      )
      BEGIN
        INSERT INTO TaskConsultants (TaskID, ConsultantID)
        VALUES (@TaskID, @ConsultantID)
      END
    `);
}

static async removeConsultant(taskId, consultantId) {
  const pool = await poolPromise;
  await pool.request()
    .input('TaskID', sql.UniqueIdentifier, taskId)
    .input('ConsultantID', sql.UniqueIdentifier, consultantId)
    .query(`
      DELETE FROM TaskConsultants
      WHERE TaskID = @TaskID AND ConsultantID = @ConsultantID
    `);
}


static async delete(taskId) {
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('TaskID', sql.UniqueIdentifier, taskId)
      .query(`DELETE FROM Tasks WHERE TaskID = @TaskID`);
  } catch (err) {
    console.error('Delete Task SQL error:', err);
    throw err;
  }
}



}

export default Task;
