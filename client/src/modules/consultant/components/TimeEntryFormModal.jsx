// frontend/src/components/TimeEntryFormModal.jsx

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';

// Updated clientOptions now includes "X - Time Off"
const clientOptions = ["Client A", "Client B", "Client C", "X - Time Off"];
const projectOptions = ["Project X", "Project Y", "Project Z"];
const taskOptions = ["Task 1", "Task 2", "Task 3"];

const TimeEntryFormModal = ({
  open,
  onClose,
  onSave,
  entry,
  defaultDate,
}) => {
  const [clientName, setClientName] = useState(entry?.ClientName || '');
  const [projectName, setProjectName] = useState(entry?.ProjectName || '');
  const [projectTask, setProjectTask] = useState(entry?.ProjectTask || '');
  const [clientFacingHours, setClientFacingHours] = useState(formatInitialHours(entry?.ClientFacingHours));
  const [nonClientFacingHours, setNonClientFacingHours] = useState(formatInitialHours(entry?.NonClientFacingHours));
  const [otherTaskHours, setOtherTaskHours] = useState(formatInitialHours(entry?.OtherTaskHours));
  const [notes, setNotes] = useState(entry?.Notes || '');

  // Sort client options alphabetically but always put "X - Time Off" at the bottom.
  const sortedClientOptions = [...clientOptions].sort((a, b) => {
    if (a === "X - Time Off") return 1;
    if (b === "X - Time Off") return -1;
    return a.localeCompare(b);
  });

  useEffect(() => {
    if (entry) {
      setClientName(entry.ClientName || '');
      setProjectName(entry.ProjectName || '');
      setProjectTask(entry.ProjectTask || '');
      setClientFacingHours(formatInitialHours(entry.ClientFacingHours));
      setNonClientFacingHours(formatInitialHours(entry.NonClientFacingHours));
      setOtherTaskHours(formatInitialHours(entry.OtherTaskHours));
      setNotes(entry.Notes || '');
    } else {
      setClientName('');
      setProjectName('');
      setProjectTask('');
      setClientFacingHours('0.0');
      setNonClientFacingHours('0.0');
      setOtherTaskHours('0.0');
      setNotes('');
    }
  }, [entry]);

  const handleSave = () => {
    const totalHours = parseFloat(clientFacingHours)
                     + parseFloat(nonClientFacingHours)
                     + parseFloat(otherTaskHours);
    onSave({
      ...entry,
      Date: entry?.Date || defaultDate,
      ClientName: clientName,
      ProjectName: projectName,
      ProjectTask: projectTask,
      ClientFacingHours: parseFloat(clientFacingHours),
      NonClientFacingHours: parseFloat(nonClientFacingHours),
      OtherTaskHours: parseFloat(otherTaskHours),
      TotalHours: parseFloat(totalHours.toFixed(1)),
      Notes: notes
    });
  };

  const handleHoursChange = (value, setter) => {
    let val = value.trim();

    // If empty, allow temporarily
    if (val === '') {
      setter('');
      return;
    }

    // Remove any invalid characters except digits and one dot
    val = val.replace(/[^0-9.]/g, '');

    // If still empty or just '.', reset to '0.0'
    if (val === '.' || val === '') {
      setter('0.0');
      return;
    }

    // If multiple dots, keep only the first
    const dotCount = (val.match(/\./g) || []).length;
    if (dotCount > 1) {
      const firstDotIndex = val.indexOf('.');
      val = val.slice(0, firstDotIndex + 2); // allow only one decimal place temporarily
    }

    // Convert to float
    let num = parseFloat(val);
    if (isNaN(num)) {
      num = 0.0;
    }

    // Clamp between 0 and 99.9
    if (num > 99.9) num = 99.9;
    if (num < 0) num = 0.0;

    // If there's a decimal, limit to one decimal place in display
    const parts = num.toString().split('.');
    if (parts.length === 2 && parts[1].length > 1) {
      num = parseFloat(num.toFixed(1));
    }

    setter(num.toString());
  };

  const handleHoursBlur = (setter, value) => {
    setter(formatHours(value));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      PaperProps={{
        style: { 
          overflow: 'hidden', 
          padding: '8px'
        }
      }}
    >
      <DialogTitle sx={{ fontSize: '1rem' }}>
        {entry ? 'Edit Entry' : 'Add Entry'}
      </DialogTitle>
      <DialogContent dividers sx={{ padding: '8px' }}>
        <Grid container spacing={2} sx={{ fontSize: '0.875rem' }}>
          {/* Client Dropdown */}
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontSize: '0.875rem' }}>Client</InputLabel>
              <Select
                value={clientName}
                label="Client"
                onChange={(e) => setClientName(e.target.value)}
                sx={{ fontSize: '0.875rem' }}
              >
                {sortedClientOptions.map((client) => (
                  <MenuItem key={client} value={client} sx={{ fontSize: '0.875rem' }}>
                    {client}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Project Dropdown */}
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontSize: '0.875rem' }}>Project</InputLabel>
              <Select
                value={projectName}
                label="Project"
                onChange={(e) => setProjectName(e.target.value)}
                sx={{ fontSize: '0.875rem' }}
              >
                {projectOptions.map((project) => (
                  <MenuItem key={project} value={project} sx={{ fontSize: '0.875rem' }}>
                    {project}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Task Dropdown */}
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontSize: '0.875rem' }}>Task</InputLabel>
              <Select
                value={projectTask}
                label="Task"
                onChange={(e) => setProjectTask(e.target.value)}
                sx={{ fontSize: '0.875rem' }}
              >
                {taskOptions.map((task) => (
                  <MenuItem key={task} value={task} sx={{ fontSize: '0.875rem' }}>
                    {task}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Hours Inputs on One Line */}
          <Grid container item xs={12} spacing={1}>
            <Grid item xs={4}>
              <TextField
                label="Client-Facing"
                variant="outlined"
                size="small"
                fullWidth
                inputProps={{ style: { fontSize: '0.875rem', textAlign: 'right' }, maxLength: 5 }}
                InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                value={clientFacingHours}
                onChange={(e) => handleHoursChange(e.target.value, setClientFacingHours)}
                onBlur={() => handleHoursBlur(setClientFacingHours, clientFacingHours)}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Non-Client"
                variant="outlined"
                size="small"
                fullWidth
                inputProps={{ style: { fontSize: '0.875rem', textAlign: 'right' }, maxLength: 5 }}
                InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                value={nonClientFacingHours}
                onChange={(e) => handleHoursChange(e.target.value, setNonClientFacingHours)}
                onBlur={() => handleHoursBlur(setNonClientFacingHours, nonClientFacingHours)}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Other"
                variant="outlined"
                size="small"
                fullWidth
                inputProps={{ style: { fontSize: '0.875rem', textAlign: 'right' }, maxLength: 5 }}
                InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                value={otherTaskHours}
                onChange={(e) => handleHoursChange(e.target.value, setOtherTaskHours)}
                onBlur={() => handleHoursBlur(setOtherTaskHours, otherTaskHours)}
              />
            </Grid>
          </Grid>

          {/* Notes */}
          <Grid item xs={12}>
            <TextField
              label="Notes"
              multiline
              rows={2}
              fullWidth
              size="small"
              sx={{
                '& .MuiInputBase-input': { fontSize: '0.875rem' },
                '& .MuiInputLabel-root': { fontSize: '0.75rem' },
              }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Grid>

          {/* Total Hours */}
          <Grid item xs={12}>
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', textAlign: 'right' }}>
              Total Hours: {(
                parseFloat(clientFacingHours || 0) +
                parseFloat(nonClientFacingHours || 0) +
                parseFloat(otherTaskHours || 0)
              ).toFixed(1)}
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ padding: '8px' }}>
        <Button onClick={onClose} color="inherit" sx={{ fontSize: '0.75rem' }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" sx={{ fontSize: '0.75rem' }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

// Format initial hours on component mount/load
function formatInitialHours(value) {
  if (value === undefined || value === null || isNaN(value)) return '0.0';
  let val = parseFloat(value);
  if (val < 0) val = 0;
  if (val > 99.9) val = 99.9;
  return val.toFixed(1);
}

// Final formatting of hours on blur
function formatHours(value) {
  let val = parseFloat(value);
  if (isNaN(val) || val < 0) val = 0;
  if (val > 99.9) val = 99.9;
  return val.toFixed(1);
}

export default TimeEntryFormModal;
