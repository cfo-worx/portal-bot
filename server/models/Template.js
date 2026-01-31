// server/models/Template.js
import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 }     from 'uuid';

class Template {

  /* ─────────────────────────────────── */
  /* Create template from live project   */
  /* POST /projects/:id/save-as-template */
  /* ─────────────────────────────────── */
  static async saveFromProject(projectId, templateName) {
    const pool = await poolPromise;
    const tx   = new sql.Transaction(pool);
    await tx.begin();

    try {
      /* 1) Grab project, tasks, subtasks */
      const projRes = await tx.request()
        .input('PID', sql.UniqueIdentifier, projectId)
        .query('SELECT TOP 1 ProjectName FROM Projects WHERE ProjectID = @PID');

      if (!projRes.recordset.length) throw new Error('Project not found');

      const baseName = templateName || projRes.recordset[0].ProjectName;

      /* 2) Insert TemplateProjects */
      const templateID = uuidv4();
      await tx.request()
        .input('TemplateID',   sql.UniqueIdentifier, templateID)
        .input('TemplateName', sql.NVarChar(255),   baseName)
        .query(`
          INSERT INTO TemplateProjects (TemplateID, TemplateName)
          VALUES (@TemplateID, @TemplateName)
        `);

      /* 3) Copy Tasks */
      const tasksRes = await tx.request()
        .input('PID', sql.UniqueIdentifier, projectId)
        .query(`SELECT * FROM Tasks WHERE ProjectID = @PID`);

      for (const t of tasksRes.recordset) {
        const newTTID = uuidv4();
        await tx.request()
          .input('TemplateTaskID', sql.UniqueIdentifier, newTTID)
          .input('TemplateID',     sql.UniqueIdentifier, templateID)
          .input('TaskName',       sql.NVarChar(255),    t.TaskName)
          .input('Sequence',       sql.Int,              t.Sequence)
          .input('PlannedHours',   sql.Decimal(18,2),    t.LoggedHours)  // optional – use Logged or 0
          .query(`
            INSERT INTO TemplateTasks
              (TemplateTaskID, TemplateID, TaskName, Sequence, PlannedHours)
            VALUES
              (@TemplateTaskID, @TemplateID, @TaskName, @Sequence, @PlannedHours)
          `);

        /* 4) Copy SubTasks */
        const subsRes = await tx.request()
          .input('TID', sql.UniqueIdentifier, t.TaskID)
          .query('SELECT * FROM SubTasks WHERE TaskID = @TID');

        for (const st of subsRes.recordset) {
          await tx.request()
            .input('TemplateSubTaskID', sql.UniqueIdentifier, uuidv4())
            .input('TemplateTaskID',    sql.UniqueIdentifier, newTTID)
            .input('SubTaskName',       sql.NVarChar(255), st.SubTaskName)
            .input('PlannedHours',      sql.Decimal(18,2), st.PlannedHours)
            .input('Status',            sql.NVarChar(50),  'NotStarted')
            .query(`
              INSERT INTO TemplateSubTasks
                (TemplateSubTaskID, TemplateTaskID, SubTaskName, PlannedHours, Status)
              VALUES
                (@TemplateSubTaskID, @TemplateTaskID, @SubTaskName, @PlannedHours, @Status)
            `);
        }
      }

      await tx.commit();
      return templateID;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  /* ─────────────────────────────────── */
  /* Simple list with nested tasks       */
  /* GET /templates (flat results)       */
  /* ─────────────────────────────────── */
  static async getAllWithDetails() {
    const pool   = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        tp.TemplateID,
        tp.TemplateName,
        tpt.TemplateTaskID,
        tpt.TaskName,
        tpt.Sequence,
        tst.TemplateSubTaskID,
        tst.SubTaskName,
        tst.PlannedHours,
        tst.Status
      FROM TemplateProjects tp
      LEFT JOIN TemplateTasks    tpt ON tp.TemplateID     = tpt.TemplateID
      LEFT JOIN TemplateSubTasks tst ON tpt.TemplateTaskID = tst.TemplateTaskID
      ORDER BY tp.CreatedDate DESC, tpt.Sequence
    `);
    return result.recordset;
  }

  /* ─────────────────────────────────── */
  /* Clone template → live project       */
  /* POST /templates/:id/clone           */
  /* ─────────────────────────────────── */
  static async cloneToProject(templateID, { ProjectName, ClientID, StartDate, Status }) {
    const pool = await poolPromise;
    const tx   = new sql.Transaction(pool);
    await tx.begin();

    try {
      const newProjectID = uuidv4();
      const DEFAULT_DUE_DATE = '1900-01-01'; // SQL-safe fallback date

      /* 1) insert new project */
      await tx.request()
        .input('ProjectID',   sql.UniqueIdentifier, newProjectID)
        .input('ProjectName', sql.NVarChar(255),   ProjectName)
        .input('ClientID',    sql.UniqueIdentifier, ClientID)
        .input('StartDate',   sql.Date,             StartDate)
        .input('Status',      sql.NVarChar(50),     Status)
        .query(`
          INSERT INTO Projects
            (ProjectID, ProjectName, ClientID, StartDate, Status, CreatedDate, UpdatedDate)
          VALUES
            (@ProjectID, @ProjectName, @ClientID, @StartDate, @Status, GETDATE(), GETDATE())
        `);

      /* 2) copy each template task */
      const tasksRes = await tx.request()
        .input('TID', sql.UniqueIdentifier, templateID)
        .query('SELECT * FROM TemplateTasks WHERE TemplateID = @TID');

      for (const t of tasksRes.recordset) {
        const newTaskID = uuidv4();
        await tx.request()
  .input('TaskID',      sql.UniqueIdentifier, newTaskID)
  .input('ProjectID',   sql.UniqueIdentifier, newProjectID)
  .input('TaskName',    sql.NVarChar(255),   t.TaskName)
  .input('Sequence',    sql.Int,             t.Sequence)
  .input('DueDate',     sql.Date,            DEFAULT_DUE_DATE)
  .query(`
    INSERT INTO Tasks
      (TaskID, ProjectID, TaskName, Sequence, DueDate, CreatedDate, UpdatedDate)
    VALUES
      (@TaskID, @ProjectID, @TaskName, @Sequence, @DueDate, GETDATE(), GETDATE())
  `);

        /* copy subtasks */
        const subsRes = await tx.request()
          .input('TemplateTaskID', sql.UniqueIdentifier, t.TemplateTaskID)
          .query('SELECT * FROM TemplateSubTasks WHERE TemplateTaskID = @TemplateTaskID');

        for (const st of subsRes.recordset) {
        await tx.request()
  .input('SubTaskID',   sql.UniqueIdentifier, uuidv4())
  .input('TaskID',      sql.UniqueIdentifier, newTaskID)
  .input('SubTaskName', sql.NVarChar(255),   st.SubTaskName)
  .input('PlannedHours',sql.Decimal(18,2),   st.PlannedHours)
  .input('Status',      sql.NVarChar(50),    'NotStarted')
  .input('DueDate',     sql.Date,            DEFAULT_DUE_DATE)
  .query(`
    INSERT INTO SubTasks
      (SubTaskID, TaskID, SubTaskName, PlannedHours, Status, DueDate,
       CreatedDate, UpdatedDate)
    VALUES
      (@SubTaskID, @TaskID, @SubTaskName, @PlannedHours, @Status, @DueDate,
       GETDATE(), GETDATE())
  `);

        }
      }

      await tx.commit();
      return newProjectID;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }


  static async delete(id) {
  const pool = await poolPromise;
  const tx   = new sql.Transaction(pool);
  await tx.begin();
  try {
    await tx.request().input('ID',sql.UniqueIdentifier,id)
      .query('DELETE FROM TemplateSubTasks WHERE TemplateTaskID IN (SELECT TemplateTaskID FROM TemplateTasks WHERE TemplateID=@ID)');
    await tx.request().input('ID',sql.UniqueIdentifier,id)
      .query('DELETE FROM TemplateTasks WHERE TemplateID=@ID');
    await tx.request().input('ID',sql.UniqueIdentifier,id)
      .query('DELETE FROM TemplateProjects WHERE TemplateID=@ID');
    await tx.commit();
  } catch(e){await tx.rollback(); throw e;}
}



}




export default Template;
