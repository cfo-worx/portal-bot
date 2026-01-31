// server/routes/discussionRoutes.js
import express from 'express';
import {
  getPostsByTask,
  createPost,
  createComment,
  createReply,
  getTaskNoteCounts,
} from '../controllers/discussionController.js';

const router = express.Router();

// Fetch entire thread for one task
router.get('/posts/:taskId', getPostsByTask);

// Create a new top‐level post
router.post('/posts', createPost);

// Reply to a post
router.post('/comments', createComment);

// Reply to a comment
router.post('/replies', createReply);

// Get note counts for tasks
router.get('/taskNoteCounts', getTaskNoteCounts);

export default router;
