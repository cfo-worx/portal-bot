import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import dayjs from 'dayjs';
import {
  getWeeklyReviewSessions,
  getPriorWeekReviewSessions,
  upsertWeeklyReviewSession,
  deleteWeeklyReviewSession,
} from '../../../api/performanceReports';
import { getClients } from '../../../api/clients';
import { getActiveConsultants } from '../../../api/consultants';

const WeeklyReviewTab = ({ filters }) => {
  const [sessions, setSessions] = useState([]);
  const [clients, setClients] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [priorWeekSessions, setPriorWeekSessions] = useState([]);

  const weekStart = filters.startDate || dayjs().startOf('week').format('YYYY-MM-DD');
  const weekEnd = filters.endDate || dayjs().endOf('week').format('YYYY-MM-DD');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [sessionsData, clientsData, consultantsData, priorWeekData] = await Promise.all([
          getWeeklyReviewSessions(weekStart, weekEnd),
          getClients(),
          getActiveConsultants(),
          getPriorWeekReviewSessions(weekStart),
        ]);

        setSessions(sessionsData);
        setClients(clientsData || []);
        setConsultants(consultantsData || []);
        setPriorWeekSessions(priorWeekData || []);
      } catch (err) {
        setError(err.message || 'Failed to load weekly review sessions');
        console.error('Error loading weekly review sessions:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [weekStart, weekEnd]);

  const sessionsByEntity = useMemo(() => {
    const grouped = {
      general: [],
      clients: new Map(),
      consultants: new Map(),
    };

    for (const session of sessions) {
      if (!session.ClientID && !session.ConsultantID) {
        grouped.general.push(session);
      } else if (session.ClientID) {
        const clientId = session.ClientID;
        if (!grouped.clients.has(clientId)) {
          grouped.clients.set(clientId, []);
        }
        grouped.clients.get(clientId).push(session);
      } else if (session.ConsultantID) {
        const consultantId = session.ConsultantID;
        if (!grouped.consultants.has(consultantId)) {
          grouped.consultants.set(consultantId, []);
        }
        grouped.consultants.get(consultantId).push(session);
      }
    }

    return grouped;
  }, [sessions]);

  const handleAddSession = (clientId = null, consultantId = null) => {
    setSelectedSession({
      ReviewSessionID: null,
      WeekStartDate: weekStart,
      WeekEndDate: weekEnd,
      ClientID: clientId,
      ConsultantID: consultantId,
      Notes: '',
      ActionItems: '',
      Status: 'draft',
    });
    setEditDialogOpen(true);
  };

  const handleEditSession = (session) => {
    setSelectedSession({ ...session });
    setEditDialogOpen(true);
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this review session?')) {
      return;
    }

    try {
      await deleteWeeklyReviewSession(sessionId);
      setSessions(sessions.filter(s => s.ReviewSessionID !== sessionId));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete review session');
      console.error('Error deleting session:', err);
    }
  };

  const handleSaveSession = async () => {
    if (!selectedSession) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const saved = await upsertWeeklyReviewSession(selectedSession);
      
      if (selectedSession.ReviewSessionID) {
        setSessions(sessions.map(s => s.ReviewSessionID === saved.ReviewSessionID ? saved : s));
      } else {
        setSessions([...sessions, saved]);
      }

      setEditDialogOpen(false);
      setSelectedSession(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save review session');
      console.error('Error saving session:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCarryForward = async (priorSession) => {
    const newSession = {
      ReviewSessionID: null,
      WeekStartDate: weekStart,
      WeekEndDate: weekEnd,
      ClientID: priorSession.ClientID,
      ConsultantID: priorSession.ConsultantID,
      Notes: priorSession.Notes || '',
      ActionItems: priorSession.ActionItems || '',
      Status: 'draft',
      CarriedForwardFromSessionID: priorSession.ReviewSessionID,
    };

    setSelectedSession(newSession);
    setEditDialogOpen(true);
  };

  const getClientName = (clientId) => {
    return clients.find(c => c.ClientID === clientId)?.ClientName || 'Unknown Client';
  };

  const getConsultantName = (consultantId) => {
    const consultant = consultants.find(c => c.ConsultantID === consultantId);
    return consultant ? `${consultant.FirstName} ${consultant.LastName}` : 'Unknown Consultant';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Weekly Review Sessions (CFO Meeting Workflow)
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleAddSession()}
          >
            Add General Notes
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Week: {weekStart} to {weekEnd}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Review session saved successfully
          </Alert>
        )}

        {/* Prior week carry-forward section */}
        {priorWeekSessions.length > 0 && (
          <Box sx={{ mt: 3, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Carry Forward from Prior Week
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {priorWeekSessions.map((session) => (
                <Chip
                  key={session.ReviewSessionID}
                  label={
                    session.ClientName 
                      ? `Client: ${session.ClientName}`
                      : session.ConsultantName
                      ? `Consultant: ${session.ConsultantName}`
                      : 'General Notes'
                  }
                  onClick={() => handleCarryForward(session)}
                  color="primary"
                  variant="outlined"
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* General notes */}
        {sessionsByEntity.general.length > 0 && (
          <Accordion defaultExpanded sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>General Notes</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {sessionsByEntity.general.map((session) => (
                <Paper key={session.ReviewSessionID} sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip label={session.Status} size="small" />
                    <Box>
                      <IconButton size="small" onClick={() => handleEditSession(session)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteSession(session.ReviewSessionID)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  {session.Notes && (
                    <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                      {session.Notes}
                    </Typography>
                  )}
                  {session.ActionItems && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Action Items:
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {session.ActionItems}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              ))}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Client-specific sessions */}
        {Array.from(sessionsByEntity.clients.entries()).map(([clientId, clientSessions]) => (
          <Accordion key={clientId} sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600 }}>{getClientName(clientId)}</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddSession(clientId, null);
                  }}
                >
                  Add Notes
                </Button>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {clientSessions.map((session) => (
                <Paper key={session.ReviewSessionID} sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip label={session.Status} size="small" />
                    <Box>
                      <IconButton size="small" onClick={() => handleEditSession(session)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteSession(session.ReviewSessionID)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  {session.Notes && (
                    <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                      {session.Notes}
                    </Typography>
                  )}
                  {session.ActionItems && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Action Items:
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {session.ActionItems}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              ))}
            </AccordionDetails>
          </Accordion>
        ))}

        {/* Consultant-specific sessions */}
        {Array.from(sessionsByEntity.consultants.entries()).map(([consultantId, consultantSessions]) => (
          <Accordion key={consultantId} sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600 }}>{getConsultantName(consultantId)}</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddSession(null, consultantId);
                  }}
                >
                  Add Notes
                </Button>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {consultantSessions.map((session) => (
                <Paper key={session.ReviewSessionID} sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip label={session.Status} size="small" />
                    <Box>
                      <IconButton size="small" onClick={() => handleEditSession(session)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteSession(session.ReviewSessionID)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  {session.Notes && (
                    <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                      {session.Notes}
                    </Typography>
                  )}
                  {session.ActionItems && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Action Items:
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {session.ActionItems}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              ))}
            </AccordionDetails>
          </Accordion>
        ))}

        {sessions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No review sessions for this week. Click "Add General Notes" to get started.
          </Typography>
        )}
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedSession?.ReviewSessionID ? 'Edit Review Session' : 'New Review Session'}
        </DialogTitle>
        <DialogContent>
          {selectedSession && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={selectedSession.Status || 'draft'}
                    label="Status"
                    onChange={(e) => setSelectedSession({ ...selectedSession, Status: e.target.value })}
                  >
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="reviewed">Reviewed</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {/* Optional consultant association (requested in UX review) */}
              {!selectedSession.ClientID && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Consultant (optional)</InputLabel>
                    <Select
                      value={selectedSession.ConsultantID || ''}
                      label="Consultant (optional)"
                      onChange={(e) => setSelectedSession({ ...selectedSession, ConsultantID: e.target.value || null })}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {consultants
                        .slice()
                        .sort((a, b) => (`${a.FirstName || ''} ${a.LastName || ''}`.trim()).localeCompare((`${b.FirstName || ''} ${b.LastName || ''}`.trim())))
                        .map((c) => (
                          <MenuItem key={c.ConsultantID} value={c.ConsultantID}>
                            {`${c.FirstName || ''} ${c.LastName || ''}`.trim()}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  minRows={6}
                  value={selectedSession.Notes || ''}
                  onChange={(e) => setSelectedSession({ ...selectedSession, Notes: e.target.value })}
                  placeholder="Enter review notes..."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Action Items"
                  multiline
                  minRows={4}
                  value={selectedSession.ActionItems || ''}
                  onChange={(e) => setSelectedSession({ ...selectedSession, ActionItems: e.target.value })}
                  placeholder="Enter action items..."
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveSession} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WeeklyReviewTab;

