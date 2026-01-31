import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { getClientActivityReport, getClientActivityCsv } from '../../../api/clientActivity';

function safeFilePart(v) {
  return String(v || '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

function toISODateOnly(v) {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch (e) {}
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClientActivityTab({ clients = [] }) {
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeWeekends, setIncludeWeekends] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const clientOptions = useMemo(() => {
    return [...clients].sort((a, b) => (a.ClientName || '').localeCompare(b.ClientName || ''));
  }, [clients]);

  const summaryRows = useMemo(() => {
    const s = report?.summary?.byWeek || [];
    return s.map((r, idx) => ({ 
      id: idx, 
      DateBucket: r.isoWeek,
      RoleTitle: r.role,
      ConsultantName: r.person,
      DeliverableCategory: r.category,
      Hours: r.hours,
    }));
  }, [report]);

  const detailRows = useMemo(() => {
    const d = report?.detail || [];
    return d.map((r, idx) => ({ id: idx, ...r, date: toISODateOnly(r.date) }));
  }, [report]);

  const summaryColumns = [
    { field: 'DateBucket', headerName: 'Week', flex: 0.9 },
    { field: 'RoleTitle', headerName: 'Role', flex: 0.9 },
    { field: 'ConsultantName', headerName: 'Consultant', flex: 1.1 },
    { field: 'DeliverableCategory', headerName: 'Category', flex: 1.0 },
    { field: 'Hours', headerName: 'Hours', flex: 0.5, type: 'number' },
  ];

  const detailColumns = [
    { field: 'date', headerName: 'Date', flex: 0.7 },
    { field: 'person', headerName: 'Consultant', flex: 1.0 },
    { field: 'role', headerName: 'Role', flex: 0.8 },
    { field: 'category', headerName: 'Category', flex: 1.0 },
    { field: 'project', headerName: 'Project', flex: 1.0 },
    { field: 'task', headerName: 'Task', flex: 1.0 },
    { field: 'hours', headerName: 'Hours', flex: 0.5, type: 'number' },
    { field: 'notes', headerName: 'Notes', flex: 1.8 },
  ];

  const run = async () => {
    if (!clientId || !startDate || !endDate) {
      setError('Please select a client and date range.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getClientActivityReport({ clientId, startDate, endDate, includeWeekends, includeNotes });
      setReport(data);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    if (!clientId || !startDate || !endDate) {
      setError('Please select a client and date range first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const csv = await getClientActivityCsv({ clientId, startDate, endDate, includeWeekends, includeNotes });
      const clientName = clientOptions.find(c => c.ClientID === clientId)?.ClientName || clientId;
      const name = `ClientActivity_${safeFilePart(clientName)}_${startDate}_to_${endDate}${includeWeekends ? '' : '_business_days'}${includeNotes ? '_with_notes' : ''}.csv`;
      downloadText(name, csv, 'text/csv');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to export CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>Client Activity Reporting</Typography>
          <Typography variant="body2" color="text.secondary">
            Generates summary and detail views from <b>approved</b> time. Use “Include Notes” only for internal exports.
          </Typography>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={5}>
              <FormControl fullWidth>
                <InputLabel>Client</InputLabel>
                <Select label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  {clientOptions.map((c) => (
                    <MenuItem key={c.ClientID} value={c.ClientID}>{c.ClientName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2.5}>
              <TextField fullWidth type="date" label="Start" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Grid>
            <Grid item xs={12} md={2.5}>
              <TextField fullWidth type="date" label="End" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Grid>
            <Grid item xs={12} md={2}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'flex-start', md: 'flex-end' }} sx={{ height: '100%' }}>
                <Button variant="contained" onClick={run} disabled={loading}>Run</Button>
                <Button variant="outlined" onClick={exportCsv} disabled={loading}>CSV</Button>
              </Stack>
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={<Switch checked={includeWeekends} onChange={(e) => setIncludeWeekends(e.target.checked)} />}
                  label="Include weekends"
                />
                <FormControlLabel
                  control={<Switch checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />}
                  label="Include notes"
                />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {report && (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Summary (ISO week)</Typography>
              <Box sx={{ height: 420 }}>
                <DataGrid
                  rows={summaryRows}
                  columns={summaryColumns}
                  loading={loading}
                  disableRowSelectionOnClick
                  pageSizeOptions={[25, 50, 100]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
                />
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Detail (daily log)</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ height: 520 }}>
                <DataGrid
                  rows={detailRows}
                  columns={detailColumns}
                  loading={loading}
                  disableRowSelectionOnClick
                  pageSizeOptions={[50, 100, 200]}
                  initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
                />
              </Box>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
