import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import dayjs from 'dayjs';
import { getCapacityPlanning } from '../../../api/performanceReports';

const CapacityPlanningTab = ({ filters }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const asOfDate = filters.asOfDate || dayjs().format('YYYY-MM-DD');
        const planning = await getCapacityPlanning(asOfDate);
        setData(planning);
      } catch (err) {
        setError(err.message || 'Failed to load capacity planning data.');
        console.error('Error loading capacity planning:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filters.asOfDate]);

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
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!data) {
    return null;
  }

  const { capacityPlanning, contractsEndingNextMonth, meta } = data;

  // Apply global report filters (client/consultant/role + active toggles) to the capacity view.
  // Note: The API returns next-month capacity for ALL consultants; we filter client-side to match the global selectors.
  const normalizedRole = (v) => (v == null ? '' : String(v).trim().toLowerCase());

  const filteredCapacityPlanning = (() => {
    const allowedConsultants = (filters?.consultantIds && filters.consultantIds.length > 0)
      ? new Set(filters.consultantIds.map((id) => String(id)))
      : null;
    const allowedClients = (filters?.clientIds && filters.clientIds.length > 0)
      ? new Set(filters.clientIds.map((id) => String(id)))
      : null;
    const roleFilter = filters?.role ? normalizedRole(filters.role) : null;

    const rows = (capacityPlanning || []).filter((p) => {
      if (!allowedConsultants) return true;
      return allowedConsultants.has(String(p.consultantId));
    }).map((p) => {
      let assignments = Array.isArray(p.assignments) ? [...p.assignments] : [];

      // Hide 0h benchmark assignments (noise)
      assignments = assignments.filter((a) => Number(a?.projectedHours ?? 0) !== 0);

      if (allowedClients) {
        assignments = assignments.filter((a) => a?.clientId && allowedClients.has(String(a.clientId)));
      }

      if (roleFilter) {
        assignments = assignments.filter((a) => normalizedRole(a?.role) === roleFilter);
      }

      // Recalculate projected/available/utilization after filtering assignments
      const projectedHours = assignments.reduce((sum, a) => sum + Number(a?.projectedHours ?? 0), 0);
      const capacityHours = Number(p.capacityHours ?? 0);
      const utilization = capacityHours > 0 ? (projectedHours / capacityHours) : 0;
      const availableCapacity = Math.max(0, capacityHours - projectedHours);

      return {
        ...p,
        assignments,
        projectedHours,
        utilization,
        availableCapacity,
      };
    });

    return rows;
  })();

  const filteredContractsEnding = (() => {
    const allowedConsultants = (filters?.consultantIds && filters.consultantIds.length > 0)
      ? new Set(filters.consultantIds.map((id) => String(id)))
      : null;
    const allowedClients = (filters?.clientIds && filters.clientIds.length > 0)
      ? new Set(filters.clientIds.map((id) => String(id)))
      : null;

    return (contractsEndingNextMonth || []).filter((c) => {
      if (allowedClients && c?.clientId && !allowedClients.has(String(c.clientId))) return false;
      if (allowedConsultants && c?.consultantId && !allowedConsultants.has(String(c.consultantId))) return false;
      return true;
    });
  })();

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Capacity Planning: {meta.nextMonthStart} - {meta.nextMonthEnd}
        </Typography>

        {/* Contracts Ending Next Month */}
        {filteredContractsEnding.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Contracts Ending Next Month ({filteredContractsEnding.length})
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Consultant</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell>Contract Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredContractsEnding.map((contract, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{contract.clientName}</TableCell>
                      <TableCell>{contract.consultantName}</TableCell>
                      <TableCell>
                        <Chip
                          label={dayjs(contract.contractEndDate).format('MMM D, YYYY')}
                          color="warning"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{contract.contractType || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Capacity Planning by Consultant */}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Consultant Capacity & Utilization
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Consultant</TableCell>
                <TableCell align="right">Capacity (hrs)</TableCell>
                <TableCell align="right">Projected (hrs)</TableCell>
                <TableCell align="right">Available (hrs)</TableCell>
                <TableCell align="right">Utilization</TableCell>
                <TableCell>Assignments</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCapacityPlanning.map((plan) => (
                <TableRow key={plan.consultantId}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {plan.consultantName}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{Math.round(plan.capacityHours)}</TableCell>
                  <TableCell align="right">{Math.round(plan.projectedHours)}</TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={plan.availableCapacity > 0 ? 'success.main' : 'error.main'}
                    >
                      {Math.round(plan.availableCapacity)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${(plan.utilization * 100).toFixed(0)}%`}
                      color={
                        plan.utilization >= 0.9
                          ? 'error'
                          : plan.utilization >= 0.7
                          ? 'warning'
                          : 'success'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {plan.assignments.map((assignment, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption">
                            {assignment.clientName} ({assignment.role}): {Math.round(assignment.projectedHours)}h
                          </Typography>
                          {assignment.contractEnding && (
                            <Chip
                              label={`Ends ${dayjs(assignment.contractEnding).format('MMM D')}`}
                              color="warning"
                              size="small"
                            />
                          )}
                        </Box>
                      ))}
                      {plan.assignments.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          No assignments
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mt: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Capacity
                </Typography>
                <Typography variant="h5">
                  {Math.round(
                    filteredCapacityPlanning.reduce((sum, p) => sum + p.capacityHours, 0)
                  )}{' '}
                  hrs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Projected
                </Typography>
                <Typography variant="h5">
                  {Math.round(
                    filteredCapacityPlanning.reduce((sum, p) => sum + p.projectedHours, 0)
                  )}{' '}
                  hrs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Available Capacity
                </Typography>
                <Typography variant="h5" color="success.main">
                  {Math.round(
                    filteredCapacityPlanning.reduce((sum, p) => sum + p.availableCapacity, 0)
                  )}{' '}
                  hrs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default CapacityPlanningTab;

