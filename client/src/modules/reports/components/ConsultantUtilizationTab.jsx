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
import { getPerformanceReport } from '../../../api/performanceReports';
import DetailViewModal from './DetailViewModal';

const currency = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const normalizeUtilRatio = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // Some legacy code paths may provide percent (e.g., 85) instead of ratio (0.85)
  return n > 1.5 ? n / 100 : n;
};

const pctLabel = (ratio) => (ratio == null ? '—' : `${(ratio * 100).toFixed(0)}%`);

const getUtilizationColor = (percent) => {
  if (percent >= 90) return 'success.main';
  if (percent >= 75) return 'warning.main';
  return 'error.main';
};

const ConsultantUtilizationTab = ({ filters }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedConsultantId, setSelectedConsultantId] = useState(null);
  const [detailModal, setDetailModal] = useState({ open: false, type: null, entityId: null, entityName: null });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const reportData = await getPerformanceReport(filters);
        setData(reportData);
      } catch (err) {
        setError(err.message);
        console.error('Error loading utilization report:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filters]);

  const consultants = useMemo(() => {
    const rows = data?.byConsultant || [];
    
    const clientIds = filters?.clientIds || [];
    const selectedRole = filters?.role || null;
    const hasClientFilter = Array.isArray(clientIds) && clientIds.length > 0;
    const hasRoleFilter = selectedRole && selectedRole !== null && selectedRole !== '';
    
    // Normalize role for comparison (case-insensitive)
    const normalizeRole = (role) => String(role || '').trim().toLowerCase();
    const selectedRoleNorm = hasRoleFilter ? normalizeRole(selectedRole) : null;
    
    // Filter consultants based on selected clientIds and role
    const filtered = rows.filter((c) => {
      // Role filter: check if consultant's jobTitle matches selected role
      let matchesRole = true;
      if (hasRoleFilter) {
        const consultantRole = normalizeRole(c.jobTitle);
        const assignmentRoles = (c.assignments || []).map(a => normalizeRole(a.role));
        // Match if consultant's jobTitle matches OR any assignment role matches
        matchesRole = consultantRole === selectedRoleNorm || assignmentRoles.includes(selectedRoleNorm);
      }
      
      if (!matchesRole) {
        return false;
      }
      
      // Client filter: check if consultant has assignments for any of the selected clients
      if (hasClientFilter) {
        const assignments = c.assignments || [];
        const hasMatchingClient = assignments.some((assignment) => {
          const assignmentClientId = String(assignment.clientId || '');
          return clientIds.some((clientId) => String(clientId) === assignmentClientId);
        });
        
        // Also check if consultant has logged hours for the selected clients
        // (even if no assignments, they might have logged time)
        const assignmentLoad = Number(c.assignmentLoadToDate || 0);
        const clientHours = Number(c.clientLoggedHoursToDate || 0);
        
        // Keep consultants that have:
        // - assignments matching selected clientIds, OR
        // - assignment load > 0 (indicating they have assignments for filtered clients), OR
        // - client logged hours > 0 (indicating they logged time for filtered clients)
        return hasMatchingClient || assignmentLoad > 0 || clientHours > 0;
      }
      
      // If no client filter but role filter is applied, check if they have activity
      if (hasRoleFilter) {
        const assignmentLoad = Number(c.assignmentLoadToDate || 0);
        const clientHours = Number(c.clientLoggedHoursToDate || 0);
        const hasAssignments = c.assignments && Array.isArray(c.assignments) && c.assignments.length > 0;
        return assignmentLoad > 0 || clientHours > 0 || hasAssignments;
      }
      
      // No filters applied, show all
      return true;
    });
    
    return [...filtered].sort((a, b) => (a.consultantName || '').localeCompare(b.consultantName || ''));
  }, [data, filters]);

  const selectedConsultant = useMemo(() => {
    if (!selectedConsultantId) return null;
    return consultants.find((c) => c.consultantId === selectedConsultantId) || null;
  }, [consultants, selectedConsultantId]);

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
            Consultant Utilization (to-date)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            As-of: {filters.asOfDate} • Period: {filters.startDate} to {filters.endDate}
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Consultant</TableCell>
                <TableCell>Title</TableCell>
                <TableCell align="right">Paid Hours (TD)</TableCell>
                <TableCell align="right">Client Hours (TD)</TableCell>
                <TableCell align="right">Bench Hours (TD)</TableCell>
                <TableCell align="right">Bench Cost (TD)</TableCell>
                <TableCell align="right">Assignment Load (TD)</TableCell>
                <TableCell width={150}>Utilization (TD)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {consultants.map((c) => {
                const utilRatio = normalizeUtilRatio(c.utilizationToDate);
                const utilPercent = utilRatio == null ? 0 : utilRatio * 100;

                return (
                  <TableRow
                    key={c.consultantId}
                    onClick={() => setSelectedConsultantId(c.consultantId)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: selectedConsultantId === c.consultantId ? 'rgba(25,118,210,0.06)' : 'inherit',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    }}
                  >
                    <TableCell>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailModal({ open: true, type: 'consultant', entityId: c.consultantId, entityName: c.consultantName });
                        }}
                        sx={{ textTransform: 'none', p: 0, minWidth: 'auto', fontWeight: 600 }}
                      >
                        {c.consultantName}
                      </Button>
                    </TableCell>
                    <TableCell>{c.jobTitle || '—'}</TableCell>
                    <TableCell align="right">{Math.round(Number(c.paidHoursToDate || 0))}h</TableCell>
                    <TableCell align="right">{Math.round(Number(c.clientLoggedHoursToDate || 0))}h</TableCell>
                    <TableCell align="right">{Math.round(Number(c.benchHoursToDate || 0))}h</TableCell>
                    <TableCell align="right">{currency(c.benchCostToDate)}</TableCell>
                    <TableCell align="right">{Math.round(Number(c.assignmentLoadToDate || 0))}h</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, utilPercent)}
                          sx={{ height: 8, borderRadius: 1, bgcolor: 'grey.200' }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ color: getUtilizationColor(utilPercent), fontWeight: 600 }}
                        >
                          {pctLabel(utilRatio)}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}

              {consultants.length === 0 && (
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

      {selectedConsultant && (
        <Paper sx={{ width: 420, p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            {selectedConsultant.consultantName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Assignment view uses benchmark hours grouped by client.
          </Typography>

          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Bench cost (to-date)
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {currency(selectedConsultant.benchCostToDate)}
            </Typography>
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Assignments
          </Typography>

          <TableContainer sx={{ maxHeight: 330 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell align="right">Benchmark (EOM)</TableCell>
                  <TableCell align="right">Expected (TD)</TableCell>
                  <TableCell align="right">Actual (TD)</TableCell>
                  <TableCell align="right">Var (TD)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(selectedConsultant.assignments || []).map((a) => (
                  <TableRow key={a.clientId}>
                    <TableCell>{a.clientName}</TableCell>
                    <TableCell align="right">{Math.round(Number(a.expectedHoursPeriod || 0))}h</TableCell>
                    <TableCell align="right">{Math.round(Number(a.expectedHoursToDate || 0))}h</TableCell>
                    <TableCell align="right">{Math.round(Number(a.actualHoursToDate || 0))}h</TableCell>
                    <TableCell align="right" sx={{ color: a.varianceToDatePct != null && Math.abs(a.varianceToDatePct) >= 0.15 ? 'error.main' : 'text.primary' }}>
                      {a.varianceToDatePct == null ? '—' : `${a.varianceToDatePct > 0 ? '+' : ''}${(Number(a.varianceToDatePct) * 100).toFixed(0)}%`}
                    </TableCell>
                  </TableRow>
                ))}

                {(selectedConsultant.assignments || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No assignments available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
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

export default ConsultantUtilizationTab;
