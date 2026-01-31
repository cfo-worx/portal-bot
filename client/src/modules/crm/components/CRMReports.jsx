import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Button,
  TextField,
  IconButton,
} from '@mui/material';
// Note: DatePicker requires @mui/x-date-pickers package
// If not installed, use TextField with type="date" as fallback
// import { DatePicker } from '@mui/x-date-pickers/DatePicker';
// import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
// import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import DownloadIcon from '@mui/icons-material/Download';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DataGrid } from '@mui/x-data-grid';
import dayjs from 'dayjs';

import {
  getKPISummary,
  getTrailing12Months,
  getSourceProductivity,
  getRepPerformance,
  getStageBreakdown,
  getActivityTrends,
  exportReport,
} from '../../../api/crmReports';
import { useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';

const formatCurrency = (value) => {
  if (!value) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value) => {
  if (!value) return '0';
  return new Intl.NumberFormat('en-US').format(value);
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const CRMReports = ({ activeRole }) => {
  const { auth } = useContext(AuthContext);
  const isAdminOrManager = activeRole === 'Admin' || activeRole === 'Manager';

  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState('sales');
  const [dateRange, setDateRange] = useState('30'); // '7', '30', '90', 'custom', 'all'
  const [customStartDate, setCustomStartDate] = useState(dayjs().subtract(30, 'day'));
  const [customEndDate, setCustomEndDate] = useState(dayjs());

  const [kpiData, setKpiData] = useState(null);
  const [trailing12Months, setTrailing12Months] = useState([]);
  const [sourceProductivity, setSourceProductivity] = useState([]);
  const [repPerformance, setRepPerformance] = useState([]);
  const [stageBreakdown, setStageBreakdown] = useState([]);
  const [activityTrends, setActivityTrends] = useState([]);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info',
  });

  // Calculate date range params
  const dateParams = useMemo(() => {
    if (dateRange === 'custom') {
      return {
        startDate: customStartDate.format('YYYY-MM-DD'),
        endDate: customEndDate.format('YYYY-MM-DD'),
      };
    } else if (dateRange === 'all') {
      return {};
    } else {
      const days = parseInt(dateRange);
      const endDate = dayjs();
      const startDate = endDate.subtract(days, 'day');
      return {
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
      };
    }
  }, [dateRange, customStartDate, customEndDate]);

  const loadReports = async () => {
    if (!isAdminOrManager) return;
    
    setLoading(true);
    try {
      const params = { module, ...dateParams };
      
      const [
        kpi,
        trailing,
        sources,
        reps,
        stages,
        trends,
      ] = await Promise.all([
        getKPISummary(params),
        getTrailing12Months({ module }),
        getSourceProductivity(params),
        getRepPerformance(params),
        getStageBreakdown(params),
        getActivityTrends({ ...params, groupBy: 'day' }),
      ]);

      setKpiData(kpi);
      setTrailing12Months(trailing);
      setSourceProductivity(sources);
      setRepPerformance(reps);
      setStageBreakdown(stages);
      setActivityTrends(trends);
    } catch (err) {
      console.error('CRM Reports load error:', err);
      setSnackbar({
        open: true,
        message: 'Failed to load CRM reports',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, dateRange, dateParams]);

  const handleExport = async (type) => {
    try {
      await exportReport(type, { module, ...dateParams });
      setSnackbar({
        open: true,
        message: 'Report exported successfully',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to export report',
        severity: 'error',
      });
    }
  };

  const repPerformanceColumns = useMemo(
    () => [
      { field: 'RepName', headerName: 'Rep', flex: 1, minWidth: 200 },
      { field: 'TotalDeals', headerName: 'Total Deals', minWidth: 120, type: 'number' },
      {
        field: 'TotalPipelineValue',
        headerName: 'Pipeline Value',
        minWidth: 150,
        type: 'number',
        valueFormatter: (params) => formatCurrency(params.value),
      },
      { field: 'ClosedWonCount', headerName: 'Closed Won', minWidth: 120, type: 'number' },
      {
        field: 'ClosedWonValue',
        headerName: 'Closed Won Value',
        minWidth: 150,
        type: 'number',
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        field: 'AvgDealValue',
        headerName: 'Avg Deal Value',
        minWidth: 150,
        type: 'number',
        valueFormatter: (params) => formatCurrency(params.value),
      },
      { field: 'CallCount', headerName: 'Calls', minWidth: 100, type: 'number' },
      { field: 'MeetingCount', headerName: 'Meetings', minWidth: 120, type: 'number' },
      { field: 'QuotesSent', headerName: 'Quotes Sent', minWidth: 120, type: 'number' },
    ],
    []
  );

  if (!isAdminOrManager) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" color="error">
          Access Denied
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Reports are only available to Admin and Manager roles.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">CRM Reports</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('rep-performance')}
          >
            Export Rep Performance
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('source-productivity')}
          >
            Export Source Productivity
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('stage-breakdown')}
          >
            Export Stage Breakdown
          </Button>
        </Box>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Tabs value={module} onChange={(e, v) => setModule(v)}>
                <Tab value="sales" label="Sales" />
                <Tab value="sell" label="M&A Sell-Side" />
                <Tab value="buy" label="M&A Buy-Side" />
              </Tabs>
            </Grid>

            <Grid item xs />
            
            <Grid item>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dateRange}
                  label="Date Range"
                  onChange={(e) => setDateRange(e.target.value)}
                >
                  <MenuItem value="7">Last 7 days</MenuItem>
                  <MenuItem value="30">Last 30 days</MenuItem>
                  <MenuItem value="90">Last 90 days</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                  <MenuItem value="all">All Time</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {dateRange === 'custom' && (
              <>
                <Grid item>
                  <TextField
                    label="Start Date"
                    type="date"
                    size="small"
                    value={customStartDate.format('YYYY-MM-DD')}
                    onChange={(e) => setCustomStartDate(dayjs(e.target.value))}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                </Grid>
                <Grid item>
                  <TextField
                    label="End Date"
                    type="date"
                    size="small"
                    value={customEndDate.format('YYYY-MM-DD')}
                    onChange={(e) => setCustomEndDate(dayjs(e.target.value))}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* KPI Tiles */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Pipeline Value
              </Typography>
              <Typography variant="h5">
                {loading ? '—' : formatCurrency(kpiData?.pipelineValue || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatNumber(kpiData?.openDeals || 0)} open deals
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Quotes Sent
              </Typography>
              <Typography variant="h5">
                {loading ? '—' : formatNumber(kpiData?.quotesSent || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Rebook Count
              </Typography>
              <Typography variant="h5">
                {loading ? '—' : formatNumber(kpiData?.rebookCount || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Total Commissions
              </Typography>
              <Typography variant="h5">
                {loading ? '—' : formatCurrency(kpiData?.totalCommissions || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Avg Contract Value
              </Typography>
              <Typography variant="h5">
                {loading ? '—' : formatCurrency(kpiData?.avgContractValue || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Closed Won
              </Typography>
              <Typography variant="h5">
                {loading ? '—' : formatNumber(kpiData?.closedWonCount || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatCurrency(kpiData?.closedWonValue || 0)} value
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Open Deals
              </Typography>
              <Typography variant="h5">
                {loading ? '—' : formatNumber(kpiData?.openDeals || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Total Deals
              </Typography>
              <Typography variant="h5">
                {loading ? '—' : formatNumber((kpiData?.openDeals || 0) + (kpiData?.closedWonCount || 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Trailing 12 Months Chart */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Trailing 12 Months
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trailing12Months}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="Month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value, name) => {
                  if (name.includes('Value') || name.includes('Value')) {
                    return formatCurrency(value);
                  }
                  return formatNumber(value);
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="DealCount"
                stroke="#8884d8"
                name="Deal Count"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="DealValue"
                stroke="#82ca9d"
                name="Deal Value"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ClosedWonCount"
                stroke="#ffc658"
                name="Closed Won Count"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="ClosedWonValue"
                stroke="#ff7300"
                name="Closed Won Value"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Source Productivity Chart */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Source Productivity
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sourceProductivity.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="SourceName" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => formatNumber(value)} />
                  <Legend />
                  <Bar dataKey="DealCount" fill="#8884d8" name="Deal Count" />
                  <Bar dataKey="ClosedWonCount" fill="#82ca9d" name="Closed Won" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Stage Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stageBreakdown}
                    dataKey="DealCount"
                    nameKey="StageName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {stageBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Rep Performance Table */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Rep Performance Breakdown
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => handleExport('rep-performance')}
            >
              Export
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ height: 400, width: '100%' }}>
            <DataGrid
              rows={repPerformance}
              columns={repPerformanceColumns}
              loading={loading}
              disableRowSelectionOnClick
              density="compact"
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { page: 0, pageSize: 25 } },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Activity Trends Chart */}
      {activityTrends.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Activity Trends
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={activityTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ActivityCount" stroke="#8884d8" name="Activities" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default CRMReports;
