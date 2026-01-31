import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  createSpace,
  createTask,
  getSpace,
  listSpaces,
  listTasks,
  updateTask,
} from '../../api/collaboration';

function toLocalDateInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function CollaborationPage() {
  const [spaces, setSpaces] = useState([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [spaceDetail, setSpaceDetail] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const [newSpace, setNewSpace] = useState({ name: '', description: '', isPrivate: true });
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'Operations',
    priority: 'Medium',
    status: 'Open',
    dueDate: '',
    clientId: '',
    contractId: '',
    projectId: '',
    assignedToUserId: '',
  });

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const s = await listSpaces();
      setSpaces(s);
      if (!selectedSpaceId && s.length) setSelectedSpaceId(s[0].SpaceID);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load collaboration spaces');
    } finally {
      setLoading(false);
    }
  };

  const refreshSpace = async (spaceId) => {
    if (!spaceId) return;
    setLoading(true);
    setError('');
    try {
      const d = await getSpace(spaceId);
      setSpaceDetail(d);
      const t = await listTasks({ spaceId });
      setTasks(t);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load space');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSpaceId) refreshSpace(selectedSpaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpaceId]);

  const columns = useMemo(
    () => [
      { field: 'Title', headerName: 'Task', flex: 1, minWidth: 220 },
      { field: 'Status', headerName: 'Status', width: 120 },
      { field: 'Priority', headerName: 'Priority', width: 120 },
      { field: 'Category', headerName: 'Category', width: 160 },
      {
        field: 'DueDate',
        headerName: 'Due',
        width: 130,
        valueGetter: (p) => (p.row.DueDate ? new Date(p.row.DueDate).toLocaleDateString() : ''),
      },
      {
        field: 'ClientID',
        headerName: 'ClientID',
        width: 130,
      },
    ],
    []
  );

  const statusChip = (s) => {
    const color = s === 'Done' ? 'success' : s === 'Blocked' ? 'warning' : s === 'In Progress' ? 'info' : 'default';
    return <Chip size="small" label={s} color={color} variant={color === 'default' ? 'outlined' : 'filled'} />;
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Collaboration</Typography>
          <Typography variant="body2" color="text.secondary">Spaces + lightweight task tracker (management-only)</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setCreateSpaceOpen(true)}>New Space</Button>
          <Button variant="contained" onClick={() => setCreateTaskOpen(true)} disabled={!selectedSpaceId}>New Task</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Spaces</Typography>
              <Stack spacing={1}>
                {spaces.map((s) => (
                  <Button
                    key={s.SpaceID}
                    onClick={() => setSelectedSpaceId(s.SpaceID)}
                    variant={selectedSpaceId === s.SpaceID ? 'contained' : 'outlined'}
                    fullWidth
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <span style={{ textAlign: 'left' }}>{s.Name}</span>
                    {s.IsPrivate ? <Chip size="small" label="Private" /> : <Chip size="small" label="Shared" />}
                  </Button>
                ))}
                {!spaces.length && <Typography variant="body2" color="text.secondary">No spaces yet.</Typography>}
              </Stack>
            </CardContent>
          </Card>

          {spaceDetail && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700}>{spaceDetail.space?.Name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{spaceDetail.space?.Description || '—'}</Typography>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">Members</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {(spaceDetail.members || []).map((m) => (
                    <Chip key={m.UserID} size="small" label={`${m.FirstName || ''} ${m.LastName || ''}`.trim() || m.Email} />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid item xs={12} md={9}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Tasks</Typography>
              <div style={{ height: 520, width: '100%' }}>
                <DataGrid
                  rows={tasks.map((t) => ({ id: t.TaskID, ...t }))}
                  columns={columns}
                  loading={loading}
                  pageSizeOptions={[10, 25, 50]}
                  disableRowSelectionOnClick
                  onRowDoubleClick={async (params) => {
                    const row = params.row;
                    const next = row.Status === 'Done' ? 'Open' : 'Done';
                    try {
                      await updateTask(row.TaskID, { status: next });
                      await refreshSpace(selectedSpaceId);
                    } catch (e) {
                      setError(e?.response?.data?.message || e.message || 'Failed to update task');
                    }
                  }}
                  getRowHeight={() => 'auto'}
                  slots={{
                    noRowsOverlay: () => <Box sx={{ p: 2, color: 'text.secondary' }}>No tasks yet.</Box>,
                  }}
                />
              </div>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Double-click a row to toggle Done/Open (placeholder UX).
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {['Open', 'In Progress', 'Blocked', 'Done'].map((s) => (
                  <span key={s}>{statusChip(s)}</span>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create Space */}
      <Dialog open={createSpaceOpen} onClose={() => setCreateSpaceOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Collaboration Space</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={newSpace.name} onChange={(e) => setNewSpace((s) => ({ ...s, name: e.target.value }))} fullWidth />
            <TextField label="Description" value={newSpace.description} onChange={(e) => setNewSpace((s) => ({ ...s, description: e.target.value }))} fullWidth multiline minRows={3} />
            <FormControl fullWidth>
              <InputLabel>Privacy</InputLabel>
              <Select label="Privacy" value={newSpace.isPrivate ? 'private' : 'shared'} onChange={(e) => setNewSpace((s) => ({ ...s, isPrivate: e.target.value === 'private' }))}>
                <MenuItem value="private">Private (members-only)</MenuItem>
                <MenuItem value="shared">Shared (visible to all managers/admins)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateSpaceOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                const created = await createSpace({ name: newSpace.name, description: newSpace.description, isPrivate: newSpace.isPrivate });
                setCreateSpaceOpen(false);
                setNewSpace({ name: '', description: '', isPrivate: true });
                await refresh();
                setSelectedSpaceId(created.SpaceID);
              } catch (e) {
                setError(e?.response?.data?.message || e.message || 'Failed to create space');
              }
            }}
            disabled={!newSpace.name}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Task */}
      <Dialog open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Task</DialogTitle>
        <DialogContent>
          {!selectedSpaceId && <Alert severity="warning" sx={{ mb: 2 }}>Select a space first.</Alert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField label="Title" value={newTask.title} onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Due Date" type="date" value={newTask.dueDate} onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" value={newTask.description} onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))} fullWidth multiline minRows={3} />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={newTask.status} onChange={(e) => setNewTask((t) => ({ ...t, status: e.target.value }))}>
                  {['Open', 'In Progress', 'Blocked', 'Done'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select label="Priority" value={newTask.priority} onChange={(e) => setNewTask((t) => ({ ...t, priority: e.target.value }))}>
                  {['Low', 'Medium', 'High', 'Urgent'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select label="Category" value={newTask.category} onChange={(e) => setNewTask((t) => ({ ...t, category: e.target.value }))}>
                  {['Operations', 'Finance', 'HR', 'IT', 'Marketing', 'Sales', 'Vendors', 'Client Follow-up'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="ClientID (optional)" value={newTask.clientId} onChange={(e) => setNewTask((t) => ({ ...t, clientId: e.target.value }))} fullWidth />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="ContractID (optional)" value={newTask.contractId} onChange={(e) => setNewTask((t) => ({ ...t, contractId: e.target.value }))} fullWidth />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="ProjectID (optional)" value={newTask.projectId} onChange={(e) => setNewTask((t) => ({ ...t, projectId: e.target.value }))} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Assign To UserID (optional)" value={newTask.assignedToUserId} onChange={(e) => setNewTask((t) => ({ ...t, assignedToUserId: e.target.value }))} fullWidth />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                await createTask({
                  spaceId: selectedSpaceId,
                  title: newTask.title,
                  description: newTask.description,
                  category: newTask.category,
                  priority: newTask.priority,
                  status: newTask.status,
                  dueDate: newTask.dueDate || null,
                  clientId: newTask.clientId || null,
                  contractId: newTask.contractId || null,
                  projectId: newTask.projectId || null,
                  assignedToUserId: newTask.assignedToUserId || null,
                });
                setCreateTaskOpen(false);
                setNewTask({
                  title: '',
                  description: '',
                  category: 'Operations',
                  priority: 'Medium',
                  status: 'Open',
                  dueDate: '',
                  clientId: '',
                  contractId: '',
                  projectId: '',
                  assignedToUserId: '',
                });
                await refreshSpace(selectedSpaceId);
              } catch (e) {
                setError(e?.response?.data?.message || e.message || 'Failed to create task');
              }
            }}
            disabled={!selectedSpaceId || !newTask.title}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
