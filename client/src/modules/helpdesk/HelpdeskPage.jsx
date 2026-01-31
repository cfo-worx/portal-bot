import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Stack,
  Button,
  FormControlLabel,
  Switch,
  Alert,
  TextField,
  Chip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { helpdeskService } from '../../api/helpdesk';
import { getUsers } from '../../api/users';
import TicketForm from './components/TicketForm';
import TicketDetailDrawer from './components/TicketDetailDrawer';

function roleFromPath(pathname) {
  // /dashboard/admin/helpdesk
  const parts = (pathname || '').split('/').filter(Boolean);
  const roleSeg = parts[1] || ''; // ['dashboard','admin','helpdesk']
  return roleSeg.toLowerCase();
}

function formatDate(dt) {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

function priorityLabel(p) {
  const map = {
    P0: 'P0 – Critical',
    P1: 'P1 – High',
    P2: 'P2 – Medium',
    P3: 'P3 – Low',
  };
  return map[p] || p || '';
}

export default function HelpdeskPage() {
  const location = useLocation();
  const role = roleFromPath(location.pathname);
  const isPrivileged = role === 'admin' || role === 'manager';

  const [tab, setTab] = useState(0);

  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);

  const [users, setUsers] = useState([]);

  const viewKey = useMemo(() => {
    // Tabs:
    // 0 New Ticket
    // 1 My Tickets
    // 2 Queue (Admin/Manager)
    if (tab === 0) return 'new';
    if (tab === 1) return 'mine';
    return 'queue';
  }, [tab]);

  const columns = useMemo(() => {
    return [
      {
        field: 'Priority',
        headerName: 'Priority',
        width: 140,
        valueGetter: (p) => p?.row?.Priority,
        renderCell: (params) => {
          const val = params.row.Priority;
          return <Chip size="small" label={priorityLabel(val)} />;
        },
      },
      { field: 'Status', headerName: 'Status', width: 130 },
      { field: 'Category', headerName: 'Category', width: 150 },
      { field: 'Title', headerName: 'Title', flex: 1, minWidth: 260 },
      { field: 'CreatedByName', headerName: 'Created By', width: 180 },
      { field: 'AssignedToName', headerName: 'Assigned', width: 180 },
      {
        field: 'CreatedAt',
        headerName: 'Created',
        width: 190,
        valueGetter: (p) => p?.row?.CreatedAt,
        valueFormatter: (p) => formatDate(p?.value),
      },
      {
        field: 'UpdatedAt',
        headerName: 'Updated',
        width: 190,
        valueGetter: (p) => p?.row?.UpdatedAt,
        valueFormatter: (p) => formatDate(p?.value),
      },
      {
        field: 'TotalTimeSpentMinutes',
        headerName: 'Time Spent',
        width: 120,
        valueGetter: (p) => p?.row?.TotalTimeSpentMinutes ?? 0,
        valueFormatter: (p) => `${Math.round((p?.value || 0) / 60 * 10) / 10}h`,
      },
    ];
  }, []);

  async function loadUsersIfNeeded() {
    if (!isPrivileged) return;
    try {
      const rows = await getUsers();
      // Normalize fields
      const normalized = (rows || []).map((u) => ({
        UserID: u.UserID || u.userId || u.id,
        FirstName: u.FirstName || u.firstName || '',
        LastName: u.LastName || u.lastName || '',
        Email: u.Email || u.email || '',
      })).filter((u) => u.UserID);
      setUsers(normalized);
    } catch (e) {
      // non-blocking
      console.warn('Failed to load users:', e);
    }
  }

  async function loadTickets() {
    if (viewKey === 'new') return;

    setLoading(true);
    setError('');
    try {
      const params = {
        includeClosed,
      };
      if (search?.trim()) params.search = search.trim();

      if (viewKey === 'mine') {
        params.onlyMine = true;
      }

      if (viewKey === 'queue') {
        // open work queue
        if (!includeClosed) {
          params.status = 'open,in_progress,blocked';
        }
      }

      const data = await helpdeskService.listTickets(params);
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('loadTickets error:', e);
      const errorMsg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Failed to load tickets.';
      setError(errorMsg);
      setTickets([]); // Clear tickets on error
    } finally {
      setLoading(false);
    }
  }

  async function openTicket(ticketId) {
    if (!ticketId) return;
    setSelectedTicketId(ticketId);
    setDrawerOpen(true);
    setSelectedTicket(null);
    setLoadingTicket(true);
    setError('');
    try {
      const t = await helpdeskService.getTicket(ticketId);
      if (!t) {
        throw new Error('Ticket not found');
      }
      setSelectedTicket(t);
    } catch (e) {
      console.error(e);
      const errorMsg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Failed to load ticket detail.';
      setError(errorMsg);
      // Close drawer on error to prevent blank screen
      setDrawerOpen(false);
      setSelectedTicketId(null);
      setSelectedTicket(null);
    } finally {
      setLoadingTicket(false);
    }
  }

  async function refreshSelectedTicket() {
    if (!selectedTicketId) return;
    setLoadingTicket(true);
    try {
      const t = await helpdeskService.getTicket(selectedTicketId);
      if (t) {
        setSelectedTicket(t);
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.error || e?.response?.data?.message || 'Failed to refresh ticket.');
    } finally {
      setLoadingTicket(false);
    }
  }

  async function handleCreateTicket(payload, files) {
    setNotice('');
    setError('');
    try {
      const created = await helpdeskService.createTicket(payload);
      const ticketId = created?.TicketID;

      if (!ticketId) {
        throw new Error('Ticket was created but no ticket ID was returned');
      }

      if (files && files.length) {
        // Upload attachments sequentially to keep it simple / stable.
        for (const f of files) {
          try {
            await helpdeskService.uploadAttachment(ticketId, f);
          } catch (uploadError) {
            console.error('Failed to upload attachment:', uploadError);
            // Continue with other attachments even if one fails
          }
        }
      }

      setNotice('Ticket created successfully.');
      setTab(1);
      await loadTickets();
      await openTicket(ticketId);
    } catch (e) {
      console.error(e);
      const errorMsg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Failed to create ticket.';
      setError(errorMsg);
      // Don't switch tabs if creation failed
    }
  }

  async function handleUpdateTicket(ticketId, patch) {
    setError('');
    try {
      await helpdeskService.updateTicket(ticketId, patch);
      await refreshSelectedTicket();
      await loadTickets();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'Failed to update ticket.');
    }
  }

  async function handleAddComment(ticketId, body) {
    setError('');
    try {
      await helpdeskService.addComment(ticketId, body);
      await refreshSelectedTicket();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'Failed to add comment.');
    }
  }

  async function handleAddWorkLog(ticketId, minutes, note) {
    setError('');
    try {
      await helpdeskService.addWorkLog(ticketId, minutes, note);
      await refreshSelectedTicket();
      await loadTickets();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'Failed to add work log.');
    }
  }

  async function handleUploadAttachments(ticketId, files) {
    setError('');
    try {
      for (const f of files) {
        await helpdeskService.uploadAttachment(ticketId, f);
      }
      await refreshSelectedTicket();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'Failed to upload attachment(s).');
    }
  }

  async function handleDownloadAttachment(ticketId, attachment) {
    try {
      const resp = await helpdeskService.downloadAttachment(ticketId, attachment.AttachmentID || attachment);
      const blob = resp?.data;
      const contentDisposition = resp?.headers?.['content-disposition'] || '';
      const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
      const filename = match?.[1] || (attachment.FileName || attachment) || 'attachment';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'Failed to download attachment.');
    }
  }

  // Initial loads
  useEffect(() => {
    loadUsersIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrivileged]);

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, includeClosed]);

  const pageTitle = 'Helpdesk / IT Tickets';

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{pageTitle}</Typography>
          <Typography variant="body2" color="text.secondary">
            Submit portal issues with enough detail for fast resolution, and track progress in a shared queue.
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ mt: 2 }}>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {notice ? <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert> : null}

        <Paper sx={{ p: 2 }}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)}>
            <Tab label="New Ticket" />
            <Tab label="My Tickets" />
            {isPrivileged ? <Tab label="Queue" /> : null}
          </Tabs>

          <Box sx={{ mt: 2 }}>
            {tab === 0 ? (
              <TicketForm onSubmit={handleCreateTicket} />
            ) : (
              <>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 2 }}>
                  <TextField
                    size="small"
                    label="Search"
                    placeholder="Title, category, status, etc"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadTickets();
                    }}
                    sx={{ minWidth: 260 }}
                  />
                  <Button variant="outlined" onClick={loadTickets}>Run</Button>
                  <FormControlLabel
                    control={<Switch checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} />}
                    label="Include closed"
                  />
                  <Box sx={{ flexGrow: 1 }} />
                  <Chip label={`Tickets: ${tickets.length}`} />
                </Stack>

                <div style={{ width: '100%', height: 560 }}>
                  <DataGrid
                    rows={tickets}
                    columns={columns}
                    loading={loading}
                    getRowId={(row) => row.TicketID}
                    onRowDoubleClick={(params) => openTicket(params.row.TicketID)}
                    onRowClick={(params) => setSelectedTicketId(params.row.TicketID)}
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 25, page: 0 } },
                    }}
                  />
                </div>

                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    disabled={!selectedTicketId}
                    onClick={() => openTicket(selectedTicketId)}
                  >
                    Open Selected Ticket
                  </Button>
                </Stack>
              </>
            )}
          </Box>
        </Paper>

        <TicketDetailDrawer
          open={drawerOpen}
          ticket={selectedTicket}
          loading={loadingTicket}
          users={users}
          isPrivileged={isPrivileged}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedTicket(null);
            setSelectedTicketId(null);
            setLoadingTicket(false);
          }}
          onUpdateTicket={handleUpdateTicket}
          onAddComment={handleAddComment}
          onAddWorkLog={handleAddWorkLog}
          onUploadAttachments={handleUploadAttachments}
          onDownloadAttachment={handleDownloadAttachment}
        />
      </Box>
    </Box>
  );
}

