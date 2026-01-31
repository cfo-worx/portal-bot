// server/controllers/discussionController.js
import DiscussionModel from '../models/discussionModel.js';

export async function getPostsByTask(req, res) {
  const { taskId } = req.params;
  try {
    const data = await DiscussionModel.getPostsByTask(taskId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ message: 'Failed to load discussion.' });
  }
}

export async function createPost(req, res) {
  const { taskId, userId, message } = req.body;
  try {
    const newId = await DiscussionModel.createPost({ taskId, userId, message });
    res.status(201).json({ postId: newId });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ message: 'Failed to create post.' });
  }
}

export async function createComment(req, res) {
  const { postId, userId, message } = req.body;
  try {
    const newId = await DiscussionModel.createComment({ postId, userId, message });
    res.status(201).json({ commentId: newId });
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(500).json({ message: 'Failed to create comment.' });
  }
}

export async function createReply(req, res) {
  const { commentId, userId, message } = req.body;
  try {
    const newId = await DiscussionModel.createReply({ commentId, userId, message });
    res.status(201).json({ replyId: newId });
  } catch (err) {
    console.error('Error creating reply:', err);
    res.status(500).json({ message: 'Failed to create reply.' });
  }
}



export const getTaskNoteCounts = async (req, res) => {
  try {
    const data = await DiscussionModel.getTaskNoteCounts();
    res.json(data);
  } catch (err) {
    console.error('[getTaskNoteCounts] Error:', err);
    res.status(500).json({ message: 'Failed to fetch task note counts' });
  }
};