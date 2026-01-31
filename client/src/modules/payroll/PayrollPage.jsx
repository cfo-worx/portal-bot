import React, { useEffect, useMemo, useState, useContext } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import {
  listPayrollRuns,
  createPayrollRun,
  getPayrollRun,
  calculatePayrollRun,
  finalizePayrollRun,
  listPayrollRunExceptions,
  upsertPayrollAdjustment,
} from '../../api/payroll';
import {
  listExternalTimeLinks,
  upsertExternalTimeLink,
} from '../../api/externalTime';
import { AuthContext } from '../../context/AuthContext';

function StatusChip({ status }) {
  const color = status === 'Finalized' ? 'success' : status === 'Calculated' ? 'info' : 'default';
  return <Chip size="small" label={status || 'Draft'} color={color} variant={status ? 'filled' : 'outlined'} />;
}

export default function PayrollPage() {
  const { auth } = useContext(AuthContext);
  const user = auth?.user;
  const [tab, setTab] = useState(0);

  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [links, setLinks] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPayload, setCreatePayload] = useState({
    runType: 'BIWEEKLY',
    periodStart: dayjs().startOf('week').format('YYYY-MM-DD'),
    periodEnd: dayjs().endOf('week').format('YYYY-MM-DD'),
    includeSubmitted: false,
  });

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPayload, setAdjustPayload] = useState({
    consultantId: '',
    type: 'REIMBURSEMENT',
    amount: 0,
    hours: 0,
    description: '',
  });

  const refreshRuns = async () => {
    const data = await listPayrollRuns();
    setRuns(data || []);
  };

  const refreshSelected = async (payrollRunId) => {
    if (!payrollRunId) return;
    const data = await getPayrollRun(payrollRunId);
    setSelectedRun(data);
    const ex = await listPayrollRunExceptions(payrollRunId);
    setExceptions(ex || []);
  };

  const refreshLinks = async () => {
    const data = await listExternalTimeLinks();
    setLinks(data || []);
  };

  useEffect(() => {
    refreshRuns();
    refreshLinks();
  }, []);

  useEffect(() => {
    refreshSelected(selectedRunId);
  }, [selectedRunId]);

  const runColumns = useMemo(
    () => [
      { field: 'PayrollRunID', headerName: 'Run ID', width: 260 },
      { field: 'RunType', headerName: 'Type', width: 110 },
      { field: 'PeriodStart', headerName: 'Start', width: 120 },
      { field: 'PeriodEnd', headerName: 'End', width: 120 },
      {
        field: 'Status',
        headerName: 'Status',
        width: 130,
        renderCell: (p) => <StatusChip status={p.value} />,
      },
      { field: 'CreatedOn', headerName: 'Created', width: 180 },
    ],
    []
  );

  const lineColumns = useMemo(
    () => [
      { field: 'ConsultantName', headerName: 'Consultant', width: 200 },
      { field: 'PayType', headerName: 'Pay Type', width: 110 },
      { field: 'TimecardCycle', headerName: 'Cycle', width: 110 },
      { field: 'ExpectedWorkDays', headerName: 'Exp Days', width: 110, type: 'number' },
      { field: 'ExpectedHours', headerName: 'Exp Hours', width: 110, type: 'number' },
      { field: 'ApprovedHours', headerName: 'Approved', width: 110, type: 'number' },
      { field: 'SubmittedHours', headerName: 'Submitted', width: 110, type: 'number' },
      { field: 'ExternalTrackedHours', headerName: 'External', width: 110, type: 'number' },
      { field: 'TimeOffDays', headerName: 'Time Off (days)', width: 140, type: 'number' },
      { field: 'HolidayDays', headerName: 'Holidays', width: 110, type: 'number' },
      {
        field: 'Reimbursements',
        headerName: 'Reimb.',
        width: 120,
        valueFormatter: ({ value }) => (value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' }),
      },
      {
        field: 'Deductions',
        headerName: 'Deduct.',
        width: 120,
        valueFormatter: ({ value }) => (value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' }),
      },
      {
        field: 'GrossPay',
        headerName: 'Gross',
        width: 130,
        valueFormatter: ({ value }) => (value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' }),
      },
      {
        field: 'NetPay',
        headerName: 'Net',
        width: 130,
        valueFormatter: ({ value }) => (value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' }),
      },
    ],
    []
  );

  const exceptionColumns = useMemo(
    () => [
      { field: 'PayrollRunExceptionID', headerName: 'ID', width: 260 },
      { field: 'Severity', headerName: 'Severity', width: 110 },
      { field: 'ExceptionType', headerName: 'Type', width: 200 },
      { field: 'ConsultantName', headerName: 'Consultant', width: 200 },
      { field: 'Source', headerName: 'Source', width: 110 },
      { field: 'WorkDate', headerName: 'Date', width: 120 },
      { field: 'PortalHours', headerName: 'Portal Hrs', width: 120, type: 'number' },
      { field: 'ExternalHours', headerName: 'External Hrs', width: 130, type: 'number' },
      { field: 'Details', headerName: 'Details', width: 420 },
      { field: 'Resolved', headerName: 'Resolved', width: 110, type: 'boolean' },
    ],
    []
  );

  const linkColumns = useMemo(
    () => [
      { field: 'IntegrationLinkID', headerName: 'Link ID', width: 260 },
      { field: 'ConsultantName', headerName: 'Consultant', width: 220 },
      { field: 'Source', headerName: 'Source', width: 120 },
      { field: 'ExternalWorkerId', headerName: 'Worker ID', width: 200 },
      { field: 'ExternalContractId', headerName: 'Contract ID', width: 200 },
      { field: 'IsActive', headerName: 'Active', width: 110, type: 'boolean' },
      { field: 'UpdatedOn', headerName: 'Updated', width: 180 },
    ],
    []
  );

  const selectedRunLines = useMemo(() => {
    const lines = selectedRun?.lines || [];
    return lines.map((l) => ({ id: l.PayrollRunLineID, ...l }));
  }, [selectedRun]);

  const selectedExceptions = useMemo(() => {
    return (exceptions || []).map((x) => ({ id: x.PayrollRunExceptionID, ...x }));
  }, [exceptions]);

  const linkRows = useMemo(() => {
    return (links || []).map((x) => ({ id: x.IntegrationLinkID, ...x }));
  }, [links]);

  const createRun = async () => {
    const created = await createPayrollRun({ ...createPayload, createdBy: user?.email || 'system' });
    setCreateOpen(false);
    await refreshRuns();
    setSelectedRunId(created?.PayrollRunID);
    setTab(0);
  };

  const calcRun = async () => {
    if (!selectedRunId) return;
    await calculatePayrollRun(selectedRunId, { activityThreshold: 70, mismatchToleranceHours: 0.5 });
    await refreshRuns();
    await refreshSelected(selectedRunId);
  };

  const finalizeRun = async () => {
    if (!selectedRunId) return;
    await finalizePayrollRun(selectedRunId);
    await refreshRuns();
    await refreshSelected(selectedRunId);
  };

  const saveAdjustment = async () => {
    if (!selectedRunId || !selectedRun?.run) return;
    const payload = {
      consultantID: adjustPayload.consultantId,
      periodStart: selectedRun.run.PeriodStart,
      periodEnd: selectedRun.run.PeriodEnd,
      adjustmentType: adjustPayload.type,
      amount: adjustPayload.amount || null,
      hours: adjustPayload.hours || null,
      description: adjustPayload.description || null,
    };
    await upsertPayrollAdjustment(payload);
    setAdjustOpen(false);
    setAdjustPayload({ consultantId: '', type: 'REIMBURSEMENT', amount: 0, hours: 0, description: '' });
    await refreshSelected(selectedRunId);
  };

  const upsertLink = async () => {
    // Minimal inline: reuse adjust dialog fields
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800}>Payroll</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={() => setCreateOpen(true)}>New Payroll Run</Button>
          <Button variant="outlined" disabled={!selectedRunId} onClick={calcRun}>Calculate</Button>
          <Button variant="outlined" disabled={!selectedRunId} onClick={() => setAdjustOpen(true)}>Add Adjustment</Button>
          <Button variant="contained" color="success" disabled={!selectedRunId} onClick={finalizeRun}>Finalize</Button>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Runs" />
        <Tab label="Run Detail" disabled={!selectedRunId} />
        <Tab label="Exceptions" disabled={!selectedRunId} />
        <Tab label="External Links" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Tip: Create a run, then click <b>Calculate</b>. Exceptions will be generated for mismatched Upwork/Hubstaff totals, low activity, and unallocated external time.
            </Alert>
            <div style={{ height: 420, width: '100%' }}>
              <DataGrid
                rows={runs.map((r) => ({ id: r.PayrollRunID, ...r }))}
                columns={runColumns}
                pageSizeOptions={[10, 25, 50]}
                onRowClick={(p) => setSelectedRunId(p.row.PayrollRunID)}
                slots={{ toolbar: GridToolbar }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" fontWeight={800}>Run</Typography>
                  <Typography variant="body2" color="text.secondary">{selectedRun?.PayrollRunID}</Typography>
                  <StatusChip status={selectedRun?.Status} />
                  <Chip size="small" label={`Type: ${selectedRun?.RunType || '—'}`} />
                  <Chip size="small" label={`${selectedRun?.PeriodStart || '—'} → ${selectedRun?.PeriodEnd || '—'}`} />
                </Stack>
                <div style={{ height: 520, width: '100%' }}>
                  <DataGrid
                    rows={selectedRunLines}
                    columns={lineColumns}
                    pageSizeOptions={[10, 25, 50]}
                    slots={{ toolbar: GridToolbar }}
                  />
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 2 && (
        <Card>
          <CardContent>
            <div style={{ height: 520, width: '100%' }}>
              <DataGrid
                rows={selectedExceptions}
                columns={exceptionColumns}
                pageSizeOptions={[10, 25, 50]}
                slots={{ toolbar: GridToolbar }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card>
          <CardContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              External integrations are "ready for wiring" — Upwork/Hubstaff API specifics still need to be confirmed. Once tokens are available, a scheduled import can populate <code>ExternalTimeEntry</code>.
            </Alert>
            <div style={{ height: 420, width: '100%' }}>
              <DataGrid
                rows={linkRows}
                columns={linkColumns}
                pageSizeOptions={[10, 25, 50]}
                slots={{ toolbar: GridToolbar }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Payroll Run Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Payroll Run</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Run Type</InputLabel>
              <Select
                label="Run Type"
                value={createPayload.runType}
                onChange={(e) => setCreatePayload((p) => ({ ...p, runType: e.target.value }))}
              >
                <MenuItem value="BIWEEKLY">Bi-Weekly</MenuItem>
                <MenuItem value="MONTHLY">Monthly</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Period Start"
              type="date"
              value={createPayload.periodStart}
              onChange={(e) => setCreatePayload((p) => ({ ...p, periodStart: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Period End"
              type="date"
              value={createPayload.periodEnd}
              onChange={(e) => setCreatePayload((p) => ({ ...p, periodEnd: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>Include Submitted</InputLabel>
              <Select
                label="Include Submitted"
                value={createPayload.includeSubmitted ? 'yes' : 'no'}
                onChange={(e) => setCreatePayload((p) => ({ ...p, includeSubmitted: e.target.value === 'yes' }))}
              >
                <MenuItem value="no">Approved Only</MenuItem>
                <MenuItem value="yes">Approved + Submitted</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createRun}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={adjustOpen} onClose={() => setAdjustOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Payroll Adjustment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Consultant ID"
              value={adjustPayload.consultantId}
              onChange={(e) => setAdjustPayload((p) => ({ ...p, consultantId: e.target.value }))}
              helperText="Paste ConsultantID (UUID). A picker can be added later."
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={adjustPayload.type}
                onChange={(e) => setAdjustPayload((p) => ({ ...p, type: e.target.value }))}
              >
                <MenuItem value="REIMBURSEMENT">Reimbursement</MenuItem>
                <MenuItem value="DEDUCTION">Deduction</MenuItem>
                <MenuItem value="CATCHUP">Catch-up Hours</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Amount (USD)"
              type="number"
              value={adjustPayload.amount}
              onChange={(e) => setAdjustPayload((p) => ({ ...p, amount: Number(e.target.value) }))}
            />
            <TextField
              label="Hours"
              type="number"
              value={adjustPayload.hours}
              onChange={(e) => setAdjustPayload((p) => ({ ...p, hours: Number(e.target.value) }))}
            />
            <TextField
              label="Description"
              value={adjustPayload.description}
              onChange={(e) => setAdjustPayload((p) => ({ ...p, description: e.target.value }))}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveAdjustment}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
