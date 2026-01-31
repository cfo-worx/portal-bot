// /frontend/src/modules/consultant/pages/ConsultantPM.jsx

import React, { useEffect, useState, useMemo, useContext } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Box,
  Typography,
  CircularProgress,
  TextField,
  FormControl,
  Select,
  MenuItem,
  InputAdornment,
  Card,
  CardHeader,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import CommentIcon from '@mui/icons-material/Comment';
import RepeatIcon from '@mui/icons-material/Repeat';

import { AuthContext } from '../../../context/AuthContext';
import { projectService } from '../../../api/projects';
import { subtaskService } from '../../../api/subtasks';
import { getTaskNoteCounts } from '../../../api/discussionService';
import { getActiveConsultants } from '../../../api/consultants';
import { getActiveClients } from '../../../api/clients';
import TaskDiscussionModal from '../components/TaskDiscussionModal';

dayjs.extend(relativeTime);

const SUBTASK_STATUSES = ['NotStarted', 'InProgress', 'OnHold', 'Completed'];
const PROJECT_STATUSES = ['Active', 'Completed', 'On-Hold'];

/**
 * Convert flat project/task/subtask list into Projects → Tasks → SubTasks.
 */
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
        StartDate: row.StartDate?.split('T')[0] || '',
        CreatedDate: row.CreatedDate,
        Status: row.Status,
        Recurring: row.Recurring === 1 || row.Recurring === true,
        LoggedHours: Number(row.ProjectLoggedHours) || 0,
        Tasks: [],
      };
    }

    if (row.TaskID && !tasksMap[row.TaskID]) {
      const raw = row.AssignedConsultants || '';
      tasksMap[row.TaskID] = {
        TaskID: row.TaskID,
        TaskName: row.TaskName,
        DueDate: row.TaskDueDate?.split('T')[0] || '',
        LoggedHours: row.LoggedHours,
        Sequence: row.Sequence,
        AssignedConsultants: raw
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id),
        SubTasks: [],
      };
      projectsMap[row.ProjectID].Tasks.push(tasksMap[row.TaskID]);
    }

    if (row.SubTaskID) {
      const subTask = {
        SubTaskID: row.SubTaskID,
        SubTaskName: row.SubTaskName,
        PlannedHours: row.PlannedHours,
        DueDate: row.SubTaskDueDate?.split('T')[0] || '',
        Status: row.SubTaskStatus,
      };
      tasksMap[row.TaskID].SubTasks.push(subTask);
    }
  });

  // Sort tasks by Sequence
  Object.values(projectsMap).forEach((proj) => {
    proj.Tasks.sort((a, b) => a.Sequence - b.Sequence);
  });

  return Object.values(projectsMap);
};

const ConsultantPM = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteCounts, setNoteCounts] = useState({});
  const [consultantsList, setConsultantsList] = useState([]);
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClientID, setFilterClientID] = useState('ALL');
  const [statusFilters, setStatusFilters] = useState({
    Active: true,
    Completed: false,
    'On-Hold': false,
  });
  const [discussionOpenFor, setDiscussionOpenFor] = useState(null);
  const [subtaskStatuses, setSubtaskStatuses] = useState({}); // local edit buffer for subtask statuses
  const [expandedProjectIds, setExpandedProjectIds] = useState({});

  const { auth } = useContext(AuthContext);
  const consultantID = auth.user?.consultantId;


  const getTaskStatusDotColor = (subtasks) => {
  const statuses = subtasks.map((st) => subtaskStatuses[st.SubTaskID] || st.Status);
  const allNotStarted = statuses.every((st) => st === 'NotStarted');
  const allCompleted = statuses.every((st) => st === 'Completed');
  if (allCompleted) return 'green';
  if (allNotStarted) return 'red';
  return 'yellow';
};

const formatIntervalLabel = (proj) => {
  if (!proj.Recurring || !proj.PeriodCount) return '';
  // e.g. “12 × monthly”
  return `${proj.PeriodCount}× ${proj.RecurrenceType}`;
};

  // Load initial data: projects, clients, consultants
  useEffect(() => {
    const loadData = async () => {
      try {
        const [projectsData, consultantsData, clientsData] = await Promise.all([
          projectService.getAll(),
          getActiveConsultants(),
          getActiveClients(),
        ]);
        setConsultantsList(consultantsData);
        setClients(clientsData);

        const hierarchy = groupProjectsIntoHierarchy(projectsData);
        hierarchy.sort((a, b) =>
          dayjs(b.CreatedDate).valueOf() - dayjs(a.CreatedDate).valueOf()
        );
        setProjects(hierarchy);
      } catch (err) {
        console.error('Error loading data', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Load note counts for tasks
  useEffect(() => {
    const fetchNoteCounts = async () => {
      try {
        const data = await getTaskNoteCounts();
        setNoteCounts(data);
      } catch (err) {
        console.error('Error fetching task note counts', err);
      }
    };
    fetchNoteCounts();
  }, []);

  // Initialize subtaskStatuses when projects change
  useEffect(() => {
    const initialStatuses = {};
    projects.forEach((proj) => {
      proj.Tasks.forEach((task) => {
        task.SubTasks.forEach((sub) => {
          initialStatuses[sub.SubTaskID] = sub.Status || 'NotStarted';
        });
      });
    });
    setSubtaskStatuses(initialStatuses);
  }, [projects]);

  const refreshProjects = async () => {
    try {
      const raw = await projectService.getAll();
      const hierarchy = groupProjectsIntoHierarchy(raw);
      hierarchy.sort((a, b) =>
        dayjs(b.CreatedDate).valueOf() - dayjs(a.CreatedDate).valueOf()
      );
      setProjects(hierarchy);
    } catch (err) {
      console.error('Error refreshing projects', err);
    }
  };

  // Only show projects where this consultant is assigned
  const consultantProjects = useMemo(() => {
    if (!consultantID) return [];
    return projects.filter((proj) =>
      proj.Tasks.some((t) => (t.AssignedConsultants || []).includes(consultantID))
    );
  }, [projects, consultantID]);

  // Filter by project status checkboxes
  const statusFilteredProjects = useMemo(() => {
    return consultantProjects.filter((proj) => statusFilters[proj.Status]);
  }, [consultantProjects, statusFilters]);

  // Determine available clients from consultantProjects (for dropdown)
const availableClients = useMemo(() => {
  const map = {};
  consultantProjects.forEach((proj) => {
    if (proj.ClientID && proj.ClientName) {
      map[proj.ClientID] = proj.ClientName;
    }
  });

  return Object
    .entries(map)
    .map(([id, name]) => ({ ClientID: id, ClientName: name }))
    // Sort by ClientName before returning
    .sort((a, b) => a.ClientName.localeCompare(b.ClientName));
}, [consultantProjects]);


  // Filter by selected client
  const clientFilteredProjects = useMemo(() => {
    if (filterClientID === 'ALL') return statusFilteredProjects;
    return statusFilteredProjects.filter((p) => p.ClientID === filterClientID);
  }, [statusFilteredProjects, filterClientID]);

  // Filter by search term
  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clientFilteredProjects;
    return clientFilteredProjects.filter((proj) =>
      proj.ProjectName.toLowerCase().includes(term)
    );
  }, [clientFilteredProjects, searchTerm]);

  const getTaskPlannedHours = (task) =>
    (task.SubTasks || []).reduce((sum, st) => sum + (Number(st.PlannedHours) || 0), 0);

  // Handle subtask status change
  const handleSubtaskStatusChange = async (subTaskID, newStatus) => {
    setSubtaskStatuses((prev) => ({ ...prev, [subTaskID]: newStatus }));
    try {
      await subtaskService.update(subTaskID, { Status: newStatus });
      await refreshProjects();
    } catch (err) {
      console.error('Failed to update subtask status', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f7fa', p: 2 }}>
      {/* Header: Title, Search, Client Filter, Status Filters */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#fff',
          borderRadius: 2,
          boxShadow: '0 1px 4px rgba(31, 60, 136, 0.1)',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 500, color: '#1f3c88', flexGrow: 1 }}>
          My Projects
        </Typography>

        <TextField
          placeholder="Search projects..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#777' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            backgroundColor: '#f0f0f0',
            borderRadius: 1,
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            width: 250,
          }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select
            value={filterClientID}
            onChange={(e) => setFilterClientID(e.target.value)}
            displayEmpty
            sx={{ backgroundColor: '#f0f0f0', borderRadius: 1 }}
          >
            <MenuItem value="ALL">All Clients</MenuItem>
            {availableClients.map((c) => (
              <MenuItem key={c.ClientID} value={c.ClientID}>
                {c.ClientName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormGroup row>
          {PROJECT_STATUSES.map((status) => (
            <FormControlLabel
              key={status}
              control={
                <Checkbox
                  checked={statusFilters[status]}
                  onChange={(e) =>
                    setStatusFilters((prev) => ({
                      ...prev,
                      [status]: e.target.checked,
                    }))
                  }
                  sx={{ color: '#1f3c88', '&.Mui-checked': { color: '#1f3c88' } }}
                />
              }
              label={status}
              sx={{ mr: 1 }}
            />
          ))}
        </FormGroup>
      </Box>

      {filteredProjects.length === 0 ? (
        <Typography variant="body1" sx={{ mt: 4, textAlign: 'center', color: '#555' }}>
          No projects found.
        </Typography>
      ) : (
        filteredProjects.map((project) => {
          const timeSince = dayjs(project.CreatedDate).fromNow(true);
          return (
            <Card
              key={project.ProjectID}
              sx={{
                mb: 3,
                borderRadius: 2,
                boxShadow: '0 1px 4px rgba(31, 60, 136, 0.15)',
                border: '1px solid #e1e4eb',
                background: '#fff',
                transition: 'background 0.3s ease',
              }}
            >
              <CardHeader
  onClick={() =>
    setExpandedProjectIds(prev => ({
      ...prev,
      [project.ProjectID]: !prev[project.ProjectID],
    }))
  }
  sx={{
    pb: 0,
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #edf0f4',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
  }}
  title={
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <ExpandMoreIcon
        sx={{
          transform: expandedProjectIds[project.ProjectID]
            ? 'rotate(180deg)'
            : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}
      />

      {/* Project name & client */}
      <Box>
        <Typography
          variant="h6"
          sx={{ fontSize: '1rem', fontWeight: 500, color: '#444' }}
        >
          {project.ProjectName}
        </Typography>
        <Typography variant="subtitle2" sx={{ fontSize: '0.85rem', color: '#666' }}>
          Client: {project.ClientName}
        </Typography>
      </Box>

      {/* Created timestamp */}
      <Tooltip
        title={`Created: ${dayjs(project.CreatedDate).format('MMM D, YYYY h:mm A')}`}
        arrow
      >
        <Typography variant="caption" sx={{ color: '#888', ml: 1 }}>
          {timeSince}
        </Typography>
      </Tooltip>
    </Box>
  }
  subheader={
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        flexWrap: 'wrap',
        mt: 1,
        alignItems: 'center',
        marginBottom: '16px'
      }}
    >
      {/* Status badge */}
      <Chip
        label={project.Status}
        size="small"
        variant="outlined"
        sx={{
          fontSize: '0.75rem',
          borderColor:
            project.Status === 'Completed'
              ? 'success.main'
              : project.Status === 'On-Hold'
              ? 'warning.main'
              : 'primary.main',
          color:
            project.Status === 'Completed'
              ? 'success.main'
              : project.Status === 'On-Hold'
              ? 'warning.main'
              : 'primary.main',
        }}
      />

      {/* Recurring badge + interval */}
      {project.Recurring && (
        <>
          <Chip
            icon={<RepeatIcon sx={{ fontSize: '1rem' }} />}
            label={project.RecurrenceType || '—'}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.75rem', borderColor: '#5a87f2', color: '#5a87f2' }}
          />
          {project.PeriodCount && (
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#666' }}>
              {project.PeriodCount}× {project.RecurrenceType}
            </Typography>
          )}
        </>
      )}

      {/* Task count */}
      <Typography
        variant="body2"
        sx={{ fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }}
      >
        Tasks: {project.Tasks.length}
      </Typography>
    </Box>
  }
/>

              {expandedProjectIds[project.ProjectID] && (
              <CardContent sx={{ pt: 1, borderRadius: '0 0 8px 8px' }}>
                {project.Tasks.map((task) => (
                  <Box key={task.TaskID} sx={{ mb: 2 }}>
                    <Accordion
                      sx={{
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        backgroundColor: '#fafafa',
                        boxShadow: 'inset 0 0 1px rgba(0,0,0,0.06)',
                      }}
                    >
                      <AccordionSummary
                        sx={{
                          userSelect: 'none',
                          px: 1.5,
                          py: 0.8,
                          minHeight: 0,
                          '& .MuiAccordionSummary-content': { margin: '8px 0' },
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
  <Box
    sx={{
      width: 12,
      height: 12,
      borderRadius: '50%',
      backgroundColor: getTaskStatusDotColor(task.SubTasks),
      border: '1px solid #ccc',
      ml: 1,
    }}
  />
  <Typography
    variant="body1"
    sx={{
      fontSize: '0.9rem',
      fontWeight: 500,
      color: '#444',
    }}
  >
    {task.TaskName}
  </Typography>
</Box>


                        {/* Assigned Consultants Chips */}
                        {task.AssignedConsultants.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mr: 2 }}>
                            {task.AssignedConsultants.map((id) => {
                              const c = consultantsList.find(
                                (x) => x.ConsultantID === id
                              );
                              const label = c
                                ? `${c.FirstName} ${c.LastName}`
                                : id;
                              return (
                                <Chip
                                  key={id}
                                  label={label}
                                  size="small"
                                  sx={{
                                    fontSize: '0.7rem',
                                    height: 20,
                                    backgroundColor: '#e8f0fe',
                                    color: '#1a73e8',
                                  }}
                                />
                              );
                            })}
                          </Box>
                        )}

                        <Typography
                          variant="body2"
                          sx={{ fontSize: '0.85rem', color: '#666', ml: 2 }}
                        >
                          Planned: {getTaskPlannedHours(task)}
                        </Typography>

                        {/* Discussion Icon + Badge */}
                        <Box sx={{ position: 'relative', ml: 1 }}>
                          <Tooltip title="Open Task Discussion" arrow>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDiscussionOpenFor(task.TaskID);
                              }}
                            >
                              <CommentIcon sx={{ fontSize: '1rem', color: '#5a87f2' }} />
                            </IconButton>
                          </Tooltip>
                          {noteCounts[task.TaskID] > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -2,
                                right: -15,
                                backgroundColor: '#5a87f2',
                                color: 'white',
                                borderRadius: '50%',
                                fontSize: '0.65rem',
                                width: 16,
                                height: 16,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                              }}
                            >
                              {noteCounts[task.TaskID]}
                            </Box>
                          )}
                        </Box>
                      </AccordionSummary>

                      <AccordionDetails sx={{ backgroundColor: '#fff', pt: 1, pb: 1, px: 1.5 }}>
                        <Table
                          size="small"
                          sx={{
                            mb: 1,
                            '& th': {
                              backgroundColor: '#f9f9f9',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              color: '#555',
                            },
                            '& td': {
                              fontSize: '0.8rem',
                              color: '#333',
                              whiteSpace: 'normal',
                            },
                            '& td > .MuiTypography-root': { wordWrap: 'break-word' },
                          }}
                        >
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ width: '40%' }}>Subtask</TableCell>
                              <TableCell sx={{ width: '20%', textAlign: 'center' }}>
                                Planned Hrs
                              </TableCell>
                              <TableCell sx={{ width: '20%', textAlign: 'center' }}>
                                Due Date
                              </TableCell>
                              <TableCell sx={{ width: '20%', textAlign: 'center' }}>
                                Status
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {task.SubTasks.map((sub) => (
                              <TableRow key={sub.SubTaskID}>
                                <TableCell>
                                  <Typography
                                    sx={{
                                      fontSize: '0.8rem',
                                      whiteSpace: 'normal',
                                      wordWrap: 'break-word',
                                    }}
                                  >
                                    {sub.SubTaskName}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Typography sx={{ fontSize: '0.8rem' }}>
                                    {sub.PlannedHours}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Typography sx={{ fontSize: '0.8rem' }}>
                                    {sub.DueDate
                                      ? dayjs(sub.DueDate).format('MMM D')
                                      : '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <Select
                                      value={subtaskStatuses[sub.SubTaskID] || sub.Status}
                                      onChange={(e) =>
                                        handleSubtaskStatusChange(
                                          sub.SubTaskID,
                                          e.target.value
                                        )
                                      }
                                      sx={{ fontSize: '0.8rem' }}
                                    >
                                      {SUBTASK_STATUSES.map((st) => (
                                        <MenuItem key={st} value={st} sx={{ fontSize: '0.8rem' }}>
                                          {st}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                ))}
              </CardContent>
              )}
            </Card>
          );
        })
      )}
      {discussionOpenFor && (
        <TaskDiscussionModal
          open={!!discussionOpenFor}
          onClose={() => setDiscussionOpenFor(null)}
          taskId={discussionOpenFor}
        />
      )}
    </Box>
  );
};

export default ConsultantPM;
