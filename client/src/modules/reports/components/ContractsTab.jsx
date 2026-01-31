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
  CircularProgress,
} from '@mui/material';
import dayjs from 'dayjs';
import { getContractsEnding } from '../../../api/performanceReports';

const ContractsTab = ({ filters }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const contractsData = await getContractsEnding({
          asOfDate: filters.asOfDate,
          daysAhead: 60,
          clientIds: filters.clientIds,
        });
        setData(contractsData);
      } catch (err) {
        setError(err.message || 'Failed to load contracts');
        console.error('Error loading contracts:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filters.asOfDate, filters.clientIds]);

  const contracts = useMemo(() => {
    const rows = data?.contracts || [];
    return rows.slice().sort((a, b) => {
      const da = a.effectiveEndDate ? dayjs(a.effectiveEndDate) : null;
      const db = b.effectiveEndDate ? dayjs(b.effectiveEndDate) : null;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.valueOf() - db.valueOf();
    });
  }, [data]);

  const chipFor = (c) => {
    if (c.daysUntilEnd != null && c.daysUntilEnd <= 0) return { label: 'Due', color: 'error' };
    if (c.daysUntilEnd != null && c.daysUntilEnd <= 30) return { label: '≤ 30 days', color: 'warning' };
    if (c.isMonthToMonth) return { label: 'Month-to-month', color: 'info' };
    return { label: 'Active', color: 'primary' };
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
    <Paper>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Contracts — Renewal / Expiration Watchlist (Next 60 Days)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Uses explicit Contract End Date if set; otherwise uses Initial Term End Date (Start Date + Contract Length).
        </Typography>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Client</TableCell>
              <TableCell>Contract</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Effective End</TableCell>
              <TableCell align="right">Days Until End</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contracts.map((c) => {
              const chip = chipFor(c);
              return (
                <TableRow key={c.contractId} hover>
                  <TableCell>{c.clientName || '—'}</TableCell>
                  <TableCell>{c.contractName || '—'}</TableCell>
                  <TableCell>{c.contractType || 'Recurring'}</TableCell>
                  <TableCell>{c.effectiveEndDate || '—'}</TableCell>
                  <TableCell align="right">{c.daysUntilEnd == null ? '—' : `${c.daysUntilEnd}d`}</TableCell>
                  <TableCell>
                    <Chip label={chip.label} color={chip.color} size="small" />
                  </TableCell>
                </TableRow>
              );
            })}

            {contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No contracts found in the watch window.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ContractsTab;
