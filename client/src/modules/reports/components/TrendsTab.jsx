import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography, Switch, FormControlLabel, CircularProgress } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { getPerformanceReport } from '../../../api/performanceReports';

const TrendsTab = ({ filters }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showExpectedRevenue, setShowExpectedRevenue] = useState(true);
  const [showExpectedHours, setShowExpectedHours] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const reportData = await getPerformanceReport(filters);
        setData(reportData);
      } catch (err) {
        setError(err.message);
        console.error('Error loading trends report:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filters]);

  const trendRows = useMemo(() => {
    const trend = data?.trend || [];
    const n = Math.max(1, trend.length);
    const planRevenue = Number(data?.summary?.revenuePeriod ?? 0);

    return trend.map((r, idx) => {
      const revenueDaily = Number(r.revenueDaily ?? 0);
      const actualCostDaily = Number(r.actualCostDaily ?? 0);
      const revenueCumulative = Number(r.revenueCumulative ?? 0);
      const actualCostCumulative = Number(r.actualCostCumulative ?? 0);

      return {
        date: dayjs(r.date).format('MMM D'),
        dateValue: r.date,

        revenueDaily,
        gmDaily: revenueDaily - actualCostDaily,

        revenueCumulative,
        gmCumulative: revenueCumulative - actualCostCumulative,

        expectedRevenueCumulative: planRevenue * ((idx + 1) / n),

        expectedHoursCumulative: Number(r.expectedHoursCumulative ?? 0),
        actualHoursCumulative: Number(r.actualHoursCumulative ?? 0),
      };
    });
  }, [data]);

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Earned Revenue & Gross Margin (Cumulative)
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showExpectedRevenue}
                onChange={(e) => setShowExpectedRevenue(e.target.checked)}
                size="small"
              />
            }
            label="Show expected revenue"
          />
        </Box>

        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis
              tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
              width={90}
            />
            <Tooltip
              formatter={(v) => `$${Number(v).toLocaleString()}`}
            />
            <Legend />
            <Line type="monotone" dataKey="revenueCumulative" stroke="#1976d2" strokeWidth={2} name="Revenue (earned)" dot={false} />
            <Line type="monotone" dataKey="gmCumulative" stroke="#2e7d32" strokeWidth={2} name="Gross margin (earned)" dot={false} />
            {showExpectedRevenue && (
              <Line
                type="monotone"
                dataKey="expectedRevenueCumulative"
                stroke="#ff9800"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Revenue plan (linear)"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Hours Progress vs Expected (Cumulative)
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showExpectedHours}
                onChange={(e) => setShowExpectedHours(e.target.checked)}
                size="small"
              />
            }
            label="Show expected hours"
          />
        </Box>

        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis width={70} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="actualHoursCumulative" stroke="#1976d2" strokeWidth={2} name="Actual hours" dot={false} />
            {showExpectedHours && (
              <Line
                type="monotone"
                dataKey="expectedHoursCumulative"
                stroke="#ff9800"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Expected hours"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Paper>
    </Box>
  );
};

export default TrendsTab;
