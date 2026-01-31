// frontend/src/modules/approver/pages/RejectionModal.jsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  IconButton,
  TextField,
  CircularProgress,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Replace with your actual Power Automate URL
const powerAutomateURL =
  'https://prod-178.westus.logic.azure.com:443/workflows/5d7bc99d56af4d00b167e5b2f84f00a9/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=OZm7TT-ibbC1HrltxmFvgVKsSyJE2Ix4tdiH_xJfrwE';

const RejectionModal = ({ open, onClose, rejectingLine, onSubmit }) => {
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState('');

  const submitRejection = async () => {
    if (!rejectionNotes.trim()) {
      setSendError('Rejection notes are required.');
      return;
    }
    setIsSending(true);
    setSendError('');
    try {
      // 1) Update the timesheet line in the backend
      await onSubmit(rejectionNotes);

      // 2) Prepare the payload for Power Automate
      const rejectionEmailPayload = {
        consultantName: `${rejectingLine.FirstName} ${rejectingLine.LastName}`,
        clientName: rejectingLine.ClientName,
        projectName: rejectingLine.ProjectName || '',
        projectTask: rejectingLine.ProjectTask || '',
        timesheetDate: rejectingLine.TimesheetDate,
        rejectionNotes: rejectionNotes,
        notes: rejectingLine.Notes || '',
        companyEmail: rejectingLine.CompanyEmail || '',
      };

      // 3) Send the rejection email via Power Automate
      await fetch(powerAutomateURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rejectionEmailPayload),
      });

      // success
      setSendSuccess(true);
      setTimeout(() => {
        setIsSending(false);
        setSendSuccess(false);
        setRejectionNotes('');
        onClose();
      }, 1500);
    } catch (error) {
      setSendError('Failed to reject. Please try again.');
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setRejectionNotes('');
      setSendError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h6">Reject Timesheet Line</Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {rejectingLine && (
          <>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Consultant:</strong> {rejectingLine.FirstName} {rejectingLine.LastName}
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Client:</strong> {rejectingLine.ClientName}
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Date:</strong> {rejectingLine.TimesheetDate}
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              <strong>Total Hours:</strong> {rejectingLine.TotalHours}
            </Typography>
            <Box mt={2}>
              <TextField
                label="Rejection Notes"
                multiline
                rows={4}
                fullWidth
                variant="outlined"
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                disabled={isSending || sendSuccess}
                required
              />
              {sendError && (
                <Typography variant="body2" color="error" mt={1}>
                  {sendError}
                </Typography>
              )}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={sendSuccess ? <CheckCircleIcon /> : <SendIcon />}
          onClick={submitRejection}
          disabled={isSending || sendSuccess}
          sx={{ position: 'relative' }}
        >
          {sendSuccess ? 'Rejected' : 'Send Rejection'}
          {isSending && (
            <CircularProgress
              size={24}
              sx={{
                color: 'error.main',
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-12px',
                marginLeft: '-12px',
              }}
            />
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RejectionModal;
