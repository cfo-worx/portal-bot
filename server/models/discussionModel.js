// server/models/discussionModel.js
import { poolPromise, sql } from '../db.js';

class DiscussionModel {
  /* ------------------------------------------------- */
  static async getPostsByTask(taskId) {
    const pool = await poolPromise;

    /* POSTS ---------------------------------------------------- */
    const posts = (
      await pool.request()
        .input('TaskID', sql.UniqueIdentifier, taskId)
        .query(`
          SELECT
            p.PostID,
            p.TaskID,
            p.UserID,
            u.FirstName + ' ' + u.LastName AS UserName,
            p.Message,
            p.CreatedAt,
            p.UpdatedAt
          FROM TaskPosts p
          INNER JOIN Users u ON u.UserID = p.UserID
          WHERE p.TaskID = @TaskID AND p.IsDeleted = 0
          ORDER BY p.CreatedAt
        `)
    ).recordset;

    if (!posts.length) return [];

    /* COMMENTS ------------------------------------------------- */
    const postList = posts.map(p => `'${p.PostID}'`).join(',');
    const comments = (
      await pool.request().query(`
        SELECT
          c.CommentID,
          c.PostID,
          c.UserID,
          u.FirstName + ' ' + u.LastName AS UserName,
          c.Message,
          c.CreatedAt,
          c.UpdatedAt
        FROM TaskComments c
        INNER JOIN Users u ON u.UserID = c.UserID
        WHERE c.IsDeleted = 0
          AND c.PostID IN (${postList})
        ORDER BY c.CreatedAt
      `)
    ).recordset;

    /* REPLIES -------------------------------------------------- */
    let replies = [];
    if (comments.length) {
      const commentList = comments.map(c => `'${c.CommentID}'`).join(',');
      replies = (
        await pool.request().query(`
          SELECT
            r.ReplyID,
            r.CommentID,
            r.UserID,
            u.FirstName + ' ' + u.LastName AS UserName,
            r.Message,
            r.CreatedAt,
            r.UpdatedAt
          FROM TaskReplies r
          INNER JOIN Users u ON u.UserID = r.UserID
          WHERE r.IsDeleted = 0
            AND r.CommentID IN (${commentList})
          ORDER BY r.CreatedAt
        `)
      ).recordset;
    }

    /* SHAPE ---------------------------------------------------- */
    const commentsByPost = comments.reduce((acc, c) => {
      (acc[c.PostID] = acc[c.PostID] || []).push({
        ...c,
        replies: replies.filter(r => r.CommentID === c.CommentID)
      });
      return acc;
    }, {});

    return posts.map(p => ({
      ...p,
      comments: commentsByPost[p.PostID] || []
    }));
  }

  /* ------------------------------------------------- */
  static async createPost({ taskId, userId, message }) {
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .input('TaskID',  sql.UniqueIdentifier, taskId)
      .input('UserID',  sql.UniqueIdentifier, userId)
      .input('Message', sql.NVarChar(sql.MAX), message)
      .query(`
        DECLARE @ID UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TaskPosts (PostID, TaskID, UserID, Message)
        VALUES (@ID, @TaskID, @UserID, @Message);
        SELECT @ID AS PostID;
      `);
    return recordset[0].PostID;
  }

  /* ------------------------------------------------- */
  static async createComment({ postId, userId, message }) {
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .input('PostID',  sql.UniqueIdentifier, postId)
      .input('UserID',  sql.UniqueIdentifier, userId)
      .input('Message', sql.NVarChar(sql.MAX), message)
      .query(`
        DECLARE @ID UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TaskComments (CommentID, PostID, UserID, Message)
        VALUES (@ID, @PostID, @UserID, @Message);
        SELECT @ID AS CommentID;
      `);
    return recordset[0].CommentID;
  }

  /* ------------------------------------------------- */
  static async createReply({ commentId, userId, message }) {
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .input('CommentID', sql.UniqueIdentifier, commentId)
      .input('UserID',    sql.UniqueIdentifier, userId)
      .input('Message',   sql.NVarChar(sql.MAX), message)
      .query(`
        DECLARE @ID UNIQUEIDENTIFIER = NEWID();
        INSERT INTO TaskReplies (ReplyID, CommentID, UserID, Message)
        VALUES (@ID, @CommentID, @UserID, @Message);
        SELECT @ID AS ReplyID;
      `);
    return recordset[0].ReplyID;
  }

  static async getTaskNoteCounts() {
  const pool = await poolPromise;
  const results = await pool.request().query(`
    SELECT TaskID, COUNT(*) AS NoteCount
    FROM TaskPosts
    WHERE IsDeleted = 0
    GROUP BY TaskID
  `);

  const counts = {};
  results.recordset.forEach(row => {
    counts[row.TaskID] = row.NoteCount;
  });

  return counts;
}


}

export default DiscussionModel;
