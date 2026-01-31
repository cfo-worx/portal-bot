import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import dayjs from 'dayjs';
import { AuthContext } from '../../../context/AuthContext';
import { getClients, getActiveClientsForConsultant } from '../../../api/clients';
import { getROIDashboard } from '../../../api/roi';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

const formatCurrency = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};

const RoiMetricCard = ({ title, value, subtitle }) => (
  <Card sx={{ flex: '1 1 220px' }}>
    <CardContent>
      <Typography variant="overline">{title}</Typography>
      <Typography variant="h5" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.75 }}>
          {subtitle}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const RoiDashboard = () => {
  const { auth } = useContext(AuthContext);
  const roles = auth?.user?.roles || [];
  const consultantId = auth?.user?.consultantId;

  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const canViewAllClients = roles.includes('Admin') || roles.includes('Manager');

  useEffect(() => {
    const loadClients = async () => {
      try {
        let list = [];
        if (canViewAllClients) {
          list = await getClients();
        } else if (consultantId) {
          list = await getActiveClientsForConsultant(consultantId);
        }
        // Sort clients alphabetically by ClientName
        const sorted = (list || []).sort((a, b) => 
          (a.ClientName || '').localeCompare(b.ClientName || '')
        );
        setClients(sorted);
      } catch (e) {
        console.error(e);
      }
    };

    loadClients();
  }, [canViewAllClients, consultantId]);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getROIDashboard({ month, clientId: clientId || undefined });
        setData(res);
      } catch (e) {
        console.error(e);
        setError('Failed to load ROI dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [month, clientId]);

  const monthLabel = useMemo(() => {
    const d = dayjs(`${month}-01`);
    return d.isValid() ? d.format('MMM YYYY') : month;
  }, [month]);

  const seriesLabels = useMemo(() => (data?.series || []).map((s) => dayjs(`${s.month}-01`).format('MMM YY')), [data]);
  const recurringSeries = useMemo(() => (data?.series || []).map((s) => Number(s.recurring || 0)), [data]);
  const oneTimeSeries = useMemo(() => (data?.series || []).map((s) => Number(s.oneTime || 0)), [data]);
  const totalSeries = useMemo(() => (data?.series || []).map((s) => Number(s.total || 0)), [data]);

  const stackedBarData = useMemo(
    () => ({
      labels: seriesLabels,
      datasets: [
        { label: 'Recurring', data: recurringSeries, stack: 'roi', backgroundColor: '#4caf50' }, // green
        { label: 'One-Time', data: oneTimeSeries, stack: 'roi', backgroundColor: '#f44336' }, // red
      ],
    }),
    [seriesLabels, recurringSeries, oneTimeSeries]
  );

  const lineData = useMemo(
    () => ({
      labels: seriesLabels,
      datasets: [{ 
        label: 'Total ROI', 
        data: totalSeries,
        borderColor: '#4caf50', // green
        backgroundColor: '#4caf50', // green
      }],
    }),
    [seriesLabels, totalSeries]
  );

  const stackedBarOptions = useMemo(
    () => ({
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true } },
    }),
    []
  );

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
    }),
    []
  );

  if (loading) {
    return (
      <Box>
        <Typography>Loading dashboard…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  const totals = data?.totals || {};

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>Month</InputLabel>
          <Select
            label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            renderValue={() => monthLabel}
          >
            {Array.from({ length: 18 }).map((_, i) => {
              const m = dayjs().subtract(i, 'month').format('YYYY-MM');
              return (
                <MenuItem key={m} value={m}>
                  {dayjs(`${m}-01`).format('MMM YYYY')}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 320 }} size="small">
          <InputLabel>Client (optional)</InputLabel>
          <Select
            label="Client (optional)"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <MenuItem value="">
              <em>All clients</em>
            </MenuItem>
            {clients.map((c) => (
              <MenuItem key={c.ClientID} value={c.ClientID}>
                {c.ClientName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {clientId && data?.roiMultiple && (
          <Chip
            label={`ROI Multiple: ${Number(data.roiMultiple.multiple || 0).toFixed(1)}x`}
            sx={{ height: 40, alignSelf: 'center' }}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <RoiMetricCard title={`${monthLabel} Total ROI`} value={formatCurrency(totals.monthTotal)} />
        <RoiMetricCard title={`${monthLabel} Recurring`} value={formatCurrency(totals.monthRecurring)} />
        <RoiMetricCard title={`${monthLabel} One-Time`} value={formatCurrency(totals.monthOneTime)} />
        <RoiMetricCard title={`YTD Total ROI`} value={formatCurrency(totals.ytdTotal)} subtitle={dayjs(`${month}-01`).format('YYYY')} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Card sx={{ flex: '1 1 520px' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              ROI Trend (Last 12 Months)
            </Typography>
            <Line data={lineData} options={lineOptions} />
          </CardContent>
        </Card>

        <Card sx={{ flex: '1 1 520px' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Recurring vs One-Time (Last 12 Months)
            </Typography>
            <Bar data={stackedBarData} options={stackedBarOptions} />
          </CardContent>
        </Card>
      </Box>

      {Array.isArray(data?.byConsultant) && data.byConsultant.length > 0 && (roles.includes('Admin') || roles.includes('Manager')) && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              ROI by Consultant (Last 12 Months)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {data.byConsultant
                .slice(0, 12)
                .map((c) => (
                  <Chip key={c.consultantId} label={`${c.consultantName}: ${formatCurrency(c.total)}`} />
                ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default RoiDashboard;
