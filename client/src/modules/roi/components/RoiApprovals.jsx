import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { approveROIWin, getROIWins, getROISettings, rejectROIWin } from '../../../api/roi';

export default function RoiApprovals() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectWin, setRejectWin] = useState(null);
  const [rejectReasonId, setRejectReasonId] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const [wins, s] = await Promise.all([
        getROIWins({ status: 'Submitted' }),
        getROISettings(),
      ]);
      setRows(wins || []);
      setSettings(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rejectionReasons = settings?.rejectionReasons || [];

  const openReject = (win) => {
    setRejectWin(win);
    setRejectReasonId('');
    setRejectNote('');
    setRejectOpen(true);
  };

  const onReject = async () => {
    if (!rejectWin) return;
    try {
      await rejectROIWin(rejectWin.ROIWinID, {
        reasonId: rejectReasonId || null,
        rejectionNote: rejectNote || null,
      });
      setRejectOpen(false);
      setRejectWin(null);
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || 'Failed to reject win');
    }
  };

  const onApprove = async (win) => {
    try {
      await approveROIWin(win.ROIWinID);
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || 'Failed to approve win');
    }
  };

  const columns = useMemo(
    () => [
      { field: 'ClientName', headerName: 'Client', flex: 1, minWidth: 180 },
      { field: 'Title', headerName: 'Title', flex: 1.2, minWidth: 220 },
      { field: 'CategoryName', headerName: 'Category', width: 160 },
      { field: 'ImpactType', headerName: 'Type', width: 110 },
      {
        field: 'ImpactDate',
        headerName: 'Impact Date',
        width: 130,
        valueGetter: (p) => (p.value ? String(p.value).slice(0, 10) : ''),
      },
      {
        field: 'SubmittedAt',
        headerName: 'Submitted',
        width: 170,
        valueGetter: (p) => (p.value ? new Date(p.value).toLocaleString() : ''),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 220,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 1, paddingTop: '10px' }}>
            <Button size="small" variant="contained" onClick={() => onApprove(params.row)}>
              Approve
            </Button>
            <Button size="small" variant="outlined" color="error" onClick={() => openReject(params.row)}>
              Reject
            </Button>
          </Box>
        ),
      },
    ],
    []
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        ROI Approvals
      </Typography>

      <Box sx={{ height: 520, width: '100%' }}>
        <DataGrid
          rows={rows}
          getRowId={(r) => r.ROIWinID}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
        />
      </Box>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Win</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {rejectWin?.ClientName} — {rejectWin?.Title}
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Reason</InputLabel>
            <Select
              label="Reason"
              value={rejectReasonId}
              onChange={(e) => setRejectReasonId(e.target.value)}
            >
              <MenuItem value="">
                <em>Select…</em>
              </MenuItem>
              {rejectionReasons.map((r) => (
                <MenuItem key={r.ReasonID} value={r.ReasonID}>
                  {r.ReasonText}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Notes (optional)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={onReject}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
