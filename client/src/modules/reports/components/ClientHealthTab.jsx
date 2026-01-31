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
  LinearProgress,
  CircularProgress,
  Button,
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
} from 'recharts';
import dayjs from 'dayjs';
import { getPerformanceReport } from '../../../api/performanceReports';
import DetailViewModal from './DetailViewModal';

const formatHours = (v) => (v == null ? '—' : `${Math.round(Number(v))}h`);

const ClientHealthTab = ({ filters }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientTrend, setClientTrend] = useState(null);
  const [clientTrendLoading, setClientTrendLoading] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, type: null, entityId: null, entityName: null });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const reportData = await getPerformanceReport(filters);
        setData(reportData);
      } catch (err) {
        setError(err.message);
        console.error('Error loading client health report:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filters]);

  // Load a client-specific trend for drilldown (uses the same PerformanceReport engine)
  useEffect(() => {
    const loadClientTrend = async () => {
      if (!selectedClient?.clientId) {
        setClientTrend(null);
        return;
      }
      try {
        setClientTrendLoading(true);
        const trendData = await getPerformanceReport({
          ...filters,
          clientIds: [selectedClient.clientId],
        });
        setClientTrend(trendData);
      } catch (err) {
        console.error('Error loading client trend:', err);
        setClientTrend(null);
      } finally {
        setClientTrendLoading(false);
      }
    };
    loadClientTrend();
  }, [selectedClient?.clientId, filters]);

  const settings = data?.settings || {};
  const warnPct = Number(settings?.warnPct ?? settings?.HoursVarianceWarnPct ?? 0.05);
  const critPct = Number(settings?.critPct ?? settings?.HoursVarianceCriticalPct ?? 0.15);

  const clientRows = useMemo(() => {
    let rows = data?.byClient || [];

    // Apply client filter if specified (normalize IDs for comparison)
    if (filters.clientIds && filters.clientIds.length > 0) {
      const filterIds = filters.clientIds.map(id => String(id).toLowerCase().trim());
      rows = rows.filter((c) => {
        const clientId = String(c.clientId || '').toLowerCase().trim();
        return filterIds.includes(clientId);
      });
    }

    // Sort alphabetically
    rows = [...rows].sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));

    return rows;
  }, [data, filters.clientIds]);

  const drilldownRows = useMemo(() => {
    const trend = clientTrend?.trend || [];
    return trend.map((r) => ({
      date: dayjs(r.date).format('MMM D'),
      expected: Number(r.expectedHoursCumulative ?? 0),
      actual: Number(r.actualHoursCumulative ?? 0),
    }));
  }, [clientTrend]);

  const getVarianceColor = (pct) => {
    if (pct == null || !Number.isFinite(Number(pct))) return 'inherit';
    const ap = Math.abs(Number(pct));
    if (ap >= critPct) return 'error.main';
    if (ap >= warnPct) return 'warning.main';
    return 'success.main';
  };

  const getVarianceBg = (pct) => {
    if (pct == null || !Number.isFinite(Number(pct))) return 'transparent';
    const ap = Math.abs(Number(pct));
    if (ap >= critPct) return 'rgba(211,47,47,0.08)';
    if (ap >= warnPct) return 'rgba(237,108,2,0.08)';
    return 'transparent';
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
            Client Health (to-date vs benchmark, projected EOM)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            As-of: {filters.asOfDate} • Period: {filters.startDate} to {filters.endDate}
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell align="right">Actual (to-date)</TableCell>
                <TableCell align="right">Expected (to-date)</TableCell>
                <TableCell align="right">Var (to-date)</TableCell>
                <TableCell align="right">Proj EOM</TableCell>
                <TableCell align="right">Benchmark EOM</TableCell>
                <TableCell align="right">Var (EOM)</TableCell>
                <TableCell width={140}>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clientRows.map((c) => {
                const actualTD = Number(c.actualHoursToDate ?? 0);
                const expectedTD = Number(c.expectedHoursToDate ?? 0);
                const ratio = expectedTD > 0 ? Math.min(2, actualTD / expectedTD) : null;
                const ratioPct = ratio == null ? 0 : Math.min(100, ratio * 100);

                const varTdPct = c.varianceToDatePct;
                const varEomPct = c.varianceEomPct;

                return (
                  <TableRow
                    key={c.clientId}
                    onClick={() => setSelectedClient(c)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: selectedClient?.clientId === c.clientId ? 'rgba(25,118,210,0.06)' : getVarianceBg(varEomPct),
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    }}
                  >
                    <TableCell>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailModal({ open: true, type: 'client', entityId: c.clientId, entityName: c.clientName });
                        }}
                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontWeight: 600 }}
                      >
                        {c.clientName}
                      </Button>
                    </TableCell>
                    <TableCell align="right">{formatHours(c.actualHoursToDate)}</TableCell>
                    <TableCell align="right">{formatHours(c.expectedHoursToDate)}</TableCell>
                    <TableCell align="right" sx={{ color: getVarianceColor(varTdPct) }}>
                      {c.varianceToDatePct == null ? '—' : `${c.varianceToDatePct > 0 ? '+' : ''}${(Number(c.varianceToDatePct) * 100).toFixed(0)}%`}
                    </TableCell>
                    <TableCell align="right">{formatHours(c.projectedHoursPeriod)}</TableCell>
                    <TableCell align="right">{formatHours(c.expectedHoursPeriod)}</TableCell>
                    <TableCell align="right" sx={{ color: getVarianceColor(varEomPct) }}>
                      {c.varianceEomPct == null ? '—' : `${c.varianceEomPct > 0 ? '+' : ''}${(Number(c.varianceEomPct) * 100).toFixed(0)}%`}
                    </TableCell>
                    <TableCell>
                      {ratio == null ? (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <LinearProgress variant="determinate" value={ratioPct} />
                          <Typography variant="caption" color="text.secondary">
                            {(ratio * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {clientRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {selectedClient && (
        <Paper sx={{ width: 420, p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            {selectedClient.clientName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click another row to switch. This drilldown pulls a client-filtered trend from the same report engine.
          </Typography>

          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Proj EOM vs Benchmark
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {formatHours(selectedClient.projectedHoursPeriod)}
            </Typography>
            <Typography variant="body2" sx={{ color: getVarianceColor(selectedClient.varianceEomPct) }}>
              {selectedClient.varianceEomPct == null ? '—' : `${selectedClient.varianceEomPct > 0 ? '+' : ''}${(Number(selectedClient.varianceEomPct) * 100).toFixed(0)}% vs benchmark`}
            </Typography>
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Trend (Actual vs Expected hours)
          </Typography>

          {clientTrendLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={drilldownRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="expected" stroke="#ff9800" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Expected" />
                <Line type="monotone" dataKey="actual" stroke="#1976d2" strokeWidth={2} dot={false} name="Actual" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Paper>
      )}

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

export default ClientHealthTab;
