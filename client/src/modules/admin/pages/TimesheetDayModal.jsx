// frontend/src/modules/approver/pages/TimesheetDayModal.jsx

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  IconButton,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ApproveIcon from '@mui/icons-material/CheckCircle';
import RejectIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import LockOpenIcon from '@mui/icons-material/LockOpen';

import {
  getTimecardLinesByDateAll,
  updateTimecardLine,
  deleteTimecardLine,
} from '../../../api/timecards';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import RejectionModal from './RejectionModal';

dayjs.extend(utc);

const TimesheetDayModal = ({
  open,
  onClose,
  date,
  refreshTrigger,
  onTimeEntryChange,
  clientFilter = '',
  consultantFilter = [],
}) => {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [approvingAll, setApprovingAll] = useState(false);

  // For rejection flow
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingLine, setRejectingLine] = useState(null);

  // Re-fetch when modal opens, date changes, refreshTrigger toggles, or filters change
  useEffect(() => {
    if (open) {
      fetchDayData();
    }
  }, [open, date, refreshTrigger, clientFilter, consultantFilter]);

  const fetchDayData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use the calendar date directly (no UTC offset)
      const formattedDate = date.format('YYYY-MM-DD');
      let data = await getTimecardLinesByDateAll(formattedDate);

      // Only keep statuses we care about
      data = data.filter((line) => {
        const st = line.Status.toLowerCase();
        return st === 'submitted' || st === 'rejected' || st === 'approved';
      });

      // Client filter
      if (clientFilter) {
        data = data.filter((line) => line.ClientName === clientFilter);
      }

      // Consultant filter (build full name)
      if (consultantFilter.length > 0) {
        data = data.filter((line) => {
          const fullName = `${line.FirstName} ${line.LastName}`.trim();
          return consultantFilter.includes(fullName);
        });
      }

      setLines(data);
    } catch (err) {
      setError(err.message || 'Failed to load timesheet entries.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (line) => {
    try {
      await updateTimecardLine(line.TimecardLineID, { Status: 'Approved' });
      setSnackbar({ open: true, message: 'Line approved', severity: 'success' });
      fetchDayData();
      onTimeEntryChange?.(true);
    } catch {
      setSnackbar({ open: true, message: 'Failed to approve line', severity: 'error' });
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      const toApprove = lines.filter((l) => l.Status.toLowerCase() === 'submitted');
      if (toApprove.length === 0) {
        setSnackbar({ open: true, message: 'No submitted lines to approve', severity: 'info' });
      } else {
        await Promise.all(
          toApprove.map((line) =>
            updateTimecardLine(line.TimecardLineID, { Status: 'Approved' })
          )
        );
        setSnackbar({
          open: true,
          message: 'All submitted lines approved',
          severity: 'success',
        });
        fetchDayData();
        onTimeEntryChange?.(true);
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to approve all lines', severity: 'error' });
    } finally {
      setApprovingAll(false);
    }
  };

  const handleReject = (line) => {
    setRejectingLine(line);
    setRejectModalOpen(true);
  };

  const handleDelete = async (line) => {
    if (!window.confirm('Are you sure you want to delete this timesheet entry?')) return;
    try {
      await deleteTimecardLine(line.TimecardLineID);
      setSnackbar({ open: true, message: 'Line deleted', severity: 'success' });
      fetchDayData();
      onTimeEntryChange?.(true);
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete line', severity: 'error' });
    }
  };

  const handleUnlock = async (line) => {
    try {
      await updateTimecardLine(line.TimecardLineID, { IsLocked: false, Status: 'Open' });
      setSnackbar({ open: true, message: 'Line unlocked', severity: 'success' });
      fetchDayData();
      onTimeEntryChange?.(true);
    } catch {
      setSnackbar({ open: true, message: 'Failed to unlock line', severity: 'error' });
    }
  };

  const getBorderColor = (status) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      case 'submitted':
        return 'gray';
      default:
        return 'transparent';
    }
  };

  // Total hours for the day
  const totalDayHours = lines
    .reduce(
      (sum, l) =>
        sum +
        (parseFloat(l.ClientFacingHours) || 0) +
        (parseFloat(l.NonClientFacingHours) || 0) +
        (parseFloat(l.OtherTaskHours) || 0),
      0
    )
    .toFixed(1);

  // Sort by consultant name
  const sortedLines = [...lines].sort((a, b) => {
    const nameA = `${a.FirstName} ${a.LastName}`.toLowerCase();
    const nameB = `${b.FirstName} ${b.LastName}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="h6">
            {dayjs(date).format('MMMM D, YYYY')}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ minHeight: 300 }}>
          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
              }}
            >
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          ) : sortedLines.length === 0 ? (
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
              No timesheet entries for this day.
            </Typography>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  Total Hours: {totalDayHours}
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleApproveAll}
                  disabled={approvingAll}
                >
                  {approvingAll ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    'Approve All'
                  )}
                </Button>
              </Box>

             <TableContainer component={Paper}>
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
          Consultant
        </TableCell>
        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
          Client
        </TableCell>
        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
          Project
        </TableCell>
        <TableCell
          sx={{
            fontSize: '0.8rem',
            fontWeight: 'bold',
            minWidth: 200,
          }}
        >
          Notes
        </TableCell>
        <TableCell
          align="right"
          sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}
        >
          Total
        </TableCell>
        <TableCell
          align="center"
          sx={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: 150 }}
        >
          Actions
        </TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {sortedLines.map((line) => (
        <TableRow
          key={line.TimecardLineID}
          sx={{ borderLeft: `4px solid ${getBorderColor(line.Status)}` }}
        >
          <TableCell sx={{ fontSize: '0.8rem' }}>
            {line.FirstName} {line.LastName}
          </TableCell>
          <TableCell sx={{ fontSize: '0.8rem' }}>
            {line.ClientName}
          </TableCell>
          <TableCell sx={{ fontSize: '0.8rem' }}>
            {line.ProjectNameV2 || <em>—</em>}
          </TableCell>
          <TableCell
            sx={{
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}
          >
            {line.Notes || ''}
          </TableCell>
          <TableCell
            align="right"
            sx={{ fontSize: '0.8rem' }}
          >
            {(
              (parseFloat(line.ClientFacingHours) || 0) +
              (parseFloat(line.NonClientFacingHours) || 0) +
              (parseFloat(line.OtherTaskHours) || 0)
            ).toFixed(1)}
          </TableCell>
          <TableCell align="center">
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              {line.Status.toLowerCase() === 'submitted' && (
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleApprove(line)}
                >
                  <ApproveIcon fontSize="small" />
                </IconButton>
              )}
              {line.Status.toLowerCase() !== 'rejected' && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleReject(line)}
                >
                  <RejectIcon fontSize="small" />
                </IconButton>
              )}
              {['submitted', 'approved', 'rejected'].includes(
                line.Status.toLowerCase()
              ) && (
                <IconButton
                  size="small"
                  onClick={() => handleDelete(line)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
              {line.IsLocked && (
                <IconButton
                  size="small"
                  onClick={() => handleUnlock(line)}
                >
                  <LockOpenIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>

            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {rejectModalOpen && rejectingLine && (
        <RejectionModal
          open={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          rejectingLine={rejectingLine}
          onSubmit={async (notes) => {
            await updateTimecardLine(rejectingLine.TimecardLineID, {
              Status: 'Rejected',
              RejectedNotes: notes,
              IsLocked: false,
            });
            setSnackbar({ open: true, message: 'Line rejected', severity: 'success' });
            fetchDayData();
            onTimeEntryChange?.(true);
          }}
        />
      )}
    </>
  );
};

export default TimesheetDayModal;
