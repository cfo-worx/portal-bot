// ⚠️  IMPORTANT – use the **same** axios instance that already injects the JWT
import axios from './index';          // ← was `axios` from NPM

const base = '/discussion';

export const getTaskPosts = taskId =>
  axios.get(`${base}/posts/${taskId}`).then(r => r.data);

export const addPost = (taskId, userId, message) =>
  axios.post(`${base}/posts`, { taskId, userId, message });

export const addComment = (postId, userId, message) =>
  axios.post(`${base}/comments`, { postId, userId, message });

export const addReply = (commentId, userId, message) =>
  axios.post(`${base}/replies`, { commentId, userId, message });

export const getTaskNoteCounts = () =>
  axios.get('/discussion/taskNoteCounts').then(res => res.data);

