import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Table,
  TableHead,
  TableCell,
  TableRow,
  TableBody,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Input,
  Chip,
  CircularProgress,
  Avatar,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import dayjs from 'dayjs';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import UploadIcon from '@mui/icons-material/Upload';
import DescriptionIcon from '@mui/icons-material/Description';

import { projectService } from '../../../api/projects';
import { getConsultants } from '../../../api/consultants';
import { getClients } from '../../../api/clients';
import { supportRequestService } from '../../../api/supportrequests';
import { useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';

const POWER_AUTOMATE_URL = 'https://prod-102.westus.logic.azure.com:443/workflows/07b53a7b6c6e4d54b6d5ad87d4799d99/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=tOV6qk4GaR4X3heKwptZywC4r6vzhggGTiXaWOIDYDU';



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
        StartDate: row.StartDate,
        Status: row.Status,
        Tasks: [],
      };
    }

    if (row.TaskID && !tasksMap[row.TaskID]) {
      tasksMap[row.TaskID] = {
        TaskID: row.TaskID,
        TaskName: row.TaskName,
        DueDate: row.DueDate,
        LoggedHours: row.LoggedHours,
        AssignedConsultants: row.AssignedConsultants?.split(', ') || [],
        SubTasks: [],
      };
      projectsMap[row.ProjectID].Tasks.push(tasksMap[row.TaskID]);
    }

    if (row.SubTaskID) {
      const subTask = {
        SubTaskID: row.SubTaskID,
        SubTaskName: row.SubTaskName,
        PlannedHours: row.PlannedHours,
        DueDate: row.DueDate,
        Status: row.SubTaskStatus,
      };
      tasksMap[row.TaskID].SubTasks.push(subTask);
    }
  });

  return Object.values(projectsMap);
};

const SupportRequestModal = ({ open, onClose, task, subTask, project, consultants, onSubmitSuccess }) => {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const newRequest = {
      ProjectID: project.ProjectID,
      TaskID: task.TaskID,
      SubTaskID: subTask.SubTaskID,
      projectName: project.ProjectName,
      clientName: project.ClientName,
      taskName: task.TaskName,
      subTaskName: subTask.SubTaskName,
      Question: comment,
      consultantEmails: ['rodrigo@cfo-worx.com'],
      status: 'Received'
    };

    try {
      setSubmitting(true);
      const createdRequest = await supportRequestService.create(newRequest);
      onSubmitSuccess(subTask.SubTaskID, createdRequest);
      onClose();
      setComment('');
    } catch (error) {
      console.error('Failed to create support request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Request Support for {subTask.SubTaskName}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Project: {project.ProjectName}<br />
            Client: {project.ClientName}<br />
            Task: {task.TaskName}<br />
            Sub-Task: {subTask.SubTaskName}
          </Typography>
          <TextField
            label="Your Question/Comment"
            multiline
            rows={4}
            fullWidth
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            variant="outlined"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={submitting || !comment.trim()}
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const RepositoryModal = ({ open, onClose, project }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleFileSelect = (e) => setSelectedFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('clientId', project.ClientID);
    formData.append('clientName', project.ClientName);
    formData.append('projectId', project.ProjectID);
    formData.append('fileName', selectedFile.name);
    formData.append('file', selectedFile);

    setUploading(true);
    try {
      const res = await fetch(POWER_AUTOMATE_URL, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed – status ${res.status}`);

      setUploadHistory(prev => [
        ...prev,
        { name: selectedFile.name, date: new Date().toISOString() },
      ]);
      setSnackbar({ open: true, message: 'File uploaded successfully', severity: 'success' });
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Upload failed', severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
      <DialogTitle sx={{ 
        bgcolor: '#f5f7fb',
        borderBottom: '1px solid #e0e0e0',
        fontWeight: 600,
        py: 2,
        fontSize: '1.1rem'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DescriptionIcon color="primary" />
          Project Files - {project.ProjectName}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ py: 3 }}>
        <Box sx={{ 
          border: '2px dashed #e0e0e0',
          borderRadius: '8px',
          p: 3,
          textAlign: 'center',
          mb: 3
        }}>
          <Input
            type="file"
            onChange={handleFileSelect}
            sx={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadIcon />}
              sx={{
                textTransform: 'none',
                borderColor: '#1976d2',
                color: '#1976d2',
                px: 4,
                '&:hover': {
                  borderColor: '#1565c0',
                  backgroundColor: '#f5f7fb'
                }
              }}
            >
              Browse Files
            </Button>
          </label>
          {selectedFile && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ color: '#6b778c' }}>{selectedFile.name}</Typography>
              <Button
                variant="contained"
                onClick={handleUpload}
                startIcon={<UploadIcon />}
                disabled={uploading}
                sx={{ textTransform: 'none' }}
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </Button>
            </Box>
          )}
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 600 }}>File Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Upload Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {uploadHistory.map((file, index) => (
              <TableRow key={index} hover>
                <TableCell sx={{ display: 'flex', alignItems: 'center' }}>
                  <InsertDriveFileIcon sx={{ mr: 1.5, color: '#6b778c' }} />
                  {file.name}
                </TableCell>
                <TableCell>
                  {dayjs(file.date).format('MMM D, YYYY h:mm A')}
                </TableCell>
                <TableCell>
                  <Button size="small" color="primary">Download</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button 
          onClick={onClose}
          sx={{ 
            color: '#6b778c',
            '&:hover': { backgroundColor: '#f5f7fb' }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const getSubTaskStatusIcon = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return <CheckCircleIcon sx={{ color: 'green' }} fontSize="small" />;
    case 'inprogress':
      return <PlayCircleOutlineIcon sx={{ color: '#1976d2' }} fontSize="small" />;
    case 'onhold':
      return <PauseCircleOutlineIcon sx={{ color: 'orange' }} fontSize="small" />;
    case 'notstarted':
    default:
      return <ErrorOutlineIcon sx={{ color: '#888' }} fontSize="small" />;
  }
};

const ReportsPage = () => {
  const { auth } = useContext(AuthContext);
  const clientId = auth.user?.clientId;

  const [projects, setProjects] = useState([]);
  const [expandedStepIndex, setExpandedStepIndex] = useState({});
  const [repoModalOpen, setRepoModalOpen] = useState(null);
  const [supportModalOpen, setSupportModalOpen] = useState(null);
  const [consultants, setConsultants] = useState([]);
  const [clients, setClients] = useState([]);
  const [expandedSupportRequests, setExpandedSupportRequests] = useState([]);
  const [supportHistory, setSupportHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);



  useEffect(() => {
    const loadData = async () => {
      try {
    const [projectsData, consultantsData, clientsData] = await Promise.all([
      projectService.getAll(),
      getConsultants(),
      getClients()
    ]);

    let hierarchicalProjects = groupProjectsIntoHierarchy(projectsData);

    // 🔐 Only show the client's own projects
  if (clientId) {
  hierarchicalProjects = hierarchicalProjects.filter(p => 
    p.ClientID?.toLowerCase().trim() === clientId.toLowerCase().trim()
  );
}

    hierarchicalProjects.sort((a, b) => 
      dayjs(b.StartDate).valueOf() - dayjs(a.StartDate).valueOf()
    );

    setProjects(hierarchicalProjects);
    setConsultants(consultantsData);
    setClients(clientsData);
    setLoading(false);
  } catch (err) {
    setError(err.message);
    setLoading(false);
  }
    };
    loadData();
  }, []);

  useEffect(() => {
    const fetchSupportRequests = async () => {
      try {
        const newSupportHistory = {};
        
        await Promise.all(projects.map(async (project) => {
          try {
            const requests = await supportRequestService.getByProject(project.ProjectID);
            requests.forEach(request => {
              const subtaskId = request.SubTaskID || request.subtaskID;
              if (!newSupportHistory[subtaskId]) {
                newSupportHistory[subtaskId] = [];
              }
              newSupportHistory[subtaskId].push(request);
            });
          } catch (err) {
            console.error(`Error fetching support requests for project ${project.ProjectID}:`, err);
          }
        }));
        
        setSupportHistory(newSupportHistory);
      } catch (err) {
        console.error('Error in support requests fetch:', err);
      }
    };
    
    if (projects.length > 0) {
      fetchSupportRequests();
    }
  }, [projects]);

  const isTaskCompleted = (task) => {
    const subTasks = task?.SubTasks || [];
    return subTasks.every((st) => (st.Status || '').toLowerCase() === 'completed');
  };

  const getActiveStepIndex = (tasks) => {
    if (!tasks || tasks.length === 0) return 0;
    for (let i = 0; i < tasks.length; i++) {
      if (!isTaskCompleted(tasks[i])) {
        return i;
      }
    }
    return tasks.length;
  };

  const handleStepClick = (projectID, stepIndex) => {
    setExpandedStepIndex((prev) => ({
      ...prev,
      [projectID]: prev[projectID] === stepIndex ? null : stepIndex
    }));
  };

  const toggleSupportHistory = (subTaskId) => {
    setExpandedSupportRequests(prev => 
      prev.includes(subTaskId) 
        ? prev.filter(id => id !== subTaskId) 
        : [...prev, subTaskId]
    );
  };

  const handleSupportSubmit = (subTaskId, request) => {
    setSupportHistory(prev => ({
      ...prev,
      [subTaskId]: [...(prev[subTaskId] || []), request]
    }));
  };

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
        <Button onClick={() => window.location.reload()} sx={{ mt: 2 }}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, bgcolor: '#f8fafc', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ 
        mb: 4, 
        fontWeight: 600,
        color: '#1a237e',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5
      }}>
        <DescriptionIcon fontSize="large" />
        Project Progress Dashboard
      </Typography>

     {/* Integrated Legend */}
<Box sx={{ mb:4, p:2, bgcolor:'#ffffff', borderRadius:2, boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>
  <Typography variant="subtitle2" sx={{ mb:1, color:'#555' }}>Legend:</Typography>
  <Box sx={{ display:'flex', flexWrap:'wrap', gap:3 }}>
    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
      <InsertDriveFileIcon sx={{ color:'#1976d2', fontSize: 'small' }}/>
      <Typography variant="caption">Project Files</Typography>
    </Box>
    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
      <CheckCircleIcon sx={{ color:'green', fontSize: 'small' }}/>
      <Typography variant="caption">Completed</Typography>
    </Box>
    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
      <PlayCircleOutlineIcon sx={{ color:'#1976d2', fontSize: 'small' }}/>
      <Typography variant="caption">In Progress</Typography>
    </Box>
    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
      <PauseCircleOutlineIcon sx={{ color:'orange', fontSize: 'small' }}/>
      <Typography variant="caption">On Hold</Typography>
    </Box>
    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
      <ErrorOutlineIcon sx={{ color:'#888', fontSize: 'small' }}/>
      <Typography variant="caption">Not Started/Error</Typography>
    </Box>
    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
      <HelpOutlineIcon sx={{ color:'#6b778c', fontSize: 'small' }}/>
      <Typography variant="caption">Request Support</Typography>
    </Box>
  </Box>
</Box>

      {projects.map((proj) => {
        const tasks = proj.Tasks || [];
        const activeStep = getActiveStepIndex(tasks);
        const client = clients.find(c => c.ClientID === proj.ClientID);

        return (
          <Card key={proj.ProjectID} sx={{ 
            mb: 4, 
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '1px solid #e0e0e0'
          }}>
            <CardHeader
  title={
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ 
          bgcolor: '#1976d2',
          width: 40,
          height: 40
        }}>
          {proj.ProjectName[0]}
        </Avatar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {proj.ProjectName}
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b778c' }}>
              {client?.ClientName || proj.ClientID}
            </Typography>
          </Box>
          <Tooltip title="Project Files">
            <Button
              variant="text"
              onClick={() => setRepoModalOpen(proj.ProjectID)}
              startIcon={<InsertDriveFileIcon />}
              sx={{ 
                color: '#1976d2',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.04)'
                }
              }}
            >
              Upload Files
            </Button>
          </Tooltip>
        </Box>
      </Box>
      <Chip 
        label={proj.Status}
        sx={{
          bgcolor: proj.Status === 'Active' ? '#e3f2fd' : '#f5f5f5',
          color: proj.Status === 'Active' ? '#1976d2' : '#6b778c',
          fontWeight: 500
        }}
      />
    </Box>
  }
  sx={{ 
    py: 2,
    borderBottom: '1px solid #e0e0e0',
    bgcolor: '#f8f9fa'
  }}
/>

            <RepositoryModal
              open={repoModalOpen === proj.ProjectID}
              onClose={() => setRepoModalOpen(null)}
              project={proj}
            />

            <CardContent sx={{ pt: 0 }}>
              {tasks.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#6b778c', mt: 2 }}>
                  No tasks found for this project.
                </Typography>
              ) : (
                <>
                  <Stepper
                    alternativeLabel
                    activeStep={activeStep}
                    sx={{
                      mt: 2,
                      mb: 4,
                      '& .MuiStepLabel-label': { 
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        color: '#1a237e',
                        mt: 1
                      },
                      '& .MuiStepIcon-root.Mui-active': { 
                        color: '#1976d2',
                        fontSize: '2rem'
                      },
                      '& .MuiStepIcon-root.Mui-completed': { 
                        color: '#2e7d32',
                        fontSize: '2rem'
                      },
                    }}
                  >
                    {tasks.map((task, index) => (
                      <Step
                        key={task.TaskID}
                        completed={isTaskCompleted(task)}
                        onClick={() => handleStepClick(proj.ProjectID, index)}
                      >
                        <StepLabel 
                          StepIconProps={{
                            sx: {
                              '&:hover': { cursor: 'pointer' }
                            }
                          }}
                        >
                          {task.TaskName}
                        </StepLabel>
                      </Step>
                    ))}
                  </Stepper>

                  {tasks.map((task, index) => {
                    const isExpanded = expandedStepIndex[proj.ProjectID] === index;
                    if (!isExpanded) return null;

                    return (
                      <Paper
                        key={task.TaskID}
                        variant="outlined"
                        sx={{ 
                          p: 2, 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          mb: 2,
                          borderColor: '#e0e0e0'
                        }}
                      >
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          mb: 2,
                          bgcolor: '#f8f9fa',
                          p: 1.5,
                          borderRadius: '6px'
                        }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {task.TaskName} Subtasks
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleStepClick(proj.ProjectID, index)}
                            sx={{ color: '#6b778c' }}
                          >
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>
                        <Table size="small" sx={{ border: '1px solid #f0f0f0' }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                              <TableCell sx={{ width: '40%', fontWeight: 600 }}>Subtask</TableCell>
                              <TableCell sx={{ width: '20%', fontWeight: 600 }}>Due Date</TableCell>
                              <TableCell sx={{ width: '20%', fontWeight: 600 }}>Status</TableCell>
                              <TableCell sx={{ width: '20%', fontWeight: 600 }}>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(task.SubTasks || []).map((sub) => (
                              <React.Fragment key={sub.SubTaskID}>
                                <TableRow hover sx={{ '&:hover': { bgcolor: '#f8f9fa' } }}>
                                  <TableCell sx={{ color: '#1a237e' }}>{sub.SubTaskName}</TableCell>
                                  <TableCell>{dayjs(sub.DueDate).format('MMM D, YYYY')}</TableCell>
                                  <TableCell>
                                    <Chip
                                      icon={getSubTaskStatusIcon(sub.Status)}
                                      label={sub.Status}
                                      size="small"
                                      sx={{
                                        bgcolor: '#f5f7fb',
                                        color: '#1a237e',
                                        borderRadius: '4px',
                                        '& .MuiChip-icon': { 
        ml: 1,
        fontSize: '1rem' // Add this to match legend icon size
      }
    }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                      <Tooltip title="Request Support">
                                        <IconButton
                                          size="small"
                                          onClick={() => setSupportModalOpen({
                                            project: proj,
                                            task,
                                            subTask: sub
                                          })}
                                          sx={{ 
                                            color: '#1976d2',
                                            '&:hover': { bgcolor: '#e3f2fd' }
                                          }}
                                        >
                                          <HelpOutlineIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Support History">
                                        <IconButton 
                                          size="small" 
                                          onClick={() => toggleSupportHistory(sub.SubTaskID)}
                                          sx={{ 
                                            color: '#6b778c',
                                            '&:hover': { bgcolor: '#f5f5f5' }
                                          }}
                                        >
                                          {expandedSupportRequests.includes(sub.SubTaskID) ? 
                                            <ExpandLessIcon /> : 
                                            <ExpandMoreIcon />}
                                        </IconButton>
                                      </Tooltip>
                                    </Box>
                                  </TableCell>
                                </TableRow>

                                {expandedSupportRequests.includes(sub.SubTaskID) && (
  <TableRow>
    <TableCell colSpan={4} sx={{ p: 0 }}>
      <Box sx={{ 
        maxWidth: '95%',
        ml: 2,
        mb: 2,
        pt: 2,  // Added top padding
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <Paper 
          variant="outlined" 
          sx={{ 
            borderColor: '#e0e0e0',
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ 
                bgcolor: '#f8f9fa',
                '& th': { 
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: '#1a237e'
                }
              }}>
                <TableCell sx={{ width: '60%', pl: 4 }}>Support Note</TableCell>
                <TableCell sx={{ width: '20%' }}>Status</TableCell>
                <TableCell sx={{ width: '20%' }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(supportHistory[sub.SubTaskID] || []).map((request) => (
                <TableRow 
                  key={request.RequestID}
                  sx={{ '&:last-child td': { borderBottom: 0 } }}
                >
                  <TableCell sx={{ 
                    whiteSpace: 'normal',
                    wordWrap: 'break-word',
                    fontSize: '0.875rem',
                    pl: 4  // Added left padding to align with header
                  }}>
                    {request.Question}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={request.Status} 
                      color={request.Status === 'Completed' ? 'success' : 'primary'}
                      size="small"
                      sx={{
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        height: '24px'
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.875rem' }}>
                    {dayjs(request.CreatedDate).format('MMM D, YYYY')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </TableCell>
  </TableRow>
)}
                              </React.Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </Paper>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {supportModalOpen && (
        <SupportRequestModal
          open={!!supportModalOpen}
          onClose={() => setSupportModalOpen(null)}
          project={supportModalOpen.project}
          task={supportModalOpen.task}
          subTask={supportModalOpen.subTask}
          consultants={consultants}
          onSubmitSuccess={handleSupportSubmit}
        />
      )}
    </Box>
  );
};

export default ReportsPage;