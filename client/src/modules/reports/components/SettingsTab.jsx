import React, { useEffect, useMemo, useState } from 'react';
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
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getPerformanceReportingSettings, updatePerformanceReportingSettings } from '../../../api/globalSettings';
import { getAllBenchmarks, bulkUpdateDistributionType } from '../../../api/benchmarks';

const DISTRIBUTION_OPTIONS = [
  { value: 'linear', label: 'Linear (even through month)' },
  { value: 'front_loaded', label: 'Front-loaded (more early)' },
  { value: 'back_loaded', label: 'Back-loaded (more late)' },
  { value: 'u_shaped', label: 'U-shaped (begin + end)' },
  { value: 'custom', label: 'Custom (future)' },
];

const SettingsTab = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [warnTolerancePct, setWarnTolerancePct] = useState(0.05);
  const [criticalTolerancePct, setCriticalTolerancePct] = useState(0.15);
  const [workdayHoursDefault, setWorkdayHoursDefault] = useState(8);
  const [attentionRiskDays, setAttentionRiskDays] = useState(7);
  const [defaultDistributionType, setDefaultDistributionType] = useState('linear');
  const [gmVarianceThresholdPct, setGMVarianceThresholdPct] = useState(0.05);
  const [businessDaysOnlyDefault, setBusinessDaysOnlyDefault] = useState(true);
  const [includeSubmittedDefault, setIncludeSubmittedDefault] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPerformanceReportingSettings();
        setSettings(data);

        setWarnTolerancePct(Number(data.HoursVarianceWarnPct ?? 0.05));
        setCriticalTolerancePct(Number(data.HoursVarianceCriticalPct ?? 0.15));
        setWorkdayHoursDefault(Number(data.WorkdayHoursDefault ?? 8));
        setAttentionRiskDays(Number(data.AttentionRiskDays ?? 7));
        setDefaultDistributionType((data.DefaultDistributionType ?? 'linear').toString().toLowerCase());
        setGMVarianceThresholdPct(Number(data.GMVarianceThresholdPct ?? 0.05));
        setBusinessDaysOnlyDefault(Boolean(data.BusinessDaysOnlyDefault));
        setIncludeSubmittedDefault(Boolean(data.IncludeSubmittedDefault));
      } catch (err) {
        setError(err.message || 'Failed to load settings');
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const validationError = useMemo(() => {
    if (warnTolerancePct <= 0 || warnTolerancePct >= 1) return 'Warn tolerance must be between 0 and 1.';
    if (criticalTolerancePct <= 0 || criticalTolerancePct >= 1) return 'Critical tolerance must be between 0 and 1.';
    if (criticalTolerancePct <= warnTolerancePct) return 'Critical tolerance must be greater than warn tolerance.';
    if (workdayHoursDefault <= 0 || workdayHoursDefault > 24) return 'Workday hours must be between 0 and 24.';
    if (attentionRiskDays < 0 || attentionRiskDays > 365) return 'Attention Risk days must be between 0 and 365.';
    if (gmVarianceThresholdPct <= 0 || gmVarianceThresholdPct >= 1) return 'GM variance threshold must be between 0 and 1.';
    return null;
  }, [warnTolerancePct, criticalTolerancePct, workdayHoursDefault, attentionRiskDays, gmVarianceThresholdPct]);

  const handleSaveSettings = async () => {
    if (validationError) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const updated = await updatePerformanceReportingSettings({
        HoursVarianceWarnPct: warnTolerancePct,
        HoursVarianceCriticalPct: criticalTolerancePct,
        BusinessDaysOnlyDefault: businessDaysOnlyDefault,
        IncludeSubmittedDefault: includeSubmittedDefault,
        WorkdayHoursDefault: workdayHoursDefault,
        AttentionRiskDays: attentionRiskDays,
        DefaultDistributionType: defaultDistributionType,
        GMVarianceThresholdPct: gmVarianceThresholdPct,
      });

      setSettings(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
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
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Performance Reporting Settings
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Settings saved successfully
          </Alert>
        )}

        {validationError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {validationError}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Warn tolerance (%)"
              type="number"
              value={(warnTolerancePct * 100).toFixed(1)}
              onChange={(e) => setWarnTolerancePct(Number(e.target.value) / 100)}
              helperText="Flag when variance exceeds this percent"
              InputProps={{ inputProps: { min: 0, max: 100, step: 0.5 } }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Critical tolerance (%)"
              type="number"
              value={(criticalTolerancePct * 100).toFixed(1)}
              onChange={(e) => setCriticalTolerancePct(Number(e.target.value) / 100)}
              helperText="Escalate when variance exceeds this percent"
              InputProps={{ inputProps: { min: 0, max: 100, step: 0.5 } }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Workday hours default"
              type="number"
              value={workdayHoursDefault}
              onChange={(e) => setWorkdayHoursDefault(Number(e.target.value))}
              helperText="Used for payroll/utilization projections"
              InputProps={{ inputProps: { min: 0, max: 24, step: 0.25 } }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Client attention risk days"
              type="number"
              value={attentionRiskDays}
              onChange={(e) => setAttentionRiskDays(Number(e.target.value))}
              helperText="Days without time logged triggers Attention Risk"
              InputProps={{ inputProps: { min: 0, max: 365, step: 1 } }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="GM variance threshold (%)"
              type="number"
              value={(gmVarianceThresholdPct * 100).toFixed(1)}
              onChange={(e) => setGMVarianceThresholdPct(Number(e.target.value) / 100)}
              helperText="Alert when trailing 3-month GM differs from expected by this %"
              InputProps={{ inputProps: { min: 0, max: 100, step: 0.5 } }}
            />
          </Grid>

          <Grid item xs={12} md={8}>
            <FormControl fullWidth>
              <InputLabel>Default distribution type</InputLabel>
              <Select
                value={defaultDistributionType}
                label="Default distribution type"
                onChange={(e) => setDefaultDistributionType(e.target.value)}
              >
                {DISTRIBUTION_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Used when a client/role benchmark does not have a specific distribution set.
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={businessDaysOnlyDefault}
                  onChange={(e) => setBusinessDaysOnlyDefault(e.target.checked)}
                />
              }
              label="Default to business days only"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={includeSubmittedDefault}
                  onChange={(e) => setIncludeSubmittedDefault(e.target.checked)}
                />
              }
              label="Default to include submitted timecards"
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={saving || Boolean(validationError)}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Benchmarks & Distribution Notes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Benchmarks are set per client and role (in the Client module). Each benchmark can also have its own distribution type
          (front-loaded / back-loaded / linear). This Reports Settings page controls the default distribution type used when a benchmark
          does not specify one.
        </Typography>
      </Paper>

      <BenchmarkDistributionManager />
    </Box>
  );
};

const BenchmarkDistributionManager = () => {
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState(new Set());
  const [bulkDistributionType, setBulkDistributionType] = useState('linear');
  const [expandedClients, setExpandedClients] = useState(new Set());

  useEffect(() => {
    const loadBenchmarks = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllBenchmarks();
        setBenchmarks(data);
      } catch (err) {
        setError(err.message || 'Failed to load benchmarks');
        console.error('Error loading benchmarks:', err);
      } finally {
        setLoading(false);
      }
    };
    loadBenchmarks();
  }, []);

  const benchmarksByClient = useMemo(() => {
    const grouped = new Map();
    for (const bm of benchmarks) {
      const clientId = bm.ClientID;
      if (!grouped.has(clientId)) {
        grouped.set(clientId, {
          clientId,
          clientName: bm.ClientName,
          benchmarks: [],
        });
      }
      grouped.get(clientId).benchmarks.push(bm);
    }
    return Array.from(grouped.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [benchmarks]);

  const handleSelectBenchmark = (benchmarkId) => {
    const newSelected = new Set(selectedBenchmarks);
    if (newSelected.has(benchmarkId)) {
      newSelected.delete(benchmarkId);
    } else {
      newSelected.add(benchmarkId);
    }
    setSelectedBenchmarks(newSelected);
  };

  const handleSelectAllInClient = (clientBenchmarks) => {
    const newSelected = new Set(selectedBenchmarks);
    const allSelected = clientBenchmarks.every(bm => newSelected.has(bm.BenchmarkID));
    
    if (allSelected) {
      // Deselect all
      clientBenchmarks.forEach(bm => newSelected.delete(bm.BenchmarkID));
    } else {
      // Select all
      clientBenchmarks.forEach(bm => newSelected.add(bm.BenchmarkID));
    }
    setSelectedBenchmarks(newSelected);
  };

  const handleBulkUpdate = async () => {
    if (selectedBenchmarks.size === 0) {
      setError('Please select at least one benchmark');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await bulkUpdateDistributionType(Array.from(selectedBenchmarks), bulkDistributionType);
      
      // Reload benchmarks
      const data = await getAllBenchmarks();
      setBenchmarks(data);
      setSelectedBenchmarks(new Set());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update distribution types');
      console.error('Error bulk updating:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleClient = (clientId) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Benchmark Distribution Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Distribution types updated successfully
        </Alert>
      )}

      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Bulk Update Distribution</InputLabel>
          <Select
            value={bulkDistributionType}
            label="Bulk Update Distribution"
            onChange={(e) => setBulkDistributionType(e.target.value)}
          >
            {DISTRIBUTION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          onClick={handleBulkUpdate}
          disabled={saving || selectedBenchmarks.size === 0}
        >
          {saving ? 'Updating...' : `Update ${selectedBenchmarks.size} Selected`}
        </Button>
        <Typography variant="caption" color="text.secondary">
          {selectedBenchmarks.size} benchmark(s) selected
        </Typography>
      </Box>

      <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
        {benchmarksByClient.map((clientGroup) => {
          const isExpanded = expandedClients.has(clientGroup.clientId);
          const allSelected = clientGroup.benchmarks.every(bm => selectedBenchmarks.has(bm.BenchmarkID));
          const someSelected = clientGroup.benchmarks.some(bm => selectedBenchmarks.has(bm.BenchmarkID));

          return (
            <Accordion
              key={clientGroup.clientId}
              expanded={isExpanded}
              onChange={() => handleToggleClient(clientGroup.clientId)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectAllInClient(clientGroup.benchmarks);
                    }}
                    onChange={() => handleSelectAllInClient(clientGroup.benchmarks)}
                  />
                  <Typography sx={{ fontWeight: 600 }}>
                    {clientGroup.clientName}
                  </Typography>
                  <Chip
                    label={`${clientGroup.benchmarks.length} benchmark(s)`}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>Consultant</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Distribution Type</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clientGroup.benchmarks.map((bm) => (
                        <TableRow key={bm.BenchmarkID}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedBenchmarks.has(bm.BenchmarkID)}
                              onChange={() => handleSelectBenchmark(bm.BenchmarkID)}
                            />
                          </TableCell>
                          <TableCell>{bm.ConsultantName}</TableCell>
                          <TableCell>{bm.Role}</TableCell>
                          <TableCell>
                            <Chip
                              label={DISTRIBUTION_OPTIONS.find(o => o.value === (bm.DistributionType || 'linear'))?.label || 'Linear'}
                              size="small"
                              color={bm.DistributionType === 'linear' ? 'default' : 'primary'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          );
        })}

        {benchmarksByClient.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No benchmarks found
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default SettingsTab;
