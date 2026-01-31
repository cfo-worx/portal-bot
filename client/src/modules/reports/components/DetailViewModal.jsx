import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  Grid,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import dayjs from 'dayjs';
import { getPerformanceReport } from '../../../api/performanceReports';

const formatHours = (v) => (v == null ? '—' : `${Math.round(Number(v))}h`);
const formatCurrency = (v) => (v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const formatPercent = (v) => (v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`);

const DetailViewModal = ({ open, onClose, type, entityId, entityName, filters }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!open || !entityId) {
      setData(null);
      return;
    }

    const loadDetailData = async () => {
      try {
        setLoading(true);
        const detailFilters = {
          ...filters,
          [type === 'client' ? 'clientIds' : 'consultantIds']: [entityId],
        };
        const reportData = await getPerformanceReport(detailFilters);
        setData(reportData);
      } catch (err) {
        console.error('Error loading detail data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDetailData();
  }, [open, entityId, type, filters]);

  const getVarianceColor = (pct) => {
    if (pct == null || !Number.isFinite(Number(pct))) return 'inherit';
    const ap = Math.abs(Number(pct));
    if (ap >= 0.15) return 'error.main';
    if (ap >= 0.05) return 'warning.main';
    return 'success.main';
  };

  const trendData = data?.trend || [];
  const assignmentRows = data?.assignmentRows || data?.assignments || [];
  const summary = data?.summary || {};
  const revenueToDate = Number(summary.revenueToDate ?? 0);
  const gmPctActualToDate = revenueToDate > 0 ? (Number(summary.actualGMToDate ?? 0) / revenueToDate) : null;
  const gmPctExpectedToDate = revenueToDate > 0 ? (Number(summary.expectedGMToDate ?? 0) / revenueToDate) : null;

  const chartData = trendData.map((r) => ({
    date: dayjs(r.date).format('MMM D'),
    expectedHours: Number(r.expectedHoursCumulative ?? 0),
    actualHours: Number(r.actualHoursCumulative ?? 0),
    revenue: Number(r.revenueCumulative ?? 0),
    expectedCost: Number(r.expectedCostCumulative ?? 0),
    actualCost: Number(r.actualCostCumulative ?? 0),
  }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {type === 'client' ? 'Client' : 'Consultant'} Detail: {entityName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {filters.startDate} to {filters.endDate} • As-of: {filters.asOfDate}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : data ? (
          <Box>
            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
              <Tab label="Overview" />
              <Tab label="Assignments" />
              <Tab label="Trends" />
            </Tabs>

            {activeTab === 0 && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Hours Summary
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {formatHours(summary.actualHoursToDate)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Actual (to-date) / {formatHours(summary.expectedHoursToDate)} Expected
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: getVarianceColor(summary.varianceToDatePct), mt: 1 }}
                    >
                      {summary.varianceToDatePct != null
                        ? `${summary.varianceToDatePct > 0 ? '+' : ''}${(Number(summary.varianceToDatePct) * 100).toFixed(1)}% variance`
                        : '—'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Revenue Summary
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {formatCurrency(summary.revenueToDate)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Revenue (to-date) / {formatCurrency(summary.revenuePeriod)} Period Total
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Cost Summary
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {formatCurrency(summary.actualCostToDate)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Actual (to-date) / {formatCurrency(summary.expectedCostToDate)} Expected
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Gross Margin
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {formatCurrency(summary.actualGMToDate)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      GM%: {formatPercent(gmPctActualToDate)} (Expected: {formatPercent(gmPctExpectedToDate)})
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {activeTab === 1 && (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {type === 'client' ? (
                        <>
                          <TableCell>Consultant</TableCell>
                          <TableCell>Role</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>Client</TableCell>
                          <TableCell>Role</TableCell>
                        </>
                      )}
                      <TableCell align="right">Expected</TableCell>
                      <TableCell align="right">Actual</TableCell>
                      <TableCell align="right">Variance</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                      <TableCell align="right">GM%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignmentRows.map((row, idx) => (
                      <TableRow key={idx}>
                        {type === 'client' ? (
                          <>
                            <TableCell>{row.consultantName || '—'}</TableCell>
                            <TableCell>{row.role}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{row.clientName || '—'}</TableCell>
                            <TableCell>{row.role}</TableCell>
                          </>
                        )}
                        <TableCell align="right">{formatHours(row.expectedHoursToDate)}</TableCell>
                        <TableCell align="right">{formatHours(row.actualHoursToDate)}</TableCell>
                        <TableCell
                          align="right"
                          sx={{ color: getVarianceColor(row.varianceToDatePct) }}
                        >
                          {row.varianceToDatePct != null
                            ? `${row.varianceToDatePct > 0 ? '+' : ''}${(Number(row.varianceToDatePct) * 100).toFixed(1)}%`
                            : '—'}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(row.revenueToDate)}</TableCell>
                        <TableCell align="right">
                          {(row.revenueToDate != null && Number(row.revenueToDate) > 0) ? formatPercent(Number(row.actualGMToDate ?? 0) / Number(row.revenueToDate)) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {assignmentRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          No assignment data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Hours Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="expectedHours"
                      stroke="#ff9800"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Expected Hours"
                    />
                    <Line
                      type="monotone"
                      dataKey="actualHours"
                      stroke="#1976d2"
                      strokeWidth={2}
                      dot={false}
                      name="Actual Hours"
                    />
                  </LineChart>
                </ResponsiveContainer>

                <Typography variant="subtitle1" sx={{ mt: 4, mb: 2, fontWeight: 600 }}>
                  Revenue & Cost Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#4caf50"
                      strokeWidth={2}
                      dot={false}
                      name="Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="expectedCost"
                      stroke="#ff9800"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Expected Cost"
                    />
                    <Line
                      type="monotone"
                      dataKey="actualCost"
                      stroke="#f44336"
                      strokeWidth={2}
                      dot={false}
                      name="Actual Cost"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Box>
        ) : (
          <Typography>No data available</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DetailViewModal;

