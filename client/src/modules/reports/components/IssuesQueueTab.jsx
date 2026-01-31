import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  Grid,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import dayjs from 'dayjs';
import { getWeeklyIssues, upsertIssueNote } from '../../../api/performanceReports';

const decisionOptions = [
  { value: '', label: '—' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'follow_up', label: 'Follow up w/ consultant' },
  { value: 'client_renegotiation', label: 'Client renegotiation' },
  { value: 'change_order', label: 'Change order' },
  { value: 'acceptable', label: 'Acceptable / known variance' },
];

const snoozeOptions = [
  { value: 'none', label: 'No snooze' },
  { value: '1week', label: 'Snooze 1 week' },
  { value: '2weeks', label: 'Snooze 2 weeks' },
  { value: '30days', label: 'Snooze 30 days' },
  { value: 'monthEnd', label: 'Snooze until period end' },
  { value: 'nextPayroll', label: 'Snooze until next payroll' },
];

const IssuesQueueTab = ({ filters }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedIssue, setSelectedIssue] = useState(null);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [snoozeUntil, setSnoozeUntil] = useState('1week');

  const lookbackWeeks = 4;

  const queryParams = useMemo(() => {
    const weekStart = filters.startDate || dayjs().startOf('month').format('YYYY-MM-DD');
    const weekEnd = filters.endDate || dayjs().endOf('month').format('YYYY-MM-DD');

    return {
      weekStart,
      weekEnd,
      lookbackWeeks,
      clientIds: Array.isArray(filters.clientIds) ? filters.clientIds : [],
      consultantIds: Array.isArray(filters.consultantIds) ? filters.consultantIds : [],
      role: filters.role || null,
      includeSubmitted: filters.includeSubmitted,
      businessDaysOnly: filters.businessDaysOnly,
    };
  }, [filters, lookbackWeeks]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const startTime = Date.now();

        // Add timeout handling
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
        );

        const issuesData = await Promise.race([
          getWeeklyIssues(queryParams),
          timeoutPromise,
        ]);

        console.log('IssuesQueueTab - Issues loaded in', Date.now() - startTime, 'ms');
        setData(issuesData);
      } catch (err) {
        setError(err.message || 'Failed to load issues. The request may be taking too long.');
        console.error('Error loading issues:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [queryParams]);

  const issues = useMemo(() => {
    const raw = data?.issues || [];

    // UI-side filtering is a safety net (server should also filter based on query params)
    return raw.filter((issue) => {
      if (queryParams.consultantIds?.length && issue.consultantId && !queryParams.consultantIds.includes(issue.consultantId)) return false;
      if (queryParams.clientIds?.length && issue.clientId && !queryParams.clientIds.includes(issue.clientId)) return false;
      if (queryParams.role && issue.role && String(issue.role).toLowerCase() !== String(queryParams.role).toLowerCase()) return false;
      return true;
    });
  }, [data, queryParams]);

  const formattedIssues = useMemo(() => {
    const lb = lookbackWeeks;
    return issues.map((issue) => {
      const entity = issue.clientName || issue.consultantName || 'Unknown';
      const typeLabel =
        issue.issueType === 'hours_variance' ? 'Hours' :
        issue.issueType === 'utilization_variance' ? 'Util' :
        issue.issueType === 'gm_variance' ? 'GM' :
        issue.issueType === 'attention' ? 'Attention' :
        issue.issueType;
      
      // Format variance label for all issue types
      const varianceLabel = issue.issueType === 'gm_variance' && issue.trailingGMVariancePct != null
        ? `${issue.trailingGMVariancePct > 0 ? '+' : ''}${(Number(issue.trailingGMVariancePct) * 100).toFixed(1)}%`
        : issue.issueType === 'attention'
          ? (issue.daysSinceLastLogged === 'never' 
            ? 'Never logged' 
            : `${issue.daysSinceLastLogged}d ago`)
          : issue.varianceToDatePct != null
            ? `${issue.varianceToDatePct > 0 ? '+' : ''}${(Number(issue.varianceToDatePct) * 100).toFixed(0)}%`
            : issue.actualUtilizationToDate != null
              ? `${((Number(issue.actualUtilizationToDate) - 1) * 100).toFixed(0)}%`
              : '—';


      const repeat = issue.repeatCountLastNWeeks ? `${issue.repeatCountLastNWeeks}x/${lb}w` : `1x/${lb}w`;
      const status = issue.note?.status || 'open';

      return {
        ...issue,
        entity,
        typeLabel,
        varianceLabel,
        repeat,
        status,
      };
    });
  }, [issues, lookbackWeeks]);

  const handleSaveNote = async () => {
    if (!selectedIssue) return;
    try {
      let snoozedUntilDate = null;
      
      if (snoozeUntil === '1week') {
        snoozedUntilDate = dayjs().add(1, 'week').format('YYYY-MM-DD');
      } else if (snoozeUntil === '2weeks') {
        snoozedUntilDate = dayjs().add(2, 'weeks').format('YYYY-MM-DD');
      } else if (snoozeUntil === '30days') {
        snoozedUntilDate = dayjs().add(30, 'days').format('YYYY-MM-DD');
      } else if (snoozeUntil === 'monthEnd') {
        snoozedUntilDate = dayjs(queryParams.weekEnd).format('YYYY-MM-DD');
      } else if (snoozeUntil === 'nextPayroll') {
        // Calculate next payroll date (assuming bi-weekly payroll on Fridays)
        // If today is Friday or before, next payroll is this Friday
        // Otherwise, next payroll is next Friday
        const today = dayjs();
        const dayOfWeek = today.day(); // 0 = Sunday, 5 = Friday
        let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        if (daysUntilFriday === 0) {
          // Today is Friday, next payroll is next Friday (7 days)
          daysUntilFriday = 7;
        } else if (daysUntilFriday < 7) {
          // Next Friday is this week
          daysUntilFriday = daysUntilFriday;
        } else {
          // Next Friday is next week
          daysUntilFriday = daysUntilFriday;
        }
        snoozedUntilDate = today.add(daysUntilFriday, 'days').format('YYYY-MM-DD');
      }

      await upsertIssueNote({
        issueKey: selectedIssue.issueKey,
        issueType: selectedIssue.issueType, // IMPORTANT: send the canonical type (not the display label)
        severity: selectedIssue.severity,
        periodStart: queryParams.weekStart,
        periodEnd: queryParams.weekEnd,
        clientId: selectedIssue.clientId,
        consultantId: selectedIssue.consultantId,
        role: selectedIssue.role,
        status: 'acknowledged',
        decision,
        notes,
        snoozedUntil: snoozedUntilDate,
      });

      // Reload issues using the exact same query params
      const issuesData = await getWeeklyIssues(queryParams);
      setData(issuesData);
      setSelectedIssue(null);
      setDecision('');
      setNotes('');
      setSnoozeUntil('1week');
    } catch (err) {
      console.error('Error saving note:', err);
    }
  };

  const getSeverityColor = (severity) => {
    if (severity === 'critical') return 'error';
    if (severity === 'warning') return 'warning';
    return 'default';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Paper sx={{ flex: 1 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Issues Queue (weekly review)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Period: {queryParams.weekStart} to {queryParams.weekEnd} • Lookback: {lookbackWeeks} weeks
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Entity</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Variance</TableCell>
                <TableCell>Repeat</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {formattedIssues.map((issue) => (
                <TableRow
                  key={issue.issueKey}
                  onClick={() => {
                    setSelectedIssue(issue);
                    setDecision(issue.note?.decision || '');
                    setNotes(issue.note?.notes || '');
                  }}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: selectedIssue?.issueKey === issue.issueKey ? 'rgba(25,118,210,0.06)' : 'inherit',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                  }}
                >
                  <TableCell>{issue.entity}</TableCell>
                  <TableCell>{issue.typeLabel}</TableCell>
                  <TableCell>{issue.varianceLabel}</TableCell>
                  <TableCell>{issue.repeat}</TableCell>
                  <TableCell>
                    <Chip label={issue.severity} color={getSeverityColor(issue.severity)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip label={issue.status} size="small" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}

              {formattedIssues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No issues found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {selectedIssue && (
        <Paper sx={{ width: 420, p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Review Issue
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Entity</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedIssue.entity}</Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedIssue.typeLabel} • {selectedIssue.varianceLabel} • {selectedIssue.repeat}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Decision</InputLabel>
                <Select value={decision} label="Decision" onChange={(e) => setDecision(e.target.value)}>
                  {decisionOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
                multiline
                minRows={5}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Snooze</InputLabel>
                <Select value={snoozeUntil} label="Snooze" onChange={(e) => setSnoozeUntil(e.target.value)}>
                  {snoozeOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button variant="outlined" onClick={() => setSelectedIssue(null)}>Close</Button>
              <Button variant="contained" onClick={handleSaveNote}>Acknowledge</Button>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default IssuesQueueTab;
