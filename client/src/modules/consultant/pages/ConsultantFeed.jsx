// /frontend/src/modules/consultant/pages/ConsultantFeed.jsx

import React, { useEffect, useState, useMemo, useContext } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  CircularProgress,
  IconButton
} from '@mui/material';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { AuthContext } from '../../../context/AuthContext';
import { projectService } from '../../../api/projects';
import { getTaskNoteCounts, getTaskPosts } from '../../../api/discussionService';
import TaskDiscussionModal from '../components/TaskDiscussionModal';

dayjs.extend(relativeTime);

// same grouping util
const groupProjectsIntoHierarchy = (flatData) => {
  const projectsMap = {};
  const tasksMap = {};

  flatData.forEach((row) => {
    if (!projectsMap[row.ProjectID]) {
      projectsMap[row.ProjectID] = {
        ProjectID: row.ProjectID,
        ProjectName: row.ProjectName,
        ClientID: row.ClientID,
        ClientName: row.ClientName,
        CreatedDate: row.CreatedDate,
        Tasks: []
      };
    }
    if (row.TaskID && !tasksMap[row.TaskID]) {
      const raw = row.AssignedConsultants || '';
      tasksMap[row.TaskID] = {
        TaskID: row.TaskID,
        TaskName: row.TaskName,
        TaskCreatedDate: row.TaskCreatedDate,
        AssignedConsultants: raw.split(',').map(id => id.trim()).filter(Boolean),
        SubTasks: []
      };
      projectsMap[row.ProjectID].Tasks.push(tasksMap[row.TaskID]);
    }
    if (row.SubTaskID) {
      tasksMap[row.TaskID].SubTasks.push({
        SubTaskID: row.SubTaskID,
        SubTaskName: row.SubTaskName,
        SubTaskDueDate: row.SubTaskDueDate,
        SubTaskStatus: row.SubTaskStatus
      });
    }
  });

  return Object.values(projectsMap);
};

export default function ConsultantFeed() {
  const { auth } = useContext(AuthContext);
  const consultantID = auth.user?.consultantId;

  const [hierarchy, setHierarchy] = useState([]);
  const [noteCounts, setNoteCounts] = useState({});
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [discussionOpenFor, setDiscussionOpenFor] = useState(null);

  // load projects + note counts
  useEffect(() => {
    (async () => {
      try {
        const [raw, counts] = await Promise.all([
          projectService.getAll(),
          getTaskNoteCounts()
        ]);
        setNoteCounts(counts);
        setHierarchy(groupProjectsIntoHierarchy(raw));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // flatten only your tasks
  const myTasks = useMemo(() => {
    return hierarchy
      .flatMap(proj =>
        proj.Tasks
          .filter(t => t.AssignedConsultants.includes(consultantID))
          .map(t => ({
            ClientName: proj.ClientName,
            ProjectName: proj.ProjectName,
            TaskID: t.TaskID,
            TaskName: t.TaskName,
            CreatedDate: t.TaskCreatedDate,
            NoteCount: noteCounts[t.TaskID] || 0,
            SubTasks: t.SubTasks
          }))
      );
  }, [hierarchy, consultantID, noteCounts]);

  // flatten your subtasks
  const mySubtasks = useMemo(() => {
    return myTasks.flatMap(t =>
      t.SubTasks.map(st => ({
        ClientName: t.ClientName,
        ProjectName: t.ProjectName,
        TaskName: t.TaskName,
        SubTaskID: st.SubTaskID,
        SubTaskName: st.SubTaskName,
        DueDate: st.SubTaskDueDate,
        Status: st.SubTaskStatus
      }))
    );
  }, [myTasks]);

  // comments last 30 days
  useEffect(() => {
    (async () => {
      const since = dayjs().subtract(30, 'day');
      let all = [];
      await Promise.all(
        myTasks
          .filter(t => t.NoteCount > 0)
          .map(async t => {
            const posts = await getTaskPosts(t.TaskID);
            posts.forEach(p =>
              (p.comments || []).forEach(c => {
                if (dayjs(c.CreatedAt).isAfter(since)) {
                  all.push({
                    taskId: t.TaskID,
                    taskName: t.TaskName,
                    message: c.Message,
                    createdAt: c.CreatedAt,
                    userName: c.UserName
                  });
                }
              })
            );
          })
      );
      setComments(
        all
          .sort((a, b) => dayjs(b.createdAt).diff(dayjs(a.createdAt)))
          .slice(0, 5)
      );
    })();
  }, [myTasks]);

  // Coming Due: next 7 days
  const comingDue = useMemo(() => {
    const now = dayjs();
    return mySubtasks.filter(st => {
      const d = dayjs(st.DueDate);
      return st.DueDate && d.isAfter(now) && d.isBefore(now.add(7, 'day'));
    });
  }, [mySubtasks]);

  // Recently Added: last 7 days
  const recentAdded = useMemo(() => {
    const cutoff = dayjs().subtract(7, 'day');
    return myTasks.filter(t => t.CreatedDate && dayjs(t.CreatedDate).isAfter(cutoff));
  }, [myTasks]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, color: '#1f3c88' }}>
        📋 Your Feed
      </Typography>

      {/* Coming Due */}
      <Card sx={{ mb: 4 }}>
        <CardHeader title="Coming Due" subheader="Subtasks due in next 7 days" sx={{ backgroundColor: '#f9fafb' }} />
        <CardContent>
          {comingDue.length ? comingDue.map((st) => (
            <Card
              key={st.SubTaskID}
              variant="outlined"
              sx={{ mb: 2, p: 1 }}
            >
              <Typography variant="subtitle2" sx={{ color: '#666' }}>
                {st.ClientName} → {st.ProjectName}
              </Typography>
              <Typography variant="h6">{st.TaskName}</Typography>
              <Typography variant="body1" sx={{ ml: 1 }}>
                🔹 {st.SubTaskName}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                Due: {dayjs(st.DueDate).format('MMM D, YYYY')} — Status: {st.Status}
              </Typography>
            </Card>
          )) : (
            <Typography color="text.secondary">No subtasks coming due.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Recently Added */}
      <Card sx={{ mb: 4 }}>
        <CardHeader title="Recently Added" subheader="Tasks created in last 7 days" sx={{ backgroundColor: '#f9fafb' }} />
        <CardContent>
          {recentAdded.length ? recentAdded.map((t) => (
            <Card
              key={t.TaskID}
              variant="outlined"
              sx={{ mb: 2, p: 1 }}
            >
              <Typography variant="subtitle2" sx={{ color: '#666' }}>
                {t.ClientName} → {t.ProjectName}
              </Typography>
              <Typography variant="h6">{t.TaskName}</Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                Created: {dayjs(t.CreatedDate).format('MMM D, YYYY')} — Comments: {t.NoteCount}
              </Typography>
            </Card>
          )) : (
            <Typography color="text.secondary">No recently added tasks.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Recent Comments */}
      <Card>
        <CardHeader title="Recent Comments" subheader="Last 30 days" sx={{ backgroundColor: '#f9fafb' }} />
        <CardContent>
          {comments.length ? comments.map((c,i) => (
            <Box
              key={i}
              sx={{ display: 'flex', alignItems: 'center', mb: 1, cursor: 'pointer' }}
              onClick={() => setDiscussionOpenFor(c.taskId)}
            >
              <CommentIcon sx={{ mr: 1, color: '#1f3c88' }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {c.userName} on "{c.taskName}"
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  {dayjs(c.createdAt).fromNow()} – {c.message.slice(0, 80)}…
                </Typography>
              </Box>
              <IconButton edge="end"><ChevronRightIcon/></IconButton>
            </Box>
          )) : (
            <Typography color="text.secondary">No recent comments.</Typography>
          )}
        </CardContent>
      </Card>

      {discussionOpenFor && (
        <TaskDiscussionModal
          open
          onClose={() => setDiscussionOpenFor(null)}
          taskId={discussionOpenFor}
        />
      )}
    </Box>
  );
}
