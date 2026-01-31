import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import {
  listQboMappings,
  upsertQboMapping,
  importQboPayments,
  listAgreements,
  upsertAgreement,
  calculateAccruals,
  listAccruals,
  markAccrualPaid,
} from '../../api/commissions';

function StatusBadge({ status }) {
  const map = {
    POTENTIAL: 'default',
    PENDING_PAYMENT: 'warning',
    ACCRUED: 'info',
    PAYABLE: 'success',
    PAID: 'success',
    STOPPED: 'default',
  };
  const color = map[status] || 'default';
  return <span style={{
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    background: color === 'success' ? '#e8f5e9' : color === 'warning' ? '#fff8e1' : color === 'info' ? '#e3f2fd' : '#f5f5f5',
    color: '#111',
  }}>{status || '—'}</span>;
}

export default function CommissionsPage() {
  const [tab, setTab] = useState(0);
  const [mappings, setMappings] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [accruals, setAccruals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingPayload, setMappingPayload] = useState({ clientId: '', qboCustomerId: '', qboDisplayName: '' });

  const [agreementOpen, setAgreementOpen] = useState(false);
  const [agreementPayload, setAgreementPayload] = useState({
    clientId: '',
    contractId: '',
    dealId: '',
    eligible: true,
    ineligibleReason: '',
    notes: '',
    splits: [{ userId: '', splitPercent: 100 }],
  });

  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');

  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      const [m, a, r] = await Promise.all([listQboMappings(), listAgreements(), listAccruals()]);
      setMappings(m);
      setAgreements(a);
      setAccruals(r);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load commissions');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const accrualRows = useMemo(() => accruals.map((x) => ({ id: x.CommissionAccrualID, ...x })), [accruals]);
  const mappingRows = useMemo(() => mappings.map((x) => ({ id: x.MappingID, ...x })), [mappings]);
  const agreementRows = useMemo(() => agreements.map((x) => ({ id: x.AgreementID, ...x })), [agreements]);

  const accrualColumns = [
    { field: 'ClientName', headerName: 'Client', flex: 1, minWidth: 180 },
    { field: 'ContractID', headerName: 'ContractID', width: 220 },
    { field: 'UserID', headerName: 'Sales User', width: 140 },
    { field: 'MonthIndex', headerName: 'Invoice #', width: 90 },
    { field: 'CommissionRate', headerName: 'Rate', width: 90, valueFormatter: (p) => `${Math.round((p.value || 0) * 100)}%` },
    { field: 'BaseAmount', headerName: 'Base', width: 120, valueFormatter: (p) => Number(p.value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) },
    { field: 'CommissionAmount', headerName: 'Commission', width: 140, valueFormatter: (p) => Number(p.value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) },
    { field: 'PaymentDate', headerName: 'Paid Date', width: 120 },
    { field: 'PayableOn', headerName: 'Payable On', width: 120 },
    { field: 'Status', headerName: 'Status', width: 140, renderCell: (p) => <StatusBadge status={p.value} /> },
    {
      field: 'actions',
      headerName: '',
      width: 140,
      sortable: false,
      renderCell: (p) => (
        <Button
          size="small"
          variant="outlined"
          disabled={p.row.Status !== 'PAYABLE'}
          onClick={async () => {
            try {
              await markAccrualPaid(p.row.CommissionAccrualID);
              await refresh();
            } catch (e) {
              setError(e?.response?.data?.message || e.message);
            }
          }}
        >
          Mark Paid
        </Button>
      ),
    },
  ];

  const mappingColumns = [
    { field: 'ClientID', headerName: 'ClientID', width: 220 },
    { field: 'ClientName', headerName: 'Client', flex: 1, minWidth: 180 },
    { field: 'QboCustomerID', headerName: 'QBO Customer ID', width: 180 },
    { field: 'QboDisplayName', headerName: 'QBO Name', flex: 1, minWidth: 220 },
    { field: 'MatchConfidence', headerName: 'Confidence', width: 120 },
    { field: 'Approved', headerName: 'Approved', width: 110 },
  ];

  const agreementColumns = [
    { field: 'ClientID', headerName: 'ClientID', width: 220 },
    { field: 'ClientName', headerName: 'Client', flex: 1, minWidth: 180 },
    { field: 'ContractID', headerName: 'ContractID', width: 220 },
    { field: 'DealID', headerName: 'DealID', width: 220 },
    { field: 'Eligible', headerName: 'Eligible', width: 110 },
    { field: 'IneligibleReason', headerName: 'Ineligible Reason', flex: 1, minWidth: 200 },
  ];

  const kpis = useMemo(() => {
    const sum = (filter) => accruals.filter(filter).reduce((s, x) => s + Number(x.CommissionAmount || 0), 0);
    return {
      payable: sum((x) => x.Status === 'PAYABLE'),
      accrued: sum((x) => x.Status === 'ACCRUED'),
      paid: sum((x) => x.Status === 'PAID'),
    };
  }, [accruals]);

  const runCalc = async () => {
    setBusy(true);
    setError('');
    try {
      await calculateAccruals({ asOfDate: new Date().toISOString().slice(0, 10) });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveMapping = async () => {
    setBusy(true);
    setError('');
    try {
      await upsertQboMapping(mappingPayload);
      setMappingOpen(false);
      setMappingPayload({ clientId: '', qboCustomerId: '', qboDisplayName: '' });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveAgreement = async () => {
    setBusy(true);
    setError('');
    try {
      await upsertAgreement(agreementPayload);
      setAgreementOpen(false);
      setAgreementPayload({ clientId: '', contractId: '', dealId: '', eligible: true, ineligibleReason: '', notes: '', splits: [{ userId: '', splitPercent: 100 }] });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    setError('');
    try {
      const parsed = JSON.parse(importJson);
      await importQboPayments(parsed);
      setImportOpen(false);
      setImportJson('');
      await refresh();
    } catch (e) {
      setError(e?.message || 'Invalid JSON');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={900}>Commissions</Typography>
          <Typography variant="body2" color="text.secondary">15/10/5 cash-based commissions (paid after collection; payable the following month)</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="outlined" onClick={() => setImportOpen(true)}>Import QBO Payments (JSON)</Button>
          <Button variant="contained" onClick={runCalc} disabled={busy}>Recalculate</Button>
          <Button variant="outlined" onClick={() => setAgreementOpen(true)}>New Agreement</Button>
          <Button variant="outlined" onClick={() => setMappingOpen(true)}>New Mapping</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Dashboard" />
        <Tab label="Accruals" />
        <Tab label="Agreements" />
        <Tab label="QBO Mapping" />
      </Tabs>

      {tab === 0 && (
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box>
                  <Typography variant="overline" color="text.secondary">Payable</Typography>
                  <Typography variant="h6" fontWeight={800}>{kpis.payable.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">Accrued (not yet payable)</Typography>
                  <Typography variant="h6" fontWeight={800}>{kpis.accrued.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</Typography>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">Paid</Typography>
                  <Typography variant="h6" fontWeight={800}>{kpis.paid.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Alert severity="info">
                This module supports direct QBO wiring later. For now, you can import payment events as JSON via the button above.
              </Alert>
            </CardContent>
          </Card>
        </Stack>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            <div style={{ height: 560, width: '100%' }}>
              <DataGrid rows={accrualRows} columns={accrualColumns} pageSizeOptions={[10, 25, 50]} slots={{ toolbar: GridToolbar }} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <CardContent>
            <div style={{ height: 520, width: '100%' }}>
              <DataGrid rows={agreementRows} columns={agreementColumns} pageSizeOptions={[10, 25, 50]} slots={{ toolbar: GridToolbar }} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card>
          <CardContent>
            <div style={{ height: 520, width: '100%' }}>
              <DataGrid rows={mappingRows} columns={mappingColumns} pageSizeOptions={[10, 25, 50]} slots={{ toolbar: GridToolbar }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapping dialog */}
      <Dialog open={mappingOpen} onClose={() => setMappingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upsert QBO Customer Mapping</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Client ID" value={mappingPayload.clientId} onChange={(e) => setMappingPayload((p) => ({ ...p, clientId: e.target.value }))} />
            <TextField label="QBO Customer ID" value={mappingPayload.qboCustomerId} onChange={(e) => setMappingPayload((p) => ({ ...p, qboCustomerId: e.target.value }))} />
            <TextField label="QBO Display Name" value={mappingPayload.qboDisplayName} onChange={(e) => setMappingPayload((p) => ({ ...p, qboDisplayName: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveMapping}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Agreement dialog */}
      <Dialog open={agreementOpen} onClose={() => setAgreementOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create / Update Commission Agreement</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Agreements define commission eligibility + sales splits for a contract (or deal). Commission accruals are then created from QBO payments.
            </Alert>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField fullWidth label="Client ID" value={agreementPayload.clientId} onChange={(e) => setAgreementPayload((p) => ({ ...p, clientId: e.target.value }))} />
              <TextField fullWidth label="Contract ID" value={agreementPayload.contractId} onChange={(e) => setAgreementPayload((p) => ({ ...p, contractId: e.target.value }))} />
              <TextField fullWidth label="Deal ID (optional)" value={agreementPayload.dealId} onChange={(e) => setAgreementPayload((p) => ({ ...p, dealId: e.target.value }))} />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Eligible</InputLabel>
                <Select
                  label="Eligible"
                  value={agreementPayload.eligible ? 'yes' : 'no'}
                  onChange={(e) => setAgreementPayload((p) => ({ ...p, eligible: e.target.value === 'yes' }))}
                >
                  <MenuItem value="yes">Eligible</MenuItem>
                  <MenuItem value="no">Ineligible</MenuItem>
                </Select>
              </FormControl>
              <TextField fullWidth label="Ineligible Reason" value={agreementPayload.ineligibleReason} onChange={(e) => setAgreementPayload((p) => ({ ...p, ineligibleReason: e.target.value }))} />
            </Stack>

            <TextField fullWidth label="Notes" value={agreementPayload.notes} onChange={(e) => setAgreementPayload((p) => ({ ...p, notes: e.target.value }))} multiline minRows={2} />

            <Typography variant="subtitle2" fontWeight={800}>Splits</Typography>
            {agreementPayload.splits.map((s, idx) => (
              <Stack key={idx} direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                <TextField fullWidth label="Sales User ID" value={s.userId} onChange={(e) => setAgreementPayload((p) => ({
                  ...p,
                  splits: p.splits.map((x, j) => j === idx ? { ...x, userId: e.target.value } : x),
                }))} />
                <TextField
                  sx={{ width: { xs: '100%', md: 200 } }}
                  label="Split %"
                  type="number"
                  value={s.splitPercent}
                  onChange={(e) => setAgreementPayload((p) => ({
                    ...p,
                    splits: p.splits.map((x, j) => j === idx ? { ...x, splitPercent: Number(e.target.value) } : x),
                  }))}
                />
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setAgreementPayload((p) => ({ ...p, splits: p.splits.filter((_, j) => j !== idx) }))}
                  disabled={agreementPayload.splits.length <= 1}
                >
                  Remove
                </Button>
              </Stack>
            ))}
            <Button variant="outlined" onClick={() => setAgreementPayload((p) => ({ ...p, splits: [...p.splits, { userId: '', splitPercent: 0 }] }))}>Add Split</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAgreementOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveAgreement}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import QBO Payments (JSON)</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This is a temporary bridge until QBO OAuth + scheduled sync is wired. Paste a JSON array of payments.
          </Alert>
          <TextField
            fullWidth
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"paymentId":"123","invoiceId":"456","customerId":"789","customerName":"Acme","paymentDate":"2026-01-15","amount":1200}]'
            multiline
            minRows={10}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={doImport}>Import</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
