import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Chip,
  Paper,
  CircularProgress,
} from '@mui/material';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: 'P0', label: 'P0 — Critical' },
  { value: 'P1', label: 'P1 — High' },
  { value: 'P2', label: 'P2 — Medium' },
  { value: 'P3', label: 'P3 — Low' },
];

function fmtDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

function statusChipColor(status) {
  switch (status) {
    case 'open':
      return 'default';
    case 'in_progress':
      return 'info';
    case 'blocked':
      return 'warning';
    case 'resolved':
      return 'success';
    case 'closed':
      return 'default';
    default:
      return 'default';
  }
}

export default function TicketDetailDrawer({
  open,
  onClose,
  ticket,
  loading = false,
  users = [],
  isPrivileged,
  onUpdateTicket,
  onAddComment,
  onAddWorkLog,
  onUploadAttachments,
  onDownloadAttachment,
}) {
  const [status, setStatus] = useState(ticket?.Status || 'open');
  const [priority, setPriority] = useState(ticket?.Priority || 'P2');
  const [assignedTo, setAssignedTo] = useState(ticket?.AssignedToUserID || '');
  const [resolution, setResolution] = useState(ticket?.ResolutionSummary || '');
  const [comment, setComment] = useState('');
  const [workMinutes, setWorkMinutes] = useState(30);
  const [workNote, setWorkNote] = useState('');
  const [newFiles, setNewFiles] = useState([]);

  // keep local state in sync when switching tickets
  React.useEffect(() => {
    setStatus(ticket?.Status || 'open');
    setPriority(ticket?.Priority || 'P2');
    setAssignedTo(ticket?.AssignedToUserID || '');
    setResolution(ticket?.ResolutionSummary || '');
    setComment('');
    setWorkMinutes(30);
    setWorkNote('');
    setNewFiles([]);
  }, [ticket?.TicketID]);

  const createdAge = useMemo(() => {
    if (!ticket?.CreatedAt) return '—';
    const created = new Date(ticket.CreatedAt);
    const now = new Date();
    const mins = Math.max(0, Math.round((now - created) / 60000));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs < 48) return `${hrs}h ${rem}m`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }, [ticket?.CreatedAt]);

  const attachments = ticket?.attachments || [];
  const comments = ticket?.comments || [];
  const workLogs = ticket?.workLogs || [];

  const assignedUserLabel = useMemo(() => {
    const u = users.find((x) => x.UserID === ticket?.AssignedToUserID);
    return u ? `${u.FirstName || ''} ${u.LastName || ''}`.trim() : '—';
  }, [users, ticket?.AssignedToUserID]);

  const handleSave = async () => {
    if (!ticket?.TicketID) return;
    await onUpdateTicket(ticket.TicketID, {
      status,
      priority,
      assignedToUserID: assignedTo || null,
      resolutionSummary: resolution || null,
    });
  };

  const handleAddComment = async () => {
    if (!ticket?.TicketID || !comment.trim()) return;
    await onAddComment(ticket.TicketID, comment.trim());
    setComment('');
  };

  const handleAddWorkLog = async () => {
    if (!ticket?.TicketID) return;
    const mins = Number(workMinutes);
    if (!Number.isFinite(mins) || mins <= 0) return;
    await onAddWorkLog(ticket.TicketID, mins, workNote.trim() || null);
    setWorkNote('');
  };

  const handleUpload = async () => {
    if (!ticket?.TicketID || newFiles.length === 0) return;
    await onUploadAttachments(ticket.TicketID, newFiles);
    setNewFiles([]);
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 720 } } }}>
      <Box p={2} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h6">Ticket</Typography>
          {ticket && <Typography variant="caption" color="text.secondary">ID: {ticket.TicketID}</Typography>}
        </Box>
        <Button onClick={onClose}>Close</Button>
      </Box>

      <Divider />

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress />
        </Box>
      ) : !ticket ? (
        <Box p={3}>
          <Typography variant="body1" color="text.secondary">
            No ticket selected or ticket not found.
          </Typography>
        </Box>
      ) : (

      <Box p={2}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{ticket.Title}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={1} flexWrap="wrap">
              <Chip size="small" label={ticket.Category} />
              <Chip size="small" label={ticket.Priority} />
              <Chip size="small" label={ticket.Status} color={statusChipColor(ticket.Status)} />
              <Typography variant="caption" color="text.secondary">Age: {createdAge}</Typography>
              <Typography variant="caption" color="text.secondary">Created: {fmtDate(ticket.CreatedAt)}</Typography>
            </Stack>
          </Box>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Description</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ticket.Description}</Typography>
          </Paper>

          {(ticket.StepsToReproduce || ticket.ExpectedBehavior || ticket.ActualBehavior) && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Repro / Expected / Actual</Typography>
              {ticket.StepsToReproduce && (
                <Box mb={1}>
                  <Typography variant="caption" color="text.secondary">Steps</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ticket.StepsToReproduce}</Typography>
                </Box>
              )}
              {ticket.ExpectedBehavior && (
                <Box mb={1}>
                  <Typography variant="caption" color="text.secondary">Expected</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ticket.ExpectedBehavior}</Typography>
                </Box>
              )}
              {ticket.ActualBehavior && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Actual</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{ticket.ActualBehavior}</Typography>
                </Box>
              )}
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Context</Typography>
            <Typography variant="body2"><b>Page:</b> {ticket.AffectedPage || '—'}</Typography>
            <Typography variant="body2"><b>Feature:</b> {ticket.AffectedFeature || '—'}</Typography>
            <Typography variant="body2"><b>Environment:</b> {ticket.Environment || '—'}</Typography>
            <Typography variant="body2"><b>Browser:</b> {ticket.BrowserInfo || '—'}</Typography>
            <Typography variant="body2"><b>App Version:</b> {ticket.AppVersion || '—'}</Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Assignment & Status</Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth disabled={!isPrivileged}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={!isPrivileged}>
                <InputLabel>Priority</InputLabel>
                <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={!isPrivileged}>
                <InputLabel>Assigned To</InputLabel>
                <Select label="Assigned To" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                  <MenuItem value="">Unassigned</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.UserID} value={u.UserID}>
                      {`${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Box mt={2}>
              <TextField
                fullWidth
                label="Resolution Summary"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                multiline
                minRows={2}
                disabled={!isPrivileged}
              />
            </Box>

            <Box display="flex" justifyContent="flex-end" mt={2}>
              <Button variant="contained" onClick={handleSave} disabled={!isPrivileged}>
                Save Changes
              </Button>
            </Box>

            {!isPrivileged && (
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Assigned to: {assignedUserLabel}
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Attachments</Typography>
            <Stack spacing={1}>
              {attachments.length === 0 && <Typography variant="body2" color="text.secondary">No attachments</Typography>}
              {attachments.map((a) => (
                <Box key={a.AttachmentID} display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{a.FileName}</Typography>
                  <Button size="small" variant="outlined" onClick={() => onDownloadAttachment(ticket.TicketID, a)}>
                    Download
                  </Button>
                </Box>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
              <Button variant="outlined" component="label">
                Add Attachment(s)
                <input
                  hidden
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.csv"
                  onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
                />
              </Button>
              <Typography variant="caption" color="text.secondary">
                {newFiles.length > 0 ? `${newFiles.length} file(s) selected` : 'PNG/JPG/PDF/TXT/CSV'}
              </Typography>
              <Box flexGrow={1} />
              <Button variant="contained" onClick={handleUpload} disabled={newFiles.length === 0}>
                Upload
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Comments</Typography>
            <Stack spacing={1}>
              {comments.length === 0 && <Typography variant="body2" color="text.secondary">No comments yet.</Typography>}
              {comments.map((c) => (
                <Paper key={c.CommentID} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {fmtDate(c.CreatedAt)} • {c.CreatedByName || c.CreatedByUserID}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.Body}</Typography>
                </Paper>
              ))}
            </Stack>
            <Box mt={2}>
              <TextField
                fullWidth
                label="Add a comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                multiline
                minRows={2}
              />
              <Box display="flex" justifyContent="flex-end" mt={1}>
                <Button variant="contained" onClick={handleAddComment} disabled={!comment.trim()}>
                  Post Comment
                </Button>
              </Box>
            </Box>
          </Paper>

          {isPrivileged && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Work Logs</Typography>
              <Stack spacing={1}>
                {workLogs.length === 0 && <Typography variant="body2" color="text.secondary">No work logs</Typography>}
                {workLogs.map((w) => (
                  <Paper key={w.WorkLogID} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(w.CreatedAt)} • {w.Minutes} mins • {w.CreatedByName || w.CreatedByUserID}
                    </Typography>
                    {w.Note && <Typography variant="body2">{w.Note}</Typography>}
                  </Paper>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                <TextField
                  label="Minutes"
                  type="number"
                  value={workMinutes}
                  onChange={(e) => setWorkMinutes(Number(e.target.value))}
                  sx={{ width: 140 }}
                />
                <TextField
                  label="Note (optional)"
                  value={workNote}
                  onChange={(e) => setWorkNote(e.target.value)}
                  fullWidth
                />
                <Button variant="contained" onClick={handleAddWorkLog}>
                  Log Work
                </Button>
              </Stack>
            </Paper>
          )}

          <Box pb={4} />
        </Stack>
      </Box>
      )}
    </Drawer>
  );
}

