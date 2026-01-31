import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
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
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { getPerformanceReport } from '../../../api/performanceReports';
import { CircularProgress } from '@mui/material';
import dayjs from 'dayjs';
import DetailViewModal from './DetailViewModal';

const PerformanceTab = ({ filters }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailModal, setDetailModal] = useState({ open: false, type: null, entityId: null, entityName: null });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const reportData = await getPerformanceReport(filters);
        setData(reportData);
      } catch (err) {
        setError(err.message);
        console.error('Error loading performance report:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filters]);

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

  const kpis = data?.summary || {};
  const byConsultant = data?.byConsultant || [];
  let topIssues = data?.issues || [];
  
  console.log('PerformanceTab - byConsultant data:', byConsultant);
  console.log('PerformanceTab - byConsultant count:', byConsultant.length);
  
  // Apply filters to issues
  if (filters.consultantIds && filters.consultantIds.length > 0) {
    topIssues = topIssues.filter(issue => 
      !issue.consultantId || filters.consultantIds.includes(issue.consultantId)
    );
  }
  if (filters.clientIds && filters.clientIds.length > 0) {
    topIssues = topIssues.filter(issue => 
      !issue.clientId || filters.clientIds.includes(issue.clientId)
    );
  }
  
  // Filter consultants if filter is applied
  let filteredConsultants = byConsultant;
  if (filters.consultantIds && filters.consultantIds.length > 0) {
    filteredConsultants = byConsultant.filter(c => 
      filters.consultantIds.includes(c.consultantId)
    );
  }

  return (
    <Box>
      {/* KPI Cards - Management Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Hours MTD
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {Math.round(kpis.actualHoursToDate || 0)} / {Math.round(kpis.expectedHoursToDate || 0)}
            </Typography>
            <Typography
              variant="body2"
              sx={{ 
                color: (kpis.actualHoursToDate || 0) < (kpis.expectedHoursToDate || 0) ? 'error.main' : 'success.main',
                mt: 1
              }}
            >
              {kpis.expectedHoursToDate ? `${(((kpis.actualHoursToDate || 0) - (kpis.expectedHoursToDate || 0)) / kpis.expectedHoursToDate * 100).toFixed(1)}%` : '0%'} variance
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Plan EOM: {Math.round(kpis.projectedHoursPeriod || 0)}h
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Revenue (to-date)
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              ${kpis.revenueToDate ? (kpis.revenueToDate / 1000).toFixed(0) + 'k' : '0'}
            </Typography>
            <Box sx={{ flex: 1 }} /> {/* Spacer to push content to top */}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Plan EOM: ${kpis.revenuePeriod ? (kpis.revenuePeriod / 1000).toFixed(0) + 'k' : '0'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              GM (to-date)
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              ${kpis.actualGMToDate ? (kpis.actualGMToDate / 1000).toFixed(0) + 'k' : '0'}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {kpis.revenueToDate && kpis.actualGMToDate ? `${((kpis.actualGMToDate / kpis.revenueToDate) * 100).toFixed(1)}%` : '0%'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Proj EOM: ${kpis.projectedGMPeriod ? (kpis.projectedGMPeriod / 1000).toFixed(0) + 'k' : '0'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Bench Cost (to-date)
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600, color: (kpis.benchCostToDate || 0) > 0 ? 'error.main' : 'text.primary' }}>
              ${kpis.benchCostToDate ? (kpis.benchCostToDate / 1000).toFixed(0) + 'k' : '0'}
            </Typography>
            <Box sx={{ flex: 1 }} /> {/* Spacer to push content to top */}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Bench Hours: {Math.round(kpis.benchHoursToDate || 0)}h
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Hours Burn Chart */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Hours Burn: Actual vs Expected (MTD)
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={[
                  {
                    name: 'Actual',
                    hours: Math.round(kpis.actualHoursToDate || 0),
                  },
                  {
                    name: 'Expected',
                    hours: Math.round(kpis.expectedHoursToDate || 0),
                  },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="hours" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Cost MTD: ${kpis.actualCostToDate ? (kpis.actualCostToDate / 1000).toFixed(0) + 'k' : '0'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Consultant Utilization (MTD)
            </Typography>
            {filteredConsultants.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={filteredConsultants.slice(0, 10).map(c => ({
                      name: (c.consultantName || 'Unknown').split(' ')[0],
                      utilization: Math.round((c.utilizationToDate || 0) * 100),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar dataKey="utilization" fill="#2e7d32" />
                  </BarChart>
                </ResponsiveContainer>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Avg: {filteredConsultants.length > 0 
                    ? `${(filteredConsultants.reduce((sum, c) => sum + (c.utilizationToDate || 0), 0) / filteredConsultants.length * 100).toFixed(0)}%`
                    : '0%'}
                </Typography>
              </>
            ) : (
              <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No consultant data available
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Top Issues Table */}
      <Paper sx={{ mt: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Top Issues
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip
                label={`${topIssues.filter(i => i.severity === 'critical' || i.severity === 'CRIT').length} Critical`}
                color="error"
                size="small"
              />
              <Chip
                label={`${topIssues.filter(i => i.severity === 'warning' || i.severity === 'WARN').length} Warning`}
                color="warning"
                size="small"
              />
            </Box>
          </Box>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Severity</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Expected MTD</TableCell>
                <TableCell>Actual MTD</TableCell>
                <TableCell>Proj EOM</TableCell>
                <TableCell>Variance</TableCell>
                {/* <TableCell>Status</TableCell> */}
                {/* <TableCell>Action</TableCell> */}
              </TableRow>
            </TableHead>
            <TableBody>
              {topIssues.map((issue, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Chip
                      label={issue.severity === 'critical' ? 'CRIT' : 'WARN'}
                      size="small"
                      color={issue.severity === 'critical' ? 'error' : 'warning'}
                    />
                  </TableCell>
                  <TableCell>{issue.issueType === 'hours_variance' ? 'Hours' : issue.issueType === 'utilization_variance' ? 'Util' : issue.issueType}</TableCell>
                  <TableCell>
                    {issue.clientName ? (
                      <Button
                        size="small"
                        onClick={() => setDetailModal({ open: true, type: 'client', entityId: issue.clientId, entityName: issue.clientName })}
                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
                      >
                        {issue.clientName}
                      </Button>
                    ) : issue.consultantName ? (
                      <Button
                        size="small"
                        onClick={() => setDetailModal({ open: true, type: 'consultant', entityId: issue.consultantId, entityName: issue.consultantName })}
                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
                      >
                        {issue.consultantName}
                      </Button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{issue.expectedHoursToDate ? `${Math.round(issue.expectedHoursToDate)}h` : '—'}</TableCell>
                  <TableCell>{issue.actualHoursToDate ? `${Math.round(issue.actualHoursToDate)}h` : '—'}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell sx={{ color: (issue.varianceToDatePct || 0) < 0 ? 'error.main' : 'text.primary' }}>
                    {issue.varianceToDatePct ? `${issue.varianceToDatePct > 0 ? '+' : ''}${(issue.varianceToDatePct * 100).toFixed(0)}%` : '—'}
                  </TableCell>
                  {/* <TableCell>{issue.note?.status || 'Open'}</TableCell> */}
                  {/* <TableCell>
                    <Button size="small" variant="outlined">
                      Review
                    </Button>
                  </TableCell> */}
                </TableRow>
              ))}
              {topIssues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No issues found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <DetailViewModal
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, type: null, entityId: null, entityName: null })}
        type={detailModal.type}
        entityId={detailModal.entityId}
        entityName={detailModal.entityName}
        filters={filters}
      />
    </Box>
  );
};

export default PerformanceTab;

