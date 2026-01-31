import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import {
  getStages,
  updateStage,
  getLeadSources,
  createLeadSource,
  updateLeadSource,
  deleteLeadSource,
  getCannedReplies,
  createCannedReply,
  updateCannedReply,
  deleteCannedReply,
  getRepGoals,
  getOrCreateRepGoal,
  updateRepGoal,
} from '../../../api/crmSettings';
import { getActiveConsultants } from '../../../api/consultants';

const CRMSettings = () => {
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Stages state
  const [stages, setStages] = useState({ sales: [], sell: [], buy: [] });
  const [selectedModule, setSelectedModule] = useState('sales');
  
  // Lead Sources state
  const [leadSources, setLeadSources] = useState([]);
  const [leadSourceDialog, setLeadSourceDialog] = useState({ open: false, editing: null });
  const [newLeadSource, setNewLeadSource] = useState('');
  
  // Canned Replies state
  const [cannedReplies, setCannedReplies] = useState([]);
  const [cannedReplyDialog, setCannedReplyDialog] = useState({ open: false, editing: null });
  const [cannedReplyForm, setCannedReplyForm] = useState({ Title: '', Content: '', Category: '' });
  
  // Rep Goals state
  const [consultants, setConsultants] = useState([]);
  const [repGoals, setRepGoals] = useState({});
  const repGoalsRef = useRef({});
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedConsultant, setSelectedConsultant] = useState('');
  
  // Keep ref in sync with state
  useEffect(() => {
    repGoalsRef.current = repGoals;
  }, [repGoals]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [salesStages, sellStages, buyStages, sources, replies, consultantsData] = await Promise.all([
        getStages('sales'),
        getStages('sell'),
        getStages('buy'),
        getLeadSources(),
        getCannedReplies(),
        getActiveConsultants(),
      ]);
      
      setStages({ sales: salesStages || [], sell: sellStages || [], buy: buyStages || [] });
      setLeadSources(sources || []);
      setCannedReplies(replies || []);
      setConsultants(consultantsData || []);
      
      // Load goals for current period
      await loadRepGoals();
    } catch (error) {
      console.error('Error loading settings data:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load settings data',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRepGoals = async () => {
    try {
      // Load goals for all periods, not just selected period
      const goals = await getRepGoals({});
      const goalsMap = {};
      goals.forEach(goal => {
        if (!goalsMap[goal.ConsultantID]) {
          goalsMap[goal.ConsultantID] = {};
        }
        goalsMap[goal.ConsultantID][goal.PeriodType] = goal;
      });
      setRepGoals(goalsMap);
    } catch (error) {
      console.error('Error loading rep goals:', error);
    }
  };

  useEffect(() => {
    if (selectedPeriod) {
      loadRepGoals();
    }
  }, [selectedPeriod]);

  // ========== STAGE CONFIGURATION ==========
  const handleStageUpdate = async (stageId, field, value) => {
    try {
      const stage = stages.sales.find(s => s.StageID === stageId) ||
                   stages.sell.find(s => s.StageID === stageId) ||
                   stages.buy.find(s => s.StageID === stageId);
      
      if (!stage) return;
      
      // Probability is stored as 0-100 in database, not 0-1
      const updateData = {
        ...stage,
        [field]: field === 'Probability' ? parseFloat(value) : parseInt(value),
      };
      
      await updateStage(stageId, updateData);
      
      // Update local state
      const module = stage.Module;
      setStages(prev => ({
        ...prev,
        [module]: prev[module].map(s => s.StageID === stageId ? { ...s, ...updateData } : s),
      }));
      
      setSnackbar({
        open: true,
        message: 'Stage updated successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error updating stage:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update stage',
        severity: 'error',
      });
    }
  };

  // Debounced version of handleStageUpdate
  const debouncedStageUpdate = useDebouncedCallback(
    async (stageId, field, value) => {
      await handleStageUpdate(stageId, field, value);
    },
    600 // 600ms delay
  );

  // Optimistic update handler that updates local state immediately and debounces API call
  const handleStageChange = (stageId, field, value) => {
    const stage = stages.sales.find(s => s.StageID === stageId) ||
                 stages.sell.find(s => s.StageID === stageId) ||
                 stages.buy.find(s => s.StageID === stageId);
    
    if (!stage) return;
    
    // Update local state immediately for better UX
    // Probability is stored as 0-100 in database
    const module = stage.Module;
    const updateData = {
      ...stage,
      [field]: field === 'Probability' ? parseFloat(value) : parseInt(value),
    };
    
    setStages(prev => ({
      ...prev,
      [module]: prev[module].map(s => s.StageID === stageId ? { ...s, ...updateData } : s),
    }));
    
    // Debounce the API call
    debouncedStageUpdate(stageId, field, value);
  };

  // ========== LEAD SOURCES ==========
  const handleAddLeadSource = async () => {
    if (!newLeadSource.trim()) return;
    
    try {
      const source = await createLeadSource({ SourceName: newLeadSource.trim() });
      setLeadSources([...leadSources, source]);
      setNewLeadSource('');
      setLeadSourceDialog({ open: false, editing: null });
      setSnackbar({
        open: true,
        message: 'Lead source added successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error adding lead source:', error);
      setSnackbar({
        open: true,
        message: 'Failed to add lead source',
        severity: 'error',
      });
    }
  };

  const handleDeleteLeadSource = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lead source?')) return;
    
    try {
      await deleteLeadSource(id);
      setLeadSources(leadSources.filter(s => s.LeadSourceID !== id));
      setSnackbar({
        open: true,
        message: 'Lead source deleted successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error deleting lead source:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete lead source',
        severity: 'error',
      });
    }
  };

  // ========== CANNED REPLIES ==========
  const handleOpenCannedReplyDialog = (reply = null) => {
    if (reply) {
      setCannedReplyForm({
        Title: reply.Title,
        Content: reply.Content,
        Category: reply.Category || '',
      });
      setCannedReplyDialog({ open: true, editing: reply });
    } else {
      setCannedReplyForm({ Title: '', Content: '', Category: '' });
      setCannedReplyDialog({ open: true, editing: null });
    }
  };

  const handleSaveCannedReply = async () => {
    if (!cannedReplyForm.Title.trim() || !cannedReplyForm.Content.trim()) {
      setSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        severity: 'error',
      });
      return;
    }
    
    try {
      if (cannedReplyDialog.editing) {
        const updated = await updateCannedReply(cannedReplyDialog.editing.CannedReplyID, cannedReplyForm);
        setCannedReplies(cannedReplies.map(r => 
          r.CannedReplyID === updated.CannedReplyID ? updated : r
        ));
        setSnackbar({
          open: true,
          message: 'Canned reply updated successfully',
          severity: 'success',
        });
      } else {
        const created = await createCannedReply(cannedReplyForm);
        setCannedReplies([...cannedReplies, created]);
        setSnackbar({
          open: true,
          message: 'Canned reply created successfully',
          severity: 'success',
        });
      }
      setCannedReplyDialog({ open: false, editing: null });
      setCannedReplyForm({ Title: '', Content: '', Category: '' });
    } catch (error) {
      console.error('Error saving canned reply:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save canned reply',
        severity: 'error',
      });
    }
  };

  const handleDeleteCannedReply = async (id) => {
    if (!window.confirm('Are you sure you want to delete this canned reply?')) return;
    
    try {
      await deleteCannedReply(id);
      setCannedReplies(cannedReplies.filter(r => r.CannedReplyID !== id));
      setSnackbar({
        open: true,
        message: 'Canned reply deleted successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error deleting canned reply:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete canned reply',
        severity: 'error',
      });
    }
  };

  // ========== REP GOALS ==========
  // Debounced update function - use useDebouncedCallback directly
  const debouncedGoalUpdate = useDebouncedCallback(
    async (consultantId, field, value, period) => {
      try {
        // Get latest state from ref
        const latestGoals = repGoalsRef.current;
        let goalToUpdate = latestGoals[consultantId]?.[period];
        
        // If goal doesn't exist or doesn't have GoalID, create it first
        if (!goalToUpdate || !goalToUpdate.GoalID) {
          const today = new Date();
          const periodStart = today.toISOString().split('T')[0];
          const periodEnd = today.toISOString().split('T')[0];
          
          const newGoal = await getOrCreateRepGoal(
            consultantId,
            period,
            periodStart,
            periodEnd
          );
          
          goalToUpdate = newGoal;
          
          // Update local state with the created goal
          setRepGoals(prev => ({
            ...prev,
            [consultantId]: {
              ...prev[consultantId],
              [period]: newGoal,
            },
          }));
        }
        
        // Get the latest state again (in case user kept typing)
        const currentGoals = repGoalsRef.current;
        const latestGoal = currentGoals[consultantId]?.[period] || goalToUpdate;
        
        // Build update data with latest values
        const updateData = {
          CallsBooked: latestGoal.CallsBooked || 0,
          CallsAttended: latestGoal.CallsAttended || 0,
          QuotesSent: latestGoal.QuotesSent || 0,
          TotalQuoteValue: latestGoal.TotalQuoteValue || 0,
          AvgQuoteValue: latestGoal.AvgQuoteValue || 0,
          ClosedWon: latestGoal.ClosedWon || 0,
          [field]: parseFloat(value) || 0,
        };
        
        // Update the goal
        const updatedGoal = await updateRepGoal(goalToUpdate.GoalID, updateData);
        
        // Update local state only if the field value matches (user didn't change it)
        setRepGoals(prev => {
          const currentValue = prev[consultantId]?.[period]?.[field];
          // Only update if the value matches what we saved, or if it's undefined
          if (currentValue === parseFloat(value) || currentValue === undefined) {
            return {
              ...prev,
              [consultantId]: {
                ...prev[consultantId],
                [period]: updatedGoal,
              },
            };
          }
          // User changed the value while we were saving, don't overwrite
          return prev;
        });
      } catch (error) {
        console.error('Error updating goal:', error);
        setSnackbar({
          open: true,
          message: 'Failed to update goal',
          severity: 'error',
        });
      }
    },
    600 // 600ms delay
  );

  // Optimistic update handler that updates local state immediately and debounces API call
  const handleGoalChange = (consultantId, field, value) => {
    const numValue = parseFloat(value) || 0;
    const currentPeriod = selectedPeriod; // Capture current period
    
    // Update local state immediately for better UX
    setRepGoals(prev => {
      const goal = prev[consultantId]?.[currentPeriod];
      const updatedGoal = {
        ...goal,
        ConsultantID: consultantId,
        PeriodType: currentPeriod,
        CallsBooked: goal?.CallsBooked || 0,
        CallsAttended: goal?.CallsAttended || 0,
        QuotesSent: goal?.QuotesSent || 0,
        TotalQuoteValue: goal?.TotalQuoteValue || 0,
        AvgQuoteValue: goal?.AvgQuoteValue || 0,
        ClosedWon: goal?.ClosedWon || 0,
        [field]: numValue,
      };
      
      const newState = {
        ...prev,
        [consultantId]: {
          ...prev[consultantId],
          [currentPeriod]: updatedGoal,
        },
      };
      
      // Update ref immediately so debounced callback has latest values
      repGoalsRef.current = newState;
      
      return newState;
    });
    
    // Debounce the API call - pass period as parameter to avoid stale closure
    debouncedGoalUpdate(consultantId, field, value, currentPeriod);
  };

  const getGoalValue = (consultantId, field) => {
    const goal = repGoals[consultantId]?.[selectedPeriod];
    return goal ? goal[field] || 0 : 0;
  };

  if (loading) {
    return <Typography>Loading settings...</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Stage Configuration */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Stage Configuration</Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Module</InputLabel>
              <Select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                label="Module"
              >
                <MenuItem value="sales">Sales CRM</MenuItem>
                <MenuItem value="sell">M&A Sell-Side</MenuItem>
                <MenuItem value="buy">M&A Buy-Side</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Grid container spacing={2}>
            {stages[selectedModule]?.map(stage => (
              <Grid item xs={12} sm={6} md={3} key={stage.StageID}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                    {stage.StageName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                      label="Probability (%)"
                      type="number"
                      size="small"
                      value={Math.round(stage.Probability)}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                        handleStageChange(stage.StageID, 'Probability', val);
                      }}
                      sx={{ width: 120 }}
                    />
                    <TextField
                      label="Stale (days)"
                      type="number"
                      size="small"
                      value={stage.StaleThresholdDays || ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                        handleStageChange(stage.StageID, 'StaleThresholdDays', val);
                      }}
                      sx={{ width: 120 }}
                    />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Lead Sources */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Lead Sources</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setLeadSourceDialog({ open: true, editing: null })}
            >
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {leadSources.map(source => (
              <Chip
                key={source.LeadSourceID}
                label={source.SourceName}
                onDelete={() => handleDeleteLeadSource(source.LeadSourceID)}
                sx={{ mb: 1 }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Canned Replies */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Canned Replies</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => handleOpenCannedReplyDialog()}
            >
              Add
            </Button>
          </Box>
          <Grid container spacing={2}>
            {cannedReplies.map(reply => (
              <Grid item xs={12} sm={6} key={reply.CannedReplyID}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {reply.Title}
                    </Typography>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenCannedReplyDialog(reply)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteCannedReply(reply.CannedReplyID)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {reply.Content}
                  </Typography>
                  {/* {reply.Category && (
                    <Chip label={reply.Category} size="small" sx={{ mt: 1 }} />
                  )} */}
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Targets & Goals */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Targets & Goals (per rep)</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Consultant</InputLabel>
                <Select
                  value={selectedConsultant}
                  onChange={(e) => setSelectedConsultant(e.target.value)}
                  label="Consultant"
                >
                  <MenuItem value="">Select Consultant</MenuItem>
                  {consultants.map(consultant => (
                    <MenuItem key={consultant.ConsultantID} value={consultant.ConsultantID}>
                      {consultant.FirstName} {consultant.LastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Period</InputLabel>
                <Select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  label="Period"
                >
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="quarterly">Quarterly</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          
          {selectedConsultant ? (
            <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={500} sx={{ mb: 2 }}>
                {consultants.find(c => c.ConsultantID === selectedConsultant)?.FirstName}{' '}
                {consultants.find(c => c.ConsultantID === selectedConsultant)?.LastName}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Meetings Booked"
                    type="number"
                    size="small"
                    fullWidth
                    value={getGoalValue(selectedConsultant, 'CallsBooked')}
                    onChange={(e) => handleGoalChange(selectedConsultant, 'CallsBooked', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Meetings Attended"
                    type="number"
                    size="small"
                    fullWidth
                    value={getGoalValue(selectedConsultant, 'CallsAttended')}
                    onChange={(e) => handleGoalChange(selectedConsultant, 'CallsAttended', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Quotes Sent"
                    type="number"
                    size="small"
                    fullWidth
                    value={getGoalValue(selectedConsultant, 'QuotesSent')}
                    onChange={(e) => handleGoalChange(selectedConsultant, 'QuotesSent', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Total Quote $"
                    type="number"
                    size="small"
                    fullWidth
                    value={getGoalValue(selectedConsultant, 'TotalQuoteValue')}
                    onChange={(e) => handleGoalChange(selectedConsultant, 'TotalQuoteValue', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Avg Quote $"
                    type="number"
                    size="small"
                    fullWidth
                    value={getGoalValue(selectedConsultant, 'AvgQuoteValue')}
                    onChange={(e) => handleGoalChange(selectedConsultant, 'AvgQuoteValue', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Closed Deals"
                    type="number"
                    size="small"
                    fullWidth
                    value={getGoalValue(selectedConsultant, 'ClosedWon')}
                    onChange={(e) => handleGoalChange(selectedConsultant, 'ClosedWon', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Please select a consultant to view and edit goals
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Lead Source Dialog */}
      <Dialog open={leadSourceDialog.open} onClose={() => setLeadSourceDialog({ open: false, editing: null })}>
        <DialogTitle>Add Lead Source</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Source Name"
            fullWidth
            value={newLeadSource}
            onChange={(e) => setNewLeadSource(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddLeadSource();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeadSourceDialog({ open: false, editing: null })}>Cancel</Button>
          <Button onClick={handleAddLeadSource} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      {/* Canned Reply Dialog */}
      <Dialog open={cannedReplyDialog.open} onClose={() => setCannedReplyDialog({ open: false, editing: null })} maxWidth="md" fullWidth>
        <DialogTitle>
          {cannedReplyDialog.editing ? 'Edit Canned Reply' : 'Add Canned Reply'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            required
            value={cannedReplyForm.Title}
            onChange={(e) => setCannedReplyForm({ ...cannedReplyForm, Title: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Content"
            fullWidth
            required
            multiline
            rows={6}
            value={cannedReplyForm.Content}
            onChange={(e) => setCannedReplyForm({ ...cannedReplyForm, Content: e.target.value })}
            sx={{ mb: 2 }}
          />
          {/* <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={cannedReplyForm.Category}
              onChange={(e) => setCannedReplyForm({ ...cannedReplyForm, Category: e.target.value })}
              label="Category"
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="prospect">Prospect</MenuItem>
              <MenuItem value="followup">Follow Up</MenuItem>
              <MenuItem value="quote">Quote</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl> */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCannedReplyDialog({ open: false, editing: null })}>Cancel</Button>
          <Button onClick={handleSaveCannedReply} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default CRMSettings;

