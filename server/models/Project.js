// server/models/Project.js
import dayjs from 'dayjs';
import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class Project {
  // Get all projects with nested tasks and subtasks
  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ProjectID', sql.UniqueIdentifier, id)
      .query(`
  SELECT 
    p.ProjectID,
    p.ProjectName,
    p.ClientID,
    CONVERT(varchar, p.StartDate, 23) AS StartDate,
    p.Status,
    p.Recurring,
    p.RecurrenceType,
    p.RecurrenceIndex,
    p.IntervalValue,
    p.PeriodCount,
    p.ParentProjectID,
    t.TaskID,
    t.TaskName,
    CONVERT(varchar, t.DueDate, 23) AS TaskDueDate,
    t.LoggedHours,
    t.Sequence,
    st.SubTaskID,
    st.SubTaskName,
    st.PlannedHours,
    CONVERT(varchar, st.DueDate, 23) AS SubTaskDueDate,
    st.Status AS SubTaskStatus,
    c.ClientName,
    STRING_AGG(CONCAT(con.FirstName, ' ', con.LastName), ', ') AS Consultants
  FROM Projects p
  LEFT JOIN Tasks t ON p.ProjectID = t.ProjectID
  LEFT JOIN Subtasks st ON t.TaskID = st.TaskID
  LEFT JOIN ProjectConsultants pc ON p.ProjectID = pc.ProjectID
  LEFT JOIN Consultant con ON pc.ConsultantID = con.ConsultantID
  JOIN Client c ON p.ClientID = c.ClientID
  WHERE p.ProjectID = @ProjectID
  GROUP BY 
    p.ProjectID,
    p.ProjectName,
    p.ClientID,
    p.StartDate,
    p.Status,
    p.Recurring,
    p.RecurrenceType,
    p.RecurrenceIndex,
    p.IntervalValue,
    p.PeriodCount,
    p.ParentProjectID,
    t.TaskID,
    t.TaskName,
    t.DueDate,
    t.LoggedHours,
    t.Sequence,
    st.SubTaskID,
    st.SubTaskName,
    st.PlannedHours,
    st.DueDate,
    st.Status,
    c.ClientName
  ORDER BY t.Sequence
`);

    return result.recordset[0] || null;
  }

// Update project fields
  static async update(id, updates) {
    const pool = await poolPromise;
    const request = pool.request()
      .input('ProjectID', sql.UniqueIdentifier, id);

    // Format date field
    if (updates.StartDate) {
      updates.StartDate = new Date(updates.StartDate)
                           .toISOString()
                           .split('T')[0];
    }

    const setClauses = [];

    Object.entries(updates).forEach(([key, value]) => {
      setClauses.push(`${key} = @${key}`);

      // *** Treat IntervalValue and PeriodCount as INT ***
      const paramType =
        key === 'StartDate'       ? sql.Date       :
        key === 'Recurring'       ? sql.Bit        :
        key === 'IntervalValue'   ? sql.Int        :
        key === 'PeriodCount'     ? sql.Int        :
        sql.NVarChar(255);

      request.input(key, paramType, value);
    });

    // Always update UpdatedDate
    setClauses.push('UpdatedDate = GETDATE()');

    const query = `
      UPDATE Projects
      SET ${setClauses.join(', ')}
      WHERE ProjectID = @ProjectID
    `;

    await request.query(query);
  }


// Create new project
static async create(projectData) {
  const pool = await poolPromise;
  const newId = uuidv4(); 

  const formattedDate = projectData.StartDate 
    ? new Date(projectData.StartDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  
  await pool.request()
    .input('ProjectID', sql.UniqueIdentifier, newId)
    .input('ProjectName', sql.NVarChar(255), projectData.ProjectName)
    .input('ClientID', sql.UniqueIdentifier, projectData.ClientID)
    .input('StartDate', sql.Date, formattedDate)
    .input('Status', sql.NVarChar(50), projectData.Status)
    .input('Recurring',   sql.Bit,              projectData.Recurring ? 1 : 0)
    .query(`
      INSERT INTO Projects (
        ProjectID, ProjectName, ClientID, StartDate, Status, Recurring, CreatedDate, UpdatedDate
      ) VALUES (
        @ProjectID, @ProjectName, @ClientID, @StartDate, @Status, @Recurring, GETDATE(), GETDATE()
      )
    `);

  return newId;
}

// Delete project (and all dependent rows)
static async delete(id) {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);
    await req
      .input('ProjectID', sql.UniqueIdentifier, id)
      .query(`
        SET NOCOUNT ON;

        -- 1) SupportRequests tied to Subtasks
        DELETE sr
        FROM SupportRequests sr
        WHERE sr.SubTaskID IN (
          SELECT s.SubTaskID
          FROM Subtasks s
          WHERE s.TaskID IN (
            SELECT t.TaskID
            FROM Tasks t
            WHERE t.ProjectID = @ProjectID
          )
        );

        -- 2) Subtasks
        DELETE s
        FROM Subtasks s
        WHERE s.TaskID IN (
          SELECT t.TaskID
          FROM Tasks t
          WHERE t.ProjectID = @ProjectID
        );

        -- 3) TaskConsultants
        DELETE tc
        FROM TaskConsultants tc
        WHERE tc.TaskID IN (
          SELECT t.TaskID
          FROM Tasks t
          WHERE t.ProjectID = @ProjectID
        );

        -- 4) SupportRequests tied directly to Tasks
        DELETE sr
        FROM SupportRequests sr
        WHERE sr.TaskID IN (
          SELECT t.TaskID
          FROM Tasks t
          WHERE t.ProjectID = @ProjectID
        );

        -- 5) Tasks
        DELETE t
        FROM Tasks t
        WHERE t.ProjectID = @ProjectID;

        -- 6) ProjectConsultants
        DELETE pc
        FROM ProjectConsultants pc
        WHERE pc.ProjectID = @ProjectID;

        -- 7) SupportRequests tied directly to Project
        DELETE sr
        FROM SupportRequests sr
        WHERE sr.ProjectID = @ProjectID;

        -- 8) Finally, the Project
        DELETE p
        FROM Projects p
        WHERE p.ProjectID = @ProjectID;
      `);

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}



  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ProjectID', sql.UniqueIdentifier, id)
     .query(`
  SELECT 
    p.ProjectID,
    p.ProjectName,
    p.ClientID,
    CONVERT(varchar, p.StartDate, 23) AS StartDate,
    p.Status,
    p.Recurring,
    p.RecurrenceType,
    p.RecurrenceIndex,
    p.IntervalValue,
    p.PeriodCount,
    p.ParentProjectID,
    t.TaskID,
    t.TaskName,
    CONVERT(varchar, t.DueDate, 23) AS TaskDueDate,
    t.LoggedHours,
    st.SubTaskID,
    st.SubTaskName,
    st.PlannedHours,
    CONVERT(varchar, st.DueDate, 23) AS SubTaskDueDate,
    st.Status AS SubTaskStatus,
    c.ClientName,
    STRING_AGG(CONVERT(varchar(36), tc.ConsultantID), ', ') AS AssignedConsultants
  FROM Projects p
  LEFT JOIN Tasks t ON p.ProjectID = t.ProjectID
  LEFT JOIN Subtasks st ON t.TaskID = st.TaskID
  LEFT JOIN TaskConsultants tc ON t.TaskID = tc.TaskID
  JOIN Client c ON p.ClientID = c.ClientID
  WHERE p.ProjectID = @ProjectID
  GROUP BY 
    p.ProjectID,
    p.ProjectName,
    p.ClientID,
    p.StartDate,
    p.Status,
    p.Recurring,
    p.RecurrenceType,
    p.RecurrenceIndex,
    p.IntervalValue,
    p.PeriodCount,
    p.ParentProjectID,
    t.TaskID,
    t.TaskName,
    t.DueDate,
    t.LoggedHours,
    st.SubTaskID,
    st.SubTaskName,
    st.PlannedHours,
    st.DueDate,
    st.Status,
    c.ClientName
`);

    return result.recordset;
  }



  static async getAllWithDetails() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
  SELECT 
    p.ProjectID,
    p.CreatedDate,
    p.ProjectName,
    p.ClientID,
    CONVERT(varchar, p.StartDate, 23) AS StartDate,
    p.Status,
    p.Recurring,
    p.RecurrenceIndex,
    p.RecurrenceType,
    p.IntervalValue,
    p.PeriodCount,
    p.ParentProjectID,
    t.TaskID,
    t.TaskName,
    CONVERT(varchar, t.DueDate, 23) AS TaskDueDate,
    t.LoggedHours,
    t.Sequence,
    st.SubTaskID,
    st.SubTaskName,
    st.PlannedHours,
    CONVERT(varchar, st.DueDate, 23) AS SubTaskDueDate,
    st.Status AS SubTaskStatus,
    c.ClientName,
    c.ActiveStatus,
    ISNULL(tl.TotalLoggedHours, 0) AS ProjectLoggedHours,
    STRING_AGG(CONVERT(varchar(36), tc.ConsultantID), ', ') AS AssignedConsultants
  FROM Projects p
  LEFT JOIN Tasks t ON p.ProjectID = t.ProjectID
  LEFT JOIN Subtasks st ON t.TaskID = st.TaskID
  LEFT JOIN TaskConsultants tc ON t.TaskID = tc.TaskID
  LEFT JOIN (
    SELECT ProjectID, SUM(ClientFacingHours) AS TotalLoggedHours
    FROM TimecardLines
    WHERE Status = 'Approved'
    GROUP BY ProjectID
  ) AS tl ON p.ProjectID = tl.ProjectID
  JOIN Client c ON p.ClientID = c.ClientID
  WHERE 1=1
   and c.ActiveStatus = 1
  GROUP BY 
    p.ProjectID,
    p.CreatedDate,
    p.ProjectName,
    p.ClientID,
    p.StartDate,
    p.Status,
    p.Recurring,
    p.RecurrenceType,
    p.RecurrenceIndex,
    p.IntervalValue,
    p.PeriodCount,
    p.ParentProjectID,
    t.TaskID,
    t.TaskName,
    t.DueDate,
    t.LoggedHours,
    t.Sequence,
    st.SubTaskID,
    st.SubTaskName,
    st.PlannedHours,
    st.DueDate,
    st.Status,
    c.ClientName,
    c.ActiveStatus,
    tl.TotalLoggedHours
  ORDER BY p.StartDate DESC, t.Sequence
`);

    
    return result.recordset;
  }


  static async clientExists(clientId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ClientID', sql.UniqueIdentifier, clientId)
      .query('SELECT 1 FROM client WHERE ClientID = @ClientID');
    return result.recordset.length > 0;
  }


  static async cloneProject(oldProjectID, { ProjectName, ClientID, StartDate, Status }) {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const newProjectID = uuidv4();
      // 1) insert new project
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

      // 2) copy each task
      const tasksRes = await tx.request()
        .input('OldPID', sql.UniqueIdentifier, oldProjectID)
        .query(`SELECT * FROM Tasks WHERE ProjectID = @OldPID`);
      for (const t of tasksRes.recordset) {
        const newTaskID = uuidv4();
        await tx.request()
          .input('TaskID',      sql.UniqueIdentifier, newTaskID)
          .input('ProjectID',   sql.UniqueIdentifier, newProjectID)
          .input('TaskName',    sql.NVarChar(255),   t.TaskName)
          .input('DueDate',     sql.Date,             t.DueDate)
          .input('LoggedHours', sql.Decimal(18,2),    t.LoggedHours)
          .query(`
            INSERT INTO Tasks
              (TaskID, ProjectID, TaskName, DueDate, LoggedHours, CreatedDate, UpdatedDate)
            VALUES
              (@TaskID, @ProjectID, @TaskName, @DueDate, @LoggedHours, GETDATE(), GETDATE())
          `);

        // 3) copy subtasks for this task
        const subsRes = await tx.request()
          .input('OldTID', sql.UniqueIdentifier, t.TaskID)
          .query(`SELECT * FROM Subtasks WHERE TaskID = @OldTID`);
        for (const st of subsRes.recordset) {
          const newSubID = uuidv4();
          await tx.request()
            .input('SubTaskID',   sql.UniqueIdentifier, newSubID)
            .input('TaskID',      sql.UniqueIdentifier, newTaskID)
            .input('SubTaskName', sql.NVarChar(255),   st.SubTaskName)
            .input('PlannedHours',sql.Decimal(18,2),   st.PlannedHours)
            .input('DueDate',     sql.Date,             st.DueDate)
            .input('Status',      sql.NVarChar(50),     'NotStarted')
            .query(`
              INSERT INTO Subtasks
                (SubTaskID, TaskID, SubTaskName, PlannedHours, DueDate, Status, CreatedDate, UpdatedDate)
              VALUES
                (@SubTaskID, @TaskID, @SubTaskName, @PlannedHours, @DueDate, @Status, GETDATE(), GETDATE())
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


static async cloneRecurringProject(oldProjectID) {
    const pool = await poolPromise;
    const tx   = new sql.Transaction(pool);
    await tx.begin();

    try {
      // 1) Load the original project
const { recordset } = await tx.request()
  .input('PID', sql.UniqueIdentifier, oldProjectID)
  .query(`SELECT TOP 1 * FROM Projects WHERE ProjectID = @PID`);
if (!recordset.length) throw new Error('Project not found');
const oldProj = recordset[0];

// 2) Determine new StartDate using recurrence index
const freq = (oldProj.RecurrenceType || '').trim().toLowerCase();
const multiplier = oldProj.IntervalValue * (oldProj.RecurrenceIndex + 1);
let newStartDate;

// Parse StartDate - handle both Date objects and strings from SQL Server
let startDateDayjs;
if (oldProj.StartDate instanceof Date) {
  // If it's a Date object, convert to ISO string and parse
  const dateStr = oldProj.StartDate.toISOString().split('T')[0];
  startDateDayjs = dayjs(dateStr);
} else if (typeof oldProj.StartDate === 'string') {
  // If it's a string, parse it directly
  // SQL Server date format is typically 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm:ss'
  const dateStr = oldProj.StartDate.split('T')[0].split(' ')[0];
  startDateDayjs = dayjs(dateStr);
} else {
  // Fallback: try dayjs parsing
  startDateDayjs = dayjs(oldProj.StartDate);
}

switch (freq) {
  case 'weekly':
    newStartDate = startDateDayjs
                     .add(multiplier, 'week')
                     .format('YYYY-MM-DD');
    break;

  case 'biweekly':
    newStartDate = startDateDayjs
                     .add(multiplier * 2, 'week') // biweekly = 2 weeks per interval
                     .format('YYYY-MM-DD');
    break;

  case 'monthly':
    newStartDate = startDateDayjs
                    .add(multiplier, 'month')
                    .format('YYYY-MM-DD');
    break;

  case 'quarterly':
    newStartDate = startDateDayjs
                     .add(multiplier * 3, 'month') // 1 quarter = 3 months
                     .format('YYYY-MM-DD');
    break;

  case 'annually':
  case 'yearly':
    newStartDate = startDateDayjs
                     .add(multiplier, 'year')
                     .format('YYYY-MM-DD');
    break;

  default:
    throw new Error(`Invalid RecurrenceType: ${freq}`);
}

      // 3) Insert the new/recurring (child) project
      const newProjectID = uuidv4();
      await tx.request()
        .input('ProjectID',       sql.UniqueIdentifier, newProjectID)
        .input('ProjectName',     sql.NVarChar(255),   oldProj.ProjectName)
        .input('ClientID',        sql.UniqueIdentifier, oldProj.ClientID)
        .input('StartDate',       sql.Date,             newStartDate)
        .input('Status',          sql.NVarChar(50),     'Active')
        .input('Recurring',       sql.Bit,              1)
        .input('RecurrenceType',  sql.NVarChar(20),     oldProj.RecurrenceType)
        .input('IntervalValue',   sql.Int,              oldProj.IntervalValue)
        .input('PeriodCount',     sql.Int,              oldProj.PeriodCount)
        .input('RecurrenceIndex', sql.Int,              0)
        .input('ParentProjectID', sql.UniqueIdentifier, oldProjectID)
        .query(`
          INSERT INTO Projects (
            ProjectID, ProjectName, ClientID, StartDate,
            Status, Recurring, RecurrenceType, IntervalValue,
            PeriodCount, RecurrenceIndex, ParentProjectID,
            CreatedDate, UpdatedDate
          ) VALUES (
            @ProjectID, @ProjectName, @ClientID, @StartDate,
            @Status, @Recurring, @RecurrenceType, @IntervalValue,
            @PeriodCount, @RecurrenceIndex, @ParentProjectID,
            GETDATE(), GETDATE()
          );
        `);

// 4) Copy each task + its consultants
const tasksRes = await tx.request()
  .input('OldPID', sql.UniqueIdentifier, oldProjectID)
  .query(`SELECT * FROM Tasks WHERE ProjectID = @OldPID`);

for (const t of tasksRes.recordset) {
  const newTaskID = uuidv4();

  // 4a) Compute new task due date
  let newTaskDue = null;
  if (t.DueDate) {
    switch (freq) {
      case 'weekly':
        newTaskDue = dayjs(t.DueDate)
                       .add(multiplier, 'week')
                       .format('YYYY-MM-DD');
        break;

      case 'biweekly':
        newTaskDue = dayjs(t.DueDate)
                       .add(multiplier * 2, 'week')
                       .format('YYYY-MM-DD');
        break;

      case 'monthly':
        newTaskDue = dayjs(t.DueDate)
                       .add(multiplier, 'month')
                       .format('YYYY-MM-DD');
        break;

      case 'quarterly':
        newTaskDue = dayjs(t.DueDate)
                       .add(multiplier * 3, 'month')
                       .format('YYYY-MM-DD');
        break;

      case 'annually':
      case 'yearly':
        newTaskDue = dayjs(t.DueDate)
                       .add(multiplier, 'year')
                       .format('YYYY-MM-DD');
        break;

      default:
        throw new Error(`Invalid RecurrenceType: ${freq}`);
    }
  }

  // 4b) Insert cloned task
  await tx.request()
    .input('TaskID',      sql.UniqueIdentifier, newTaskID)
    .input('ProjectID',   sql.UniqueIdentifier, newProjectID)
    .input('TaskName',    sql.NVarChar(255),    t.TaskName)
    .input('DueDate',     sql.Date,             newTaskDue)
    .input('LoggedHours', sql.Decimal(18, 2),   t.LoggedHours)
    .input('Sequence',    sql.Int,              t.Sequence)
    .query(`
      INSERT INTO Tasks (
        TaskID, ProjectID, TaskName, DueDate,
        LoggedHours, Sequence, CreatedDate, UpdatedDate
      )
      VALUES (
        @TaskID, @ProjectID, @TaskName, @DueDate,
        @LoggedHours, @Sequence, GETDATE(), GETDATE()
      );
    `);

  // 4c) Clone TaskConsultants
  await tx.request()
    .input('OldTID', sql.UniqueIdentifier, t.TaskID)
    .input('NewTID', sql.UniqueIdentifier, newTaskID)
    .query(`
      INSERT INTO TaskConsultants (TaskID, ConsultantID)
      SELECT @NewTID, ConsultantID
      FROM   TaskConsultants
      WHERE  TaskID = @OldTID;
    `);


 // 5) Copy subtasks for this task (with shifted due dates)
const subsRes = await tx.request()
  .input('OldTID', sql.UniqueIdentifier, t.TaskID)
  .query(`SELECT * FROM SubTasks WHERE TaskID = @OldTID`);

for (const st of subsRes.recordset) {
  const newSubID = uuidv4();
  let newSubDue = null;

  if (st.DueDate) {
    switch (freq) {
      case 'weekly':
        newSubDue = dayjs(st.DueDate)
                      .add(multiplier, 'week')
                      .format('YYYY-MM-DD');
        break;

      case 'biweekly':
        newSubDue = dayjs(st.DueDate)
                      .add(multiplier * 2, 'week')
                      .format('YYYY-MM-DD');
        break;

      case 'monthly':
        newSubDue = dayjs(st.DueDate)
                      .add(multiplier, 'month')
                      .format('YYYY-MM-DD');
        break;

      case 'quarterly':
        newSubDue = dayjs(st.DueDate)
                      .add(multiplier * 3, 'month')
                      .format('YYYY-MM-DD');
        break;

      case 'annually':
      case 'yearly':
        newSubDue = dayjs(st.DueDate)
                      .add(multiplier, 'year')
                      .format('YYYY-MM-DD');
        break;

      default:
        throw new Error(`Unknown RecurrenceType: ${freq}`);
    }
  }

  await tx.request()
    .input('SubTaskID',    sql.UniqueIdentifier, newSubID)
    .input('TaskID',       sql.UniqueIdentifier, newTaskID)
    .input('SubTaskName',  sql.NVarChar(255),    st.SubTaskName)
    .input('PlannedHours', sql.Decimal(18, 2),   st.PlannedHours)
    .input('DueDate',      sql.Date,             newSubDue)
    .input('Status', sql.NVarChar(50), 'NotStarted')
    .query(`
      INSERT INTO SubTasks (
        SubTaskID, TaskID, SubTaskName, PlannedHours, DueDate, Status,
        CreatedDate, UpdatedDate
      ) VALUES (
        @SubTaskID, @TaskID, @SubTaskName, @PlannedHours, @DueDate, @Status,
        GETDATE(), GETDATE()
      );
    `);
}

      }

      await tx.commit();
      return newProjectID;
    }
    catch (err) {
      await tx.rollback();
      throw err;
    }
  }


}



export default Project;