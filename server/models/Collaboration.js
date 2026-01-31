import { v4 as uuidv4 } from 'uuid';
import sql from 'mssql';
import { poolPromise } from '../db.js';

/**
 * Collaboration Spaces + Task Tracker
 *
 * - Spaces can be private (only members can see) or shared.
 * - Tasks can link to Client/Contract/Project and can be assigned to any internal user.
 * - Comments support lightweight collaboration. Mentions / Teams notifications can be wired later.
 */

export class Collaboration {
  static async listSpacesForUser({ userID }) {
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input('UserID', sql.UniqueIdentifier, userID)
      .query(`
        SELECT
          s.CollaborationSpaceID AS SpaceID,
          s.Name,
          s.Description,
          s.IsPrivate,
          s.CreatedByUserID,
          s.CreatedOn,
          s.UpdatedOn
        FROM CollaborationSpace s
        INNER JOIN CollaborationSpaceMember m ON m.CollaborationSpaceID = s.CollaborationSpaceID
        WHERE m.UserID = @UserID
        ORDER BY s.UpdatedOn DESC;
      `);
    return res.recordset;
  }

  static async createSpace({ name, description = null, isPrivate = true, createdByUserID, memberUserIDs = [] }) {
    const pool = await poolPromise;
    const spaceID = uuidv4();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx)
        .input('SpaceID', sql.UniqueIdentifier, spaceID)
        .input('Name', sql.NVarChar(120), name)
        .input('Description', sql.NVarChar(sql.MAX), description)
        .input('IsPrivate', sql.Bit, isPrivate)
        .input('CreatedBy', sql.UniqueIdentifier, createdByUserID)
        .query(`
          INSERT INTO CollaborationSpace (CollaborationSpaceID, Name, Description, IsPrivate, CreatedByUserID, CreatedOn, UpdatedOn)
          VALUES (@SpaceID, @Name, @Description, @IsPrivate, @CreatedBy, GETDATE(), GETDATE());
        `);

      // Owner membership
      await new sql.Request(tx)
        .input('SpaceID', sql.UniqueIdentifier, spaceID)
        .input('UserID', sql.UniqueIdentifier, createdByUserID)
        .input('Role', sql.NVarChar(30), 'OWNER')
        .query(`
          INSERT INTO CollaborationSpaceMember (CollaborationSpaceMemberID, CollaborationSpaceID, UserID, MemberRole, AddedOn)
          VALUES (NEWID(), @SpaceID, @UserID, @Role, GETDATE());
        `);

      for (const uid of memberUserIDs) {
        if (!uid || uid === createdByUserID) continue;
        await new sql.Request(tx)
          .input('SpaceID', sql.UniqueIdentifier, spaceID)
          .input('UserID', sql.UniqueIdentifier, uid)
          .input('Role', sql.NVarChar(30), 'MEMBER')
          .query(`
            IF NOT EXISTS (SELECT 1 FROM CollaborationSpaceMember WHERE CollaborationSpaceID = @SpaceID AND UserID = @UserID)
            BEGIN
              INSERT INTO CollaborationSpaceMember (CollaborationSpaceMemberID, CollaborationSpaceID, UserID, MemberRole, AddedOn)
              VALUES (NEWID(), @SpaceID, @UserID, @Role, GETDATE());
            END
          `);
      }
      await tx.commit();
      return { spaceID };
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  static async getSpace({ spaceID }) {
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input('SpaceID', sql.UniqueIdentifier, spaceID)
      .query(`
        SELECT CollaborationSpaceID AS SpaceID, Name, Description, IsPrivate, CreatedByUserID, CreatedOn, UpdatedOn
        FROM CollaborationSpace
        WHERE CollaborationSpaceID = @SpaceID;
      `);
    if (!res.recordset.length) return null;
    const members = await pool
      .request()
      .input('SpaceID', sql.UniqueIdentifier, spaceID)
      .query(`
        SELECT m.UserID, u.Name AS UserName, m.MemberRole AS Role, m.AddedOn
        FROM CollaborationSpaceMember m
        LEFT JOIN [User] u ON u.UserID = m.UserID
        WHERE m.CollaborationSpaceID = @SpaceID
        ORDER BY m.MemberRole DESC, u.Name ASC;
      `);
    return { ...res.recordset[0], members: members.recordset };
  }

  static async addMember({ spaceID, userID, role = 'MEMBER' }) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('SpaceID', sql.UniqueIdentifier, spaceID)
      .input('UserID', sql.UniqueIdentifier, userID)
      .input('Role', sql.NVarChar(30), role)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM CollaborationSpaceMember WHERE CollaborationSpaceID = @SpaceID AND UserID = @UserID)
        BEGIN
          INSERT INTO CollaborationSpaceMember (CollaborationSpaceMemberID, CollaborationSpaceID, UserID, MemberRole, AddedOn)
          VALUES (NEWID(), @SpaceID, @UserID, @Role, GETDATE());
        END
      `);
    return { ok: true };
  }

  static async listTasks({ spaceID = null, assignedToUserID = null, status = null, includeClosed = false }) {
    const pool = await poolPromise;
    const req = pool.request();
    const where = [];
    if (spaceID) {
      req.input('SpaceID', sql.UniqueIdentifier, spaceID);
      where.push('t.CollaborationSpaceID = @SpaceID');
    }
    if (assignedToUserID) {
      req.input('AssignedTo', sql.UniqueIdentifier, assignedToUserID);
      where.push('t.AssignedToUserID = @AssignedTo');
    }
    if (status) {
      req.input('Status', sql.NVarChar(30), status);
      where.push('t.Status = @Status');
    }
    if (!includeClosed) {
      where.push("t.Status NOT IN ('DONE', 'CANCELLED')");
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const res = await req.query(`
      SELECT
        t.CollaborationTaskID AS TaskID,
        t.CollaborationSpaceID AS SpaceID,
        s.Name AS SpaceName,
        t.Title,
        t.Description,
        t.Category,
        t.Priority,
        t.Status,
        t.DueDate,
        t.ClientID,
        c.ClientName,
        t.ContractID,
        t.ProjectID,
        t.AssignedToUserID,
        au.Name AS AssignedToName,
        t.CreatedByUserID,
        cu.Name AS CreatedByName,
        t.CreatedOn,
        t.UpdatedOn,
        t.CompletedOn
      FROM CollaborationTask t
      LEFT JOIN CollaborationSpace s ON s.CollaborationSpaceID = t.CollaborationSpaceID
      LEFT JOIN Client c ON c.ClientID = t.ClientID
      LEFT JOIN [User] au ON au.UserID = t.AssignedToUserID
      LEFT JOIN [User] cu ON cu.UserID = t.CreatedByUserID
      ${whereSql}
      ORDER BY
        CASE WHEN t.Priority = 'URGENT' THEN 0 WHEN t.Priority = 'HIGH' THEN 1 WHEN t.Priority = 'MEDIUM' THEN 2 ELSE 3 END,
        CASE WHEN t.DueDate IS NULL THEN 1 ELSE 0 END,
        t.DueDate ASC,
        t.UpdatedOn DESC;
    `);
    return res.recordset;
  }

  static async createTask({
    spaceID,
    title,
    description = null,
    category = null,
    priority = 'MEDIUM',
    status = 'OPEN',
    dueDate = null,
    clientID = null,
    contractID = null,
    projectID = null,
    assignedToUserID = null,
    createdByUserID,
  }) {
    const pool = await poolPromise;
    const taskID = uuidv4();
    await pool
      .request()
      .input('TaskID', sql.UniqueIdentifier, taskID)
      .input('SpaceID', sql.UniqueIdentifier, spaceID)
      .input('Title', sql.NVarChar(200), title)
      .input('Description', sql.NVarChar(sql.MAX), description)
      .input('Category', sql.NVarChar(120), category)
      .input('Priority', sql.NVarChar(30), priority)
      .input('Status', sql.NVarChar(30), status)
      .input('DueDate', sql.Date, dueDate)
      .input('ClientID', sql.UniqueIdentifier, clientID)
      .input('ContractID', sql.UniqueIdentifier, contractID)
      .input('ProjectID', sql.UniqueIdentifier, projectID)
      .input('AssignedTo', sql.UniqueIdentifier, assignedToUserID)
      .input('CreatedBy', sql.UniqueIdentifier, createdByUserID)
      .query(`
        INSERT INTO CollaborationTask (
          CollaborationTaskID, CollaborationSpaceID, Title, Description, Category, Priority, Status, DueDate,
          ClientID, ContractID, ProjectID,
          AssignedToUserID, CreatedByUserID,
          CreatedOn, UpdatedOn, CompletedOn
        ) VALUES (
          @TaskID, @SpaceID, @Title, @Description, @Category, @Priority, @Status, @DueDate,
          @ClientID, @ContractID, @ProjectID,
          @AssignedTo, @CreatedBy,
          GETDATE(), GETDATE(), CASE WHEN @Status IN ('DONE','CANCELLED') THEN GETDATE() ELSE NULL END
        );
      `);
    return { taskID };
  }

  static async updateTask({ taskID, patch = {} }) {
    const pool = await poolPromise;
    const allowed = {
      Title: 'Title',
      Description: 'Description',
      Category: 'Category',
      Priority: 'Priority',
      Status: 'Status',
      DueDate: 'DueDate',
      ClientID: 'ClientID',
      ContractID: 'ContractID',
      ProjectID: 'ProjectID',
      AssignedToUserID: 'AssignedToUserID',
    };

    const updates = [];
    const req = pool.request();
    req.input('TaskID', sql.UniqueIdentifier, taskID);
    for (const [key, col] of Object.entries(allowed)) {
      if (Object.prototype.hasOwnProperty.call(patch, col)) {
        const val = patch[col];
        const param = key;
        // Basic types
        if (col.endsWith('ID')) req.input(param, sql.UniqueIdentifier, val || null);
        else if (col === 'DueDate') req.input(param, sql.Date, val || null);
        else req.input(param, sql.NVarChar(col === 'Description' ? sql.MAX : 200), val);
        updates.push(`${col} = @${param}`);
      }
    }
    if (!updates.length) return { ok: true };
    const statusProvided = Object.prototype.hasOwnProperty.call(patch, 'Status');
    const statusVal = patch.Status;
    const completedSql = statusProvided ? `, CompletedOn = CASE WHEN @Status IN ('DONE','CANCELLED') THEN COALESCE(CompletedOn, GETDATE()) ELSE NULL END` : '';

    await req.query(`
      UPDATE CollaborationTask
      SET ${updates.join(', ')}, UpdatedOn = GETDATE()${completedSql}
      WHERE CollaborationTaskID = @TaskID;
    `);
    return { ok: true };
  }

  static async listComments({ taskID }) {
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input('TaskID', sql.UniqueIdentifier, taskID)
      .query(`
        SELECT
          c.CollaborationTaskCommentID AS CommentID,
          c.CollaborationTaskID AS TaskID,
          c.UserID,
          u.Name AS UserName,
          c.Body,
          c.CreatedOn
        FROM CollaborationTaskComment c
        LEFT JOIN [User] u ON u.UserID = c.UserID
        WHERE c.CollaborationTaskID = @TaskID
        ORDER BY c.CreatedOn ASC;
      `);
    return res.recordset;
  }

  static async addComment({ taskID, userID, body }) {
    const pool = await poolPromise;
    const commentID = uuidv4();
    await pool
      .request()
      .input('CommentID', sql.UniqueIdentifier, commentID)
      .input('TaskID', sql.UniqueIdentifier, taskID)
      .input('UserID', sql.UniqueIdentifier, userID)
      .input('Body', sql.NVarChar(sql.MAX), body)
      .query(`
        INSERT INTO CollaborationTaskComment (CollaborationTaskCommentID, CollaborationTaskID, UserID, Body, CreatedOn)
        VALUES (@CommentID, @TaskID, @UserID, @Body, GETDATE());
      `);
    // bump task updated time
    await pool.request().input('TaskID', sql.UniqueIdentifier, taskID).query(`UPDATE CollaborationTask SET UpdatedOn = GETDATE() WHERE CollaborationTaskID = @TaskID;`);
    return { commentID };
  }
}

export default Collaboration;
