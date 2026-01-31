import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Box,
  Typography,
  Button,
  Card,
  CardHeader,
  CardContent,
  Tooltip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Collapse,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RepeatIcon from '@mui/icons-material/Repeat';
import { projectService } from '../../../api/projects';
import { taskService } from '../../../api/tasks';
import { subtaskService } from '../../../api/subtasks';
import { getActiveConsultants } from '../../../api/consultants';
import { getActiveClients } from '../../../api/clients';
import CommentIcon from '@mui/icons-material/Comment';
import TaskDiscussionModal from '../components/TaskDiscussionModal';
import { getTaskNoteCounts } from '../../../api/discussionService';




dayjs.extend(relativeTime);

import { Edit as EditIcon, Save as SaveIcon, Close as CancelIcon } from '@mui/icons-material';

const SubtaskRow = React.memo(function SubtaskRow({ sub, STATUSES, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    SubTaskName: sub.SubTaskName,
    PlannedHours: sub.PlannedHours,
    DueDate: sub.DueDate,
    Status: sub.Status,
  });

  // track “in‐flight” operations
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

 const handleField = useCallback((field, value) => {
  setDraft(d => ({ ...d, [field]: value }));
}, []);

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(sub.SubTaskID, draft);
      setEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, sub.SubTaskID, draft]);

  const deleteRow = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete(sub.SubTaskID);
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete, sub.SubTaskID]);

  return (
    <TableRow>
      {editing ? (
        <>
          <TableCell>
            <TextField
              variant="standard" fullWidth
              value={draft.SubTaskName}
              onChange={e => handleField('SubTaskName', e.target.value)}
              InputProps={{ disableUnderline: true, style:{fontSize:'0.8rem'} }}
            />
          </TableCell>
          <TableCell>
            <TextField
              variant="standard" type="number"
              value={draft.PlannedHours}
              onChange={e => handleField('PlannedHours', e.target.value)}
              InputProps={{ disableUnderline: true, style:{fontSize:'0.8rem', textAlign:'center'} }}
            />
          </TableCell>
          <TableCell>
            <TextField
              type="date" variant="standard"
              value={draft.DueDate}
              onChange={e => handleField('DueDate', e.target.value)}
              InputProps={{ disableUnderline: true, style:{fontSize:'0.8rem'} }}
            />
          </TableCell>
          <TableCell>
            <FormControl variant="standard" fullWidth size="small">
              <Select
                value={draft.Status}
                onChange={e => handleField('Status', e.target.value)}
                disableUnderline
                sx={{ fontSize:'0.8rem' }}
              >
                {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </TableCell>
          <TableCell align="center">
      {isSaving ? (
        <CircularProgress size={16} />
      ) : (
        <>
          <IconButton
            size="small"
            onClick={save}
            disabled={isSaving}
          >
            <SaveIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setEditing(false)}
            disabled={isSaving}
          >
            <CancelIcon fontSize="small" />
          </IconButton>
        </>
      )}
    </TableCell>
  </>
) : (
  <>
    <TableCell>{sub.SubTaskName}</TableCell>
    <TableCell>{sub.PlannedHours}</TableCell>
    <TableCell>{sub.DueDate}</TableCell>
    <TableCell>{sub.Status}</TableCell>
    <TableCell align="center" sx={{ display: 'flex', justifyContent: 'center' }}>
      {isDeleting ? (
        <CircularProgress size={16} />
      ) : (
        <>
          <Tooltip title="Edit SubTask">
            <IconButton
              size="small"
              onClick={() => setEditing(true)}
              disabled={isDeleting}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete SubTask">
            <IconButton
              size="small"
              onClick={deleteRow}
              disabled={isDeleting}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
    </TableCell>
        </>
      )}
    </TableRow>
  );
});


const SUBTASK_STATUSES = ['NotStarted', 'InProgress', 'OnHold', 'Completed'];

const groupProjectsIntoHierarchy = (flatData) => {
  const projectsMap = {};
  const tasksMap = {};

  flatData.forEach(row => {
    if (!projectsMap[row.ProjectID]) {
      projectsMap[row.ProjectID] = {
        ProjectID: row.ProjectID,
        ProjectName: row.ProjectName,
        ClientID: row.ClientID,
        ClientName: row.ClientName,
        StartDate: row.StartDate.split('T')[0],
        CreatedDate: row.CreatedDate,
        Status: row.Status,
        Recurring: row.Recurring === 1 || row.Recurring === true,
        ParentProjectID: row.ParentProjectID,
        RecurrenceType: row.RecurrenceType || '',   // ← pull from the API
        IntervalValue: row.IntervalValue ?? null,   // ← pull from the API
        PeriodCount: row.PeriodCount ?? null,       // ← pull from the API
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
          .map(id => id.trim())
          .filter(id => id),
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

  Object.values(projectsMap).forEach(proj => {
    proj.Tasks.sort((a, b) => a.Sequence - b.Sequence);
  });

  return Object.values(projectsMap);
};


const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);


  const [filterClientID, setFilterClientID] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [consultantsList, setConsultantsList] = useState([]);
  const [clientList, setClientList] = useState([]);

  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [projectToClone, setProjectToClone] = useState(null);
  const [newCloneClientID, setNewCloneClientID] = useState('');
  const [newCloneStartDate, setNewCloneStartDate] = useState(dayjs().format('YYYY-MM-DD'));

  const [expandedTaskIds, setExpandedTaskIds] = useState({});
  const [subTaskSortState, setSubTaskSortState] = useState({});
  const [showAddConsultantTaskID, setShowAddConsultantTaskID] = useState(null);
  const [newConsultantSelection, setNewConsultantSelection] = useState('');

  const [projectNames, setProjectNames] = useState({});
  const [taskNames, setTaskNames] = useState({});
  const [subtaskNames, setSubtaskNames] = useState({});

  const [discussionOpenFor, setDiscussionOpenFor] = useState(null);

  const [expandedProjectIds, setExpandedProjectIds] = useState({});
  const [noteCounts, setNoteCounts] = useState({});

  const [searchTerm, setSearchTerm] = useState('');

const [statusFilters, setStatusFilters] = useState({
  Active: true,
  Completed: false,
  'On-Hold': false
});


const [showRecurringOnly, setShowRecurringOnly] = useState(false);





  useEffect(() => {
    const loadData = async () => {
      try {
        const [projectsData, consultantsData, clientsData] = await Promise.all([
          projectService.getAll(),
          getActiveConsultants(),
          getActiveClients()
        ]);

        const sortedClients = clientsData
          .slice()
          .sort((a, b) => a.ClientName.localeCompare(b.ClientName));
        setClientList(sortedClients);

        const sortedConsultants = consultantsData
          .slice()
          .sort((a, b) => {
            const nameA = `${a.FirstName} ${a.LastName}`;
            const nameB = `${b.FirstName} ${b.LastName}`;
            return nameA.localeCompare(nameB);
          });
        setConsultantsList(sortedConsultants);

        const hierarchicalProjects = groupProjectsIntoHierarchy(projectsData);
        hierarchicalProjects.sort((a, b) => 
          dayjs(b.CreatedDate).valueOf() - dayjs(a.CreatedDate).valueOf()
        );
        setProjects(hierarchicalProjects);
     
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);


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

  const refreshProjects = async () => {
    try {
      const projectsData = await projectService.getAll();
      const hierarchicalProjects = groupProjectsIntoHierarchy(projectsData);
      hierarchicalProjects.sort((a, b) => 
        dayjs(b.CreatedDate).valueOf() - dayjs(a.CreatedDate).valueOf()
      );
      setProjects(hierarchicalProjects);
    } catch (err) {
      setError(err.message);
    }
  };

  const getTaskPlannedHours = (task) => {
    return (task.SubTasks || []).reduce((sum, st) => sum + (Number(st.PlannedHours) || 0), 0);
  };

  const getProjectPlannedHours = (project) => {
    return (project.Tasks || []).reduce((sum, t) => sum + getTaskPlannedHours(t), 0);
  };

  const getProjectLoggedHours = (project) => project.LoggedHours || 0;

  const getSortedSubTasks = (task) => {
    const { column = 'SubTaskName', direction = 'asc' } = subTaskSortState[task.TaskID] || {};
    const subCopy = [...(task.SubTasks || [])];

    subCopy.sort((a, b) => {
      let valA, valB;
      switch (column) {
        case 'SubTaskName':
          valA = (a.SubTaskName || '').toLowerCase();
          valB = (b.SubTaskName || '').toLowerCase();
          break;
        case 'PlannedHours':
          valA = Number(a.PlannedHours) || 0;
          valB = Number(b.PlannedHours) || 0;
          break;
        case 'DueDate':
          valA = dayjs(a.DueDate).valueOf();
          valB = dayjs(b.DueDate).valueOf();
          break;
        case 'Status':
          valA = (a.Status || '').toLowerCase();
          valB = (b.Status || '').toLowerCase();
          break;
        default:
          valA = 0;
          valB = 0;
      }
      return direction === 'asc' ? valA - valB : valB - valA;
    });
    return subCopy;
  };

  const handleAddNewProject = async () => {
    const defaultClient = (filterClientID && filterClientID !== 'ALL') ? filterClientID : clientList[0]?.ClientID || '824BCFF0-252D-43C3-AE4E-892356F44206';
    
    const newProj = {
      ProjectName: 'Untitled Project',
      ClientID: defaultClient,
      StartDate: dayjs().format('YYYY-MM-DD'),
      Status: 'Active',
    };
  
    try {
      await projectService.create(newProj);
      await refreshProjects();
    } catch (err) {
      setError('Failed to create project - check console');
      console.error('Creation error:', err);
    }
  };

  const handleOpenCloneDialog = (proj) => {
    setProjectToClone(proj);
    setNewCloneClientID(proj.ClientID);
    setNewCloneStartDate(dayjs().format('YYYY-MM-DD'));
    setCloneDialogOpen(true);
  };

  const handleConfirmClone = async () => {
    if (!projectToClone) return;
    try {
      const clone = {
        ProjectName: `${projectToClone.ProjectName} (Copy)`,
        ClientID: newCloneClientID,
        StartDate: newCloneStartDate,
        Status: 'Active',
      };
      const newId = await projectService.clone(projectToClone.ProjectID, clone);
      console.log('New cloned project ID:', newId);
      await refreshProjects();
      setCloneDialogOpen(false);
    } catch (err) {
      console.error(err);
      setError('Failed to clone project');
    }
  };

 const handleSaveAsTemplate = async (proj) => {
  try {
    const templateID = await projectService.saveAsTemplate(proj.ProjectID, `${proj.ProjectName} Template`);
    alert(`Template saved! (ID: ${templateID})`);
  } catch (err) {
    setError('Failed to save template');
  }
};

  const handleDeleteTask = async (taskId) => {
    try {
      await taskService.delete(taskId);
      await refreshProjects();
    } catch (err) {
      setError('Failed to delete task');
    }
  };

  const handleProjectFieldChange = async (project, field, value) => {
    try {
      await projectService.update(project.ProjectID, { [field]: value });
      await refreshProjects();
    } catch (err) {
      setError(`Failed to update project ${field}`);
    }
  };

  const handleTaskFieldChange = async (task, field, value) => {
    try {
      await taskService.update(task.TaskID, { [field]: value });
      await refreshProjects();
    } catch (err) {
      setError(`Failed to update task ${field}`);
    }
  };

  const handleSubTaskFieldChange = async (subTask, field, value) => {
    try {
      await subtaskService.update(subTask.SubTaskID, { [field]: value });
      await refreshProjects();
    } catch (err) {
      setError(`Failed to update subtask ${field}`);
    }
  };

  const handleAddTask = async (project) => {
    const newTask = {
      TaskName: 'New Task',
      DueDate: dayjs().add(1, 'month').format('YYYY-MM-DD'),
      LoggedHours: 0,
      ProjectID: project.ProjectID,
    };

    try {
      await taskService.create(newTask);
      await refreshProjects();
    } catch (err) {
      setError('Failed to create task');
    }
  };

  const handleAddSubTask = async (task) => {
    const newSub = {
      SubTaskName: 'New SubTask',
      PlannedHours: 0,
      DueDate: dayjs().add(2, 'months').format('YYYY-MM-DD'),
      Status: 'NotStarted',
      TaskID: task.TaskID,
    };

    try {
      await subtaskService.create(newSub);
      await refreshProjects();
    } catch (err) {
      setError('Failed to create subtask');
    }
  };

  const handleDeleteSubTask = async (subTaskId) => {
    try {
      await subtaskService.delete(subTaskId);
      await refreshProjects();
    } catch (err) {
      setError('Failed to delete subtask');
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await projectService.delete(projectId);
      await refreshProjects();
    } catch (err) {
      console.error(err);
      setError('Failed to delete project');
    }
  };

  const handleAddConsultantToTask = async (task, consultantId) => {
    try {
      await taskService.assignConsultant(task.TaskID, consultantId);
      await refreshProjects();
    } catch (err) {
      setError('Failed to add consultant');
    }
  };

  const handleRemoveConsultantFromTask = async (task, consultantId) => {
    try {
      await taskService.removeConsultant(task.TaskID, consultantId);
      await refreshProjects();
    } catch (err) {
      setError('Failed to remove consultant');
    }
  };

  const onDragEnd = async (result, projectID) => {
    if (!result.destination) return;                       // dropped outside list
    const { source, destination } = result;
    if (source.index === destination.index) return;        // no real move
  
    /* ---------- 1. update local state and capture new order ---------- */
    let orderedIds = [];                                   // will hold new order
  
    setProjects(prev =>
      prev.map(p => {
        if (p.ProjectID !== projectID) return p;           // untouched projects
  
        const items = Array.from(p.Tasks);
        const [moved] = items.splice(source.index, 1);
        items.splice(destination.index, 0, moved);
  
        orderedIds = items.map(t => t.TaskID);             // capture now
        return { ...p, Tasks: items };
      })
    );
  
    /* ---------- 2. persist to server ---------- */
    try {
      await taskService.reorder(projectID, orderedIds);
    } catch (err) {
      setError('Failed to reorder tasks');
      console.error('Reorder error:', err);
    }
  };

 // --- REPLACE THIS FUNCTION AS SHOWN BELOW ---
const handleRecurrenceTypeChange = async (project, type) => {
  const intervalMap = { weekly: 1, biweekly: 2, monthly: 1, quarterly: 1, yearly: 1 };
  const interval = intervalMap[type] || 1;

  await projectService.update(project.ProjectID, {
    RecurrenceType: type,
    IntervalValue: interval,   // already a number
    PeriodCount: null,         // reset
  });

  setProjects(prev =>
    prev.map(p =>
      p.ProjectID === project.ProjectID
        ? { ...p, RecurrenceType: type, IntervalValue: interval, PeriodCount: null }
        : p
    )
  );
};

// --- REPLACE THIS FUNCTION AS SHOWN BELOW ---
const handlePeriodCountChange = async (project, countString) => {
  const count = parseInt(countString, 10) || null;

  await projectService.update(project.ProjectID, {
    PeriodCount: count,    // now a number
  });

  setProjects(prev =>
    prev.map(p =>
      p.ProjectID === project.ProjectID
        ? { ...p, PeriodCount: count }
        : p
    )
  );
};


const getDurationOptions = (type) => {
  switch (type) {
    case 'weekly':
      return [
        { label: '1 Month (4 weeks)', count: 4 },
        { label: '3 Months (12 weeks)', count: 12 },
        { label: '6 Months (24 weeks)', count: 24 },
        { label: '1 Year (52 weeks)', count: 52 },
      ];
    case 'biweekly':
      return [
        { label: '1 Month (2 periods)', count: 2 },
        { label: '3 Months (6 periods)', count: 6 },
        { label: '6 Months (12 periods)', count: 12 },
        { label: '1 Year (26 periods)', count: 26 },
      ];
    case 'monthly':
      return [
        { label: '3 Months', count: 3 },
        { label: '6 Months', count: 6 },
        { label: '9 Months', count: 9 },
        { label: '1 Year', count: 12 },
      ];
    case 'quarterly':
      return [
        { label: '3 Months', count: 1 },
        { label: '6 Months', count: 2 },
        { label: '9 Months', count: 3 },
        { label: '1 Year', count: 4 },
      ];
    case 'yearly':
      return [
        { label: '1 Year', count: 1 },
        { label: '2 Years', count: 2 },
        { label: '3 Years', count: 3 },
        { label: '4 Years', count: 4 },
      ];
    default:
      return [
        { label: '3 Months', count: 3 },
        { label: '6 Months', count: 6 },
        { label: '9 Months', count: 9 },
        { label: '1 Year', count: 12 },
      ];
  }
};


const getTaskStatusDotColor = (subtasks = []) => {
  const statuses = subtasks.map(st => st.Status);
  const allNotStarted = statuses.every(s => s === 'NotStarted');
  const allCompleted  = statuses.every(s => s === 'Completed');
  if (allCompleted) return 'green';
  if (allNotStarted) return 'red';
  return 'yellow';
};

  

  useEffect(() => {
    if (projects.length === 0) return;

    const newProjectNames = {};
    const newTaskNames = {};
    const newSubtaskNames = {};

    projects.forEach(project => {
      newProjectNames[project.ProjectID] = project.ProjectName;
      
      project.Tasks.forEach(task => {
        newTaskNames[task.TaskID] = task.TaskName;
        
        task.SubTasks.forEach(subtask => {
          newSubtaskNames[subtask.SubTaskID] = subtask.SubTaskName;
        });
      });
    });

    setProjectNames(newProjectNames);
    setTaskNames(newTaskNames);
    setSubtaskNames(newSubtaskNames);
  }, [projects]);

  const handleProjectNameChange = useDebouncedCallback(async (project, value) => {
    try {
      await projectService.update(project.ProjectID, { ProjectName: value });
      await refreshProjects();
    } catch (err) {
      setError('Failed to update project name');
    }
  }, 5000);

  const handleTaskNameChange = useDebouncedCallback(async (task, value) => {
    try {
      await taskService.update(task.TaskID, { TaskName: value });
      await refreshProjects();
    } catch (err) {
      setError('Failed to update task name');
    }
  }, 5000);

  const handleSubtaskNameChange = useDebouncedCallback(async (subtask, value) => {
    try {
      await subtaskService.update(subtask.SubTaskID, { SubTaskName: value });
      await refreshProjects();
    } catch (err) {
      setError('Failed to update subtask name');
    }
  }, 5000);

const filteredProjects = useMemo(() => {
  const term = searchTerm.toLowerCase();

  // Get statuses only if not in recurring-only mode
  const selectedStatuses = showRecurringOnly
    ? []
    : Object.entries(statusFilters)
        .filter(([, checked]) => checked)
        .map(([status]) => status);

  return (projects || []).filter(p => {
    // If recurring-only is on, filter by Recurring flag
    if (showRecurringOnly) {
  // must be recurring AND a parent (no ParentProjectID)
  if (!(p.Recurring && (p.ParentProjectID == null || p.ParentProjectID === ''))) {
    return false;
  }
} else {
      // Otherwise filter by status
      if (!selectedStatuses.includes(p.Status)) return false;
    }

    // Client filter
    if (filterClientID !== 'ALL' && p.ClientID !== filterClientID) {
      return false;
    }

    // Search term
    if (!term) return true;
    const projHit = p.ProjectName?.toLowerCase().includes(term);
    const clientHit = p.ClientName?.toLowerCase().includes(term);
    const consultantHit = (p.Tasks || []).some(t =>
      (t.AssignedConsultants || []).some(id => {
        const c = consultantsList.find(x => x.ConsultantID === id);
        const name = `${c?.FirstName || ''} ${c?.LastName || ''}`.toLowerCase();
        return name.includes(term);
      })
    );

    return projHit || clientHit || consultantHit;
  });
}, [
  projects,
  statusFilters,
  showRecurringOnly,
  filterClientID,
  searchTerm,
  consultantsList
]);





  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, color: 'error.main' }}>
        <Typography>Error: {error}</Typography>
        <Button onClick={refreshProjects} sx={{ mt: 2 }}>Retry</Button>
      </Box>
    );
  }

  return (
   <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
  <Box
    sx={{
      p: 2,
      mb: 3,
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      backgroundColor: '#fff',
      borderRadius: 2,
      boxShadow: '0 1px 4px rgba(31,60,136,0.1)',
      gap: 2,
    }}
  >
    <Typography variant="h5" sx={{ flexGrow: 1, color: '#1f3c88', fontWeight: 500 }}>
      Projects
    </Typography>

    <TextField
      size="small"
      placeholder="Search projects…"
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: '#777' }} />
          </InputAdornment>
        )
      }}
      sx={{
        width: 250,
        backgroundColor: '#f0f0f0',
        borderRadius: 1,
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
      }}
    />

    <FormGroup row>
  {['Active', 'Completed', 'On-Hold'].map(status => (
    <FormControlLabel
      key={status}
      control={
        <Checkbox
          checked={statusFilters[status]}
          onChange={e =>
            setStatusFilters(prev => ({ ...prev, [status]: e.target.checked }))
          }
          disabled={showRecurringOnly}
          sx={{ color: '#1f3c88', '&.Mui-checked': { color: '#1f3c88' } }}
        />
      }
      label={status}
    />
  ))}

  <FormControlLabel
    control={
      <Checkbox
        checked={showRecurringOnly}
        onChange={e => setShowRecurringOnly(e.target.checked)}
        sx={{ color: '#1f3c88', '&.Mui-checked': { color: '#1f3c88' } }}
      />
    }
    label="Recurring Only"
  />
</FormGroup>


    <FormControl size="small" sx={{ minWidth: 180 }}>
      <Select
        value={filterClientID}
        onChange={e => setFilterClientID(e.target.value)}
        displayEmpty
        sx={{ backgroundColor: '#f0f0f0', borderRadius: 1 }}
      >
        <MenuItem value="ALL">All Clients</MenuItem>
        {clientList.map(c => (
          <MenuItem key={c.ClientID} value={c.ClientID}>{c.ClientName}</MenuItem>
        ))}
      </Select>
    </FormControl>

    <Button
      variant="contained"
      startIcon={<AddCircleOutlineIcon />}
      onClick={handleAddNewProject}
      sx={{
        textTransform: 'none',
        backgroundColor: '#5a87f2',
        '&:hover': { backgroundColor: '#537ddf' }
      }}
    >
      Add New
    </Button>
  </Box>

      <Box sx={{ p: 2 }}>
        {filteredProjects.map((project) => {
          const timeSince = dayjs(project.CreatedDate).fromNow(true);
          const totalPlanned = getProjectPlannedHours(project);
          const totalLogged = getProjectLoggedHours(project);

          return (
          <Card
  key={project.ProjectID}
  sx={{
    mb: 3,
    borderRadius: 2,
    boxShadow: '0 1px 4px rgba(31,60,136,0.1)',
    border: '1px solid #e0e3e7',
    backgroundColor: '#fff',
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
    backgroundColor: '#fefefe',
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

    {/* Always-visible delete button */}
      <Tooltip title="Delete Project" arrow>
        <IconButton
          size="small"
          sx={{ p: 0.5 }}
          onClick={e => {
            e.stopPropagation();
            handleDeleteProject(project.ProjectID);
          }}
        >
          <DeleteOutlineIcon sx={{ fontSize: '1rem', color: '#e53e3e' }} />
        </IconButton>
      </Tooltip>

      {/* Clone / Template / Recurring toggles */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Clone Project" arrow>
          <IconButton
            size="small"
            sx={{ p: 0.5 }}
            onClick={e => {
              e.stopPropagation();
              handleOpenCloneDialog(project);
            }}
          >
            <ContentCopyIcon sx={{ fontSize: '1rem', color: '#666' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Save as Template" arrow>
          <IconButton
            size="small"
            sx={{ p: 0.5 }}
            onClick={e => {
              e.stopPropagation();
              handleSaveAsTemplate(project);
            }}
          >
            <SaveAsIcon sx={{ fontSize: '1rem', color: '#666' }} />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={project.Recurring ? 'Recurring Enabled' : 'Click to Enable Recurring'}
          arrow
        >
          <IconButton
            size="small"
            sx={{ p: 0.5 }}
            onClick={async e => {
              e.stopPropagation();
              const updated = project.Recurring ? 0 : 1;
              await projectService.update(project.ProjectID, {
                Recurring: updated,
                ...(updated && {
                  RecurrenceType: 'monthly',
                  IntervalValue: 1,
                  PeriodCount: 12,
                }),
              });
              setProjects(prev =>
                prev.map(p =>
                  p.ProjectID === project.ProjectID
                    ? {
                        ...p,
                        Recurring: updated,
                        ...(updated && {
                          RecurrenceType: 'monthly',
                          IntervalValue: 1,
                          PeriodCount: 12,
                        }),
                      }
                    : p
                )
              );
            }}
          >
           <RepeatIcon
  sx={{
    fontSize: '1rem',
    // if recurring and no parent → orange; if recurring child → blue; else gray
    color: project.Recurring
      ? project.ParentProjectID == null
        ? '#ff9800'  // vibrant orange
        : '#5a87f2'
      : '#999',
    transition: 'color 0.3s ease-in-out',
  }}
/>

          </IconButton>
        </Tooltip>
      </Box>

      {/* Inline project name editor */}
      <TextField
        variant="standard"
        value={projectNames[project.ProjectID] || ''}
        onChange={e => {
          const v = e.target.value;
          setProjectNames(prev => ({ ...prev, [project.ProjectID]: v }));
          handleProjectNameChange(project, v);
        }}
        InputProps={{ disableUnderline: true }}
        sx={{
          flexGrow: 1,
          '& .MuiInputBase-input': {
            fontSize: '1rem',
            fontWeight: 500,
            color: '#444',
          },
        }}
      />

      {/* Created timestamp */}
      <Tooltip title={`Created: ${dayjs(project.CreatedDate).format('MMM D, YYYY h:mm A')}`} arrow>
        <Typography variant="caption" sx={{ color: '#888' }}>
          {dayjs(project.CreatedDate).fromNow(true)}
        </Typography>
      </Tooltip>
    </Box>
  }
  subheader={
    <>
      {/* Recurrence controls */}
      <Collapse in={project.Recurring} timeout="auto" unmountOnExit>
        <Box
          sx={{
            pt: 0.75,
            pb: 0.5,
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            alignItems: 'center',
            '& .MuiFormControl-root': { minWidth: 120, fontSize: '0.75rem' },
            '& .MuiSelect-select': { fontSize: '0.75rem', py: 0.5 },
          }}
        >
          <FormControl size="small" variant="outlined" sx={{ width: 120 }}>
            <InputLabel shrink sx={{ fontSize: '0.65rem', bgcolor: '#fff', px: '4px', transform: 'translate(12px, -6px)' }}>
              Recurrence
            </InputLabel>
            <Select
              value={project.RecurrenceType || ''}
              onChange={e => handleRecurrenceTypeChange(project, e.target.value)}
              onClick={e => e.stopPropagation()}
              size="small"
              sx={{ '& .MuiSelect-select': { fontSize: '0.85rem' } }}
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="biweekly">Every 2 Weeks</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="quarterly">Quarterly</MenuItem>
              <MenuItem value="yearly">Yearly</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" variant="outlined" sx={{ width: 120 }}>
            <InputLabel shrink sx={{ fontSize: '0.65rem', bgcolor: '#fff', px: '4px', transform: 'translate(12px, -6px)' }}>
              Duration
            </InputLabel>
            <Select
              value={project.PeriodCount || ''}
              onChange={e => handlePeriodCountChange(project, e.target.value)}
              onClick={e => e.stopPropagation()}
              size="small"
              sx={{ '& .MuiSelect-select': { fontSize: '0.85rem' } }}
            >
              {getDurationOptions(project.RecurrenceType).map(opt => (
                <MenuItem key={opt.label} value={opt.count}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Collapse>

      {/* Core project fields: start date, status, client, hours */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
        <TextField
          type="date"
          variant="standard"
          value={project.StartDate}
          onChange={e => handleProjectFieldChange(project, 'StartDate', e.target.value)}
          InputProps={{ disableUnderline: true }}
          size="small"
          sx={{ width: 130, '& .MuiInputBase-input': { fontSize: '0.85rem' } }}
        />

        <FormControl variant="standard" size="small" sx={{ minWidth: 100 }}>
          <InputLabel shrink sx={{ fontSize: '0.85rem' }}>Status</InputLabel>
          <Select
            value={project.Status}
            onChange={async e => {
              const ns = e.target.value;
              await handleProjectFieldChange(project, 'Status', ns);
            }}
            disableUnderline
          >
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Completed">Completed</MenuItem>
            <MenuItem value="On-Hold">On-Hold</MenuItem>
          </Select>
        </FormControl>

        <FormControl variant="standard" size="small" sx={{ minWidth: 150 }}>
          <InputLabel shrink sx={{ fontSize: '0.85rem' }}>Client</InputLabel>
          <Select
            value={project.ClientID}
            onChange={e => handleProjectFieldChange(project, 'ClientID', e.target.value)}
            disableUnderline
          >
            {clientList.map(cl => (
              <MenuItem key={cl.ClientID} value={cl.ClientID} sx={{ fontSize: '0.85rem' }}>
                {cl.ClientName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ ml: 'auto', mr: 2 }}>
          <Typography variant="body2" sx={{ color: '#888', fontSize: '0.8rem', fontStyle: 'italic' }}>
            Planned: {getProjectPlannedHours(project)} | Logged: {project.LoggedHours}
          </Typography>
        </Box>
      </Box>
    </>
  }
/>





{expandedProjectIds[project.ProjectID] && (
              <CardContent sx={{ pt: 1, borderRadius: '0 0 8px 8px' }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontSize: '0.95rem', fontWeight: 500, color: '#444' }}>
                  Tasks
                </Typography>

                <DragDropContext onDragEnd={(result) => onDragEnd(result, project.ProjectID)}>
                  <Droppable droppableId={project.ProjectID}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {project.Tasks.map((task, index) => (
                          <Draggable
                            key={task.TaskID}
                            draggableId={task.TaskID}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  marginBottom: 8,
                                  boxShadow: snapshot.isDragging
                                    ? '0 2px 8px rgba(0,0,0,0.2)'
                                    : 'none'
                                }}
                              >
                                <Accordion
                                  expanded={!!expandedTaskIds[task.TaskID]}
                                  sx={{
                                    mb: 1,
                                    border: '1px solid #e0e0e0',
                                    borderRadius: 1,
                                    backgroundColor: '#fafafa',
                                    boxShadow: 'inset 0 0 1px rgba(0,0,0,0.06)',
                                  }}
                                >
                                 <AccordionSummary
  sx={{
    userSelect: 'none',
    px: 1.2,
    py: 0.5,
    minHeight: 0,
    '& .MuiAccordionSummary-content': { margin: '8px 0' },
  }}
  {...provided.dragHandleProps}
>
  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
    {/* Status dot */}
    <Box
      sx={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: getTaskStatusDotColor(task.SubTasks),
        border: '1px solid #ccc',
        mr: 1,
      }}
    />

    {/* Drag handle */}
    <Box sx={{ mr: 1, cursor: 'grab' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#666">
        <path d="M5 3C5 3.55228 4.55228 4 4 4C3.44772 4 3 3.55228 3 3C3 2.44772 3.44772 2 4 2C4.55228 2 5 2.44772 5 3Z" />
        <path d="M5 8C5 8.55228 4.55228 9 4 9C3.44772 9 3 8.55228 3 8C3 7.44772 3.44772 7 4 7C4.55228 7 5 7.44772 5 8Z" />
        <path d="M5 13C5 13.5523 4.55228 14 4 14C3.44772 14 3 13.5523 3 13C3 12.4477 3.44772 12 4 12C4.55228 12 5 12.4477 5 13Z" />
        <path d="M12 3C12 3.55228 11.5523 4 11 4C10.4477 4 10 3.55228 10 3C10 2.44772 10.4477 2 11 2C11.5523 2 12 2.44772 12 3Z" />
        <path d="M12 8C12 8.55228 11.5523 9 11 9C10.4477 9 10 8.55228 10 8C10 7.44772 10.4477 7 11 7C11.5523 7 12 7.44772 12 8Z" />
        <path d="M12 13C12 13.5523 11.5523 14 11 14C10.4477 14 10 13.5523 10 13C10 12.4477 10.4477 12 11 12C11.5523 12 12 12.4477 12 13Z" />
      </svg>
    </Box>

    {/* Expand/collapse toggle */}
    <IconButton
      onClick={(e) => {
        e.stopPropagation();
        setExpandedTaskIds(prev => ({
          ...prev,
          [task.TaskID]: !prev[task.TaskID]
        }));
      }}
      size="small"
      sx={{ mr: 1, p: 0.5 }}
    >
      <ExpandMoreIcon
        sx={{
          fontSize: '1rem',
          color: '#666',
          transform: expandedTaskIds[task.TaskID]
            ? 'rotate(180deg)'
            : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}
      />
    </IconButton>

    {/* Task name editor */}
    <TextField
      variant="standard"
      placeholder="Task Name"
      value={taskNames[task.TaskID] || ''}
      onChange={(e) => {
        const newValue = e.target.value;
        setTaskNames(prev => ({ ...prev, [task.TaskID]: newValue }));
        handleTaskNameChange(task, newValue);
      }}
      size="small"
      InputProps={{ disableUnderline: true, style: { fontSize: '0.88rem' } }}
      sx={{ flexGrow: 1, minWidth: 140, mr: 1 }}
    />

    {/* Due date */}
    {/* <TextField
      type="date"
      variant="standard"
      value={task.DueDate ? dayjs(task.DueDate).format('YYYY-MM-DD') : ''}
      onChange={(e) => handleTaskFieldChange(task, 'DueDate', e.target.value)}
      size="small"
      InputProps={{ disableUnderline: true, style: { fontSize: '0.85rem' } }}
      sx={{ width: 120, mr: 1 }}
    /> */}

    {/* Planned hours */}
    <TextField
      variant="standard"
      label="Planned Hrs"
      type="number"
      value={getTaskPlannedHours(task)}
      size="small"
      sx={{
        width: 90,
        ml: 2,
        mr: 0.5,
        '& .MuiInputBase-input': { textAlign: 'center', fontSize: '0.85rem' }
      }}
      InputProps={{ readOnly: true, disableUnderline: true }}
      InputLabelProps={{ shrink: true, style: { fontSize: '0.75rem' } }}
    />

    {/* Logged hours */}
    <TextField
      variant="standard"
      label="Logged Hrs"
      type="number"
      value={task.LoggedHours || 0}
      onChange={(e) => handleTaskFieldChange(task, 'LoggedHours', e.target.value)}
      size="small"
      sx={{
        width: 90,
        '& .MuiInputBase-input': { textAlign: 'center', fontSize: '0.85rem' }
      }}
      InputProps={{ disableUnderline: true }}
      InputLabelProps={{ shrink: true, style: { fontSize: '0.75rem' } }}
    />

    {/* Delete button */}
    {task.SubTasks.length === 0 && task.AssignedConsultants.length === 0 && (
      <Tooltip title="Delete Task" arrow>
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteTask(task.TaskID);
          }}
          sx={{ ml: 1, p: 0.5 }}
          size="small"
        >
          <DeleteOutlineIcon sx={{ fontSize: '1rem', color: '#777' }} />
        </IconButton>
      </Tooltip>
    )}

    {/* Discussion icon + badge */}
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
            right: -2,
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
  </Box>
</AccordionSummary>



                                  <Box sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    pl: 6,
                                    pr: 1.2,
                                    pt: 0,
                                    pb: 1,
                                    backgroundColor: '#fdfdfd',
                                  }}>
                                    {(task.AssignedConsultants || []).map((consultantID) => {
                                      const c = consultantsList.find(x => x.ConsultantID === consultantID);
                                      return (
                                        <Chip
                                          key={consultantID}
                                          label={c ? `${c.FirstName} ${c.LastName}` : `Unknown (${consultantID})`}
                                          onDelete={() => handleRemoveConsultantFromTask(task, consultantID)}
                                          size="small"
                                          sx={{ mr: 1, mb: 1, fontSize: '0.75rem', height: 24 }}
                                        />
                                      );
                                    })}
                                    {showAddConsultantTaskID === task.TaskID ? (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <FormControl size="small" sx={{ minWidth: 150 }}>
                                          <Select
                                            value={newConsultantSelection}
                                            onChange={(e) => setNewConsultantSelection(e.target.value)}
                                            displayEmpty
                                            sx={{ fontSize: '0.8rem' }}
                                          >
                                            <MenuItem value=""><em>Select Consultant</em></MenuItem>
                                            {consultantsList.map(c => (
                                              <MenuItem key={c.ConsultantID} value={c.ConsultantID} sx={{ fontSize: '0.8rem' }}>
                                                {c.FirstName} {c.LastName}
                                              </MenuItem>
                                            ))}
                                          </Select>
                                        </FormControl>
                                        <IconButton
                                          size="small"
                                          color="primary"
                                          onClick={() => {
                                            handleAddConsultantToTask(task, newConsultantSelection);
                                            setShowAddConsultantTaskID(null);
                                            setNewConsultantSelection('');
                                          }}
                                          sx={{ p: 0.5 }}
                                        >
                                          <AddCircleOutlineIcon sx={{ fontSize: '1rem' }} />
                                        </IconButton>
                                        <IconButton
                                          size="small"
                                          onClick={() => setShowAddConsultantTaskID(null)}
                                          sx={{ p: 0.5 }}
                                        >
                                          <CloseIcon sx={{ fontSize: '1rem' }} />
                                        </IconButton>
                                      </Box>
                                    ) : (
                                      <Chip
                                        label="+ Add Consultant"
                                        variant="outlined"
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowAddConsultantTaskID(task.TaskID);
                                        }}
                                        sx={{ cursor: 'pointer', mb: 1, fontSize: '0.75rem', height: 24 }}
                                      />
                                    )}
                                  </Box>

                                  <AccordionDetails sx={{ backgroundColor: '#fff', pt: 1, pb: 1, px: 1.2 }}>
 <Table size="small" sx={{
  mb: 1,
  '& th': { backgroundColor: '#fafafa', fontSize: '0.8rem', fontWeight: 500, color: '#555' },
  '& td': { fontSize: '0.8rem', color: '#333' },
}}>
  <TableHead>
    <TableRow>
      {['SubTaskName','PlannedHours','DueDate','Status'].map(col => (
        <TableCell
          key={col}
          onClick={() => setSubTaskSortState(prev => ({
            ...prev,
            [task.TaskID]: {
              column: col,
              direction:
                prev[task.TaskID]?.column === col &&
                prev[task.TaskID]?.direction === 'asc'
                  ? 'desc'
                  : 'asc'
            }
          }))}
          sx={{
            cursor: 'pointer',
            width:
              col === 'SubTaskName'
                ? '35%'
                : col === 'Status'
                ? '20%'
                : '15%'
          }}
        >
          {col.replace(/([A-Z])/g,' $1').trim()}
        </TableCell>
      ))}
      <TableCell align="center" sx={{ width: '10%' }}>
        Actions
      </TableCell>
    </TableRow>
  </TableHead>

<TableBody>
  {getSortedSubTasks(task).map(sub => (
    <SubtaskRow
      key={sub.SubTaskID}
      sub={sub}
      STATUSES={SUBTASK_STATUSES}
      onSave={async (id, draft) => {
    await subtaskService.update(id, draft);
    await refreshProjects();
  }}
      onDelete={async id => {
        await handleDeleteSubTask(id);
        await refreshProjects();
      }}
    />
  ))}
</TableBody>

</Table>


  <Button
    variant="text"
    startIcon={<AddCircleOutlineIcon />}
    onClick={() => handleAddSubTask(task)}
    sx={{ textTransform:'none', fontSize:'0.8rem', fontWeight:500, color:'#444' }}
  >
    Add SubTask
  </Button>
</AccordionDetails>

                                </Accordion>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                <Button
                  variant="outlined"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() => handleAddTask(project)}
                  sx={{ textTransform: 'none', fontSize: '0.85rem', fontWeight: 500, mt: 1 }}
                >
                  Add Task
                </Button>
              </CardContent>
              )}
            </Card>
          );
        })}
      </Box>

      <Dialog open={cloneDialogOpen} onClose={() => setCloneDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 500 }}>Clone Project</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, fontSize: '0.85rem', color: '#444' }}>
            Clone "{projectToClone?.ProjectName}" as Active project
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }} size="small">
            <InputLabel>Client</InputLabel>
            <Select
              value={newCloneClientID}
              onChange={(e) => setNewCloneClientID(e.target.value)}
            >
              {clientList.map(cl => (
                <MenuItem key={cl.ClientID} value={cl.ClientID}>{cl.ClientName}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Start Date"
            type="date"
            fullWidth
            value={newCloneStartDate}
            onChange={(e) => setNewCloneStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmClone}
            sx={{ textTransform: 'none', backgroundColor: '#5a87f2' }}
          >
            Confirm Clone
          </Button>
        </DialogActions>
      </Dialog>

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

export default ProjectsPage;