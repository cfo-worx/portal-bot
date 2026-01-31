// frontend/src/components/TimeEntryDrawer.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
  Drawer,
  Box,
  TextField,
  Button,
  MenuItem,
  Typography,
  CircularProgress,
  Alert,
  Collapse,
} from '@mui/material';
import dayjs from 'dayjs';
import { addOrUpdateTimecardLine } from '../../../api/timecards';
import { getActiveClientsForConsultant } from '../../../api/clients';
import { AuthContext } from '../../../context/AuthContext';





/** Helper: Round to the nearest 0.5 */
const roundToHalf = (num) => Math.round(num * 2) / 2;

const TimeEntryDrawer = ({ open, onClose, onRefresh, date, entry }) => {
  const { auth } = useContext(AuthContext);
  const consultantID = auth.user?.consultantId;

  // State for client dropdown
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Save and alert states
  const [loadingSave, setLoadingSave] = useState(false);
  const [errorSave, setErrorSave] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Determine if the entry is editable
  const isEditable = entry
    ? !['Approved', 'Submitted'].includes(entry.Status)
    : true;

  // Form state – default new entry has a blank clientID
  const [formData, setFormData] = useState({
    clientID: '',
    projectID: '',
    projectTask: '',
    clientFacingHours: 0,
    nonClientFacingHours: 0,
    otherTaskHours: 0,
    notes: '',
  });

  // Effect 1: Fetch active clients when the drawer opens.
  useEffect(() => {
    if (!open) return;
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const clientData = await getActiveClientsForConsultant(consultantID);
        if (clientData && clientData.length > 0) {
          // Sort clients alphabetically by ClientName
          clientData.sort((a, b) =>
            a.ClientName.localeCompare(b.ClientName)
          );
          setClients(clientData);
        } else {
          setClients([]);
        }
      } catch (error) {
        console.error('Error fetching active clients:', error);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, [open]);

  // Effect 2: When "entry" changes, prepopulate the form.
  useEffect(() => {
    if (entry) {
      setFormData({
        clientID: entry.ClientID || '',
        projectID: entry.ProjectID || '',
        projectTask: entry.ProjectTask || '',
        clientFacingHours: entry.ClientFacingHours || 0,
        nonClientFacingHours: entry.NonClientFacingHours || 0,
        otherTaskHours: entry.OtherTaskHours || 0,
        notes: entry.Notes || '',
      });
    } else {
      // New entry: keep clientID blank
      setFormData({
        clientID: '',
        projectID: '',
        projectTask: '',
        clientFacingHours: 0,
        nonClientFacingHours: 0,
        otherTaskHours: 0,
        notes: '',
      });
    }
  }, [entry]);

  // Effect 3: Once clients are loaded, if editing and the entry's client exists, set it.
  useEffect(() => {
    if (entry && clients.length > 0) {
      // Compare in a case-insensitive way in case of GUID formatting differences.
      const found = clients.find(
        (c) =>
          c.ClientID.toLowerCase() === (entry.ClientID || '').toLowerCase()
      );
      if (found && formData.clientID !== entry.ClientID) {
        setFormData((prev) => ({ ...prev, clientID: entry.ClientID }));
      }
    }
  }, [clients, entry, formData.clientID]);

  // Handle input changes (including rounding for hour fields)
  const handleChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    if (
      ['clientFacingHours', 'nonClientFacingHours', 'otherTaskHours'].includes(name)
    ) {
      if (value === '') {
        newValue = '';
      } else {
        const num = parseFloat(value);
        newValue = !isNaN(num) ? roundToHalf(num) : '';
      }
    }
    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  // Clear hour fields on focus if the value is 0
  const handleFocus = (e) => {
    const { name, value } = e.target;
    if (
      ['clientFacingHours', 'nonClientFacingHours', 'otherTaskHours'].includes(name) &&
      (value === 0 || value === '0')
    ) {
      setFormData((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Save handler with validation: ensure a client is selected.
  const handleSave = async () => {
    if (!isEditable) return;
    if (!formData.clientID) {
  setErrorSave('Please select a Client.');
  return;
}

// Enforce: If no project is selected, Notes is required
if (!formData.projectID && formData.notes.trim() === '') {
  setErrorSave('Please enter Notes when no Project is selected.');
  return;
}


    setLoadingSave(true);
    setErrorSave(null);

    const lineData = {
      TimecardLineID: entry?.TimecardLineID || undefined,
      ConsultantID: consultantID,
      TimesheetDate: dayjs(date).format('YYYY-MM-DD'),
      ClientID: formData.clientID,
      ProjectID: formData.projectID,
      ProjectTask: formData.projectTask,
      TaskID: formData.projectTask, // adjust if needed
      ClientFacingHours:
        formData.clientFacingHours === ''
          ? 0
          : parseFloat(formData.clientFacingHours),
      NonClientFacingHours:
        formData.nonClientFacingHours === ''
          ? 0
          : parseFloat(formData.nonClientFacingHours),
      OtherTaskHours:
        formData.otherTaskHours === ''
          ? 0
          : parseFloat(formData.otherTaskHours),
      Status: entry?.Status || 'Open',
      Notes: formData.notes,
      CreatedOn: entry?.CreatedOn || new Date(),
      UpdatedOn: new Date(),
    };

    try {
      await addOrUpdateTimecardLine(lineData);
      if (onRefresh) {
        onRefresh();
      }
      setSuccessMessage('Time entry saved successfully!');
      // Optionally, reset fields for a new entry (clientID remains unchanged if editing)
      setFormData((prev) => ({
        ...prev,
        projectID: '',
        projectTask: '',
        clientFacingHours: 0,
        nonClientFacingHours: 0,
        otherTaskHours: 0,
        notes: '',
      }));
    } catch (error) {
      console.error('Error saving time entry:', error);
      setErrorSave(error.response?.data || 'Failed to save time entry.');
    } finally {
      setLoadingSave(false);
    }
  };

  const projectsForSelectedClient = clients
  .filter((c) => c.ClientID === formData.clientID && c.ProjectID)
  .map((c) => ({ id: c.ProjectID, name: c.ProjectName }));

  // Auto-clear success message after 3 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => onClose && onClose()}
      container={typeof window !== 'undefined' ? document.body : null}
      ModalProps={{
        keepMounted: true,
        disableEnforceFocus: true,
        disablePortal: false,
      }}
      PaperProps={{
        sx: {
          position: 'fixed',
          zIndex: 9999,
          paddingTop: '80px',
        },
      }}
    >
      <Box sx={{ width: 350, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {entry ? 'Edit Time Entry' : 'Add Time Entry'}
        </Typography>

        <Collapse in={!!successMessage} sx={{ mb: successMessage ? 2 : 0 }}>
          {successMessage && (
            <Alert
              severity="success"
              onClose={() => setSuccessMessage('')}
              sx={{ mb: 2 }}
            >
              {successMessage}
            </Alert>
          )}
        </Collapse>

        {!isEditable && entry && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This time entry is {entry.Status} and cannot be edited.
          </Alert>
        )}

        {/* Client Dropdown */}
        <TextField
          select
          label="Client"
          name="clientID"
          value={formData.clientID}
          onChange={handleChange}
          fullWidth
          sx={{ mb: 2 }}
          disabled={!isEditable || loadingClients}
        >
          {loadingClients ? (
            <MenuItem disabled>
              <CircularProgress size={24} />
            </MenuItem>
          ) : clients.length === 0 ? (
            <MenuItem value="" disabled>
              No Active Clients Found
            </MenuItem>
          ) : (
            clients.map((c) => (
              <MenuItem key={c.ClientID} value={c.ClientID}>
                {c.ClientName}
              </MenuItem>
            ))
          )}
        </TextField>

        {/* Project Dropdown*/}
        <TextField
  select
  label="Project"
  name="projectID"
  value={formData.projectID}
  onChange={handleChange}
  fullWidth
  sx={{ mb: 1 }}
  disabled={!isEditable || !formData.clientID || projectsForSelectedClient.length === 0}
>
  {projectsForSelectedClient.length === 0 ? (
    <MenuItem disabled value="">
      No Projects Found
    </MenuItem>
  ) : (
    projectsForSelectedClient.map((p) => (
      <MenuItem key={p.id} value={p.id}>
        {p.name}
      </MenuItem>
    ))
  )}
</TextField>
<Typography variant="caption" color="textSecondary" sx={{ mb: 2 }}>
  {projectsForSelectedClient.length === 0
    ? 'No projects linked to this client.'
    : 'Select a project linked to this client.'}
</Typography>


        {/* Client-Facing Hours */}
        <TextField
          label="Client-Facing Hours"
          type="number"
          name="clientFacingHours"
          fullWidth
          sx={{ mb: 2 }}
          value={formData.clientFacingHours}
          onChange={handleChange}
          onFocus={handleFocus}
          inputProps={{ min: '0', max: '99.5', step: '0.5' }}
          disabled={!isEditable}
        />

        {/* Non-Client Hours */}
        <TextField
          label="Non-Client Hours"
          type="number"
          name="nonClientFacingHours"
          fullWidth
          sx={{ mb: 2 }}
          value={formData.nonClientFacingHours}
          onChange={handleChange}
          onFocus={handleFocus}
          inputProps={{ min: '0', max: '99.5', step: '0.5' }}
          disabled={!isEditable}
        />

        {/* Other Hours */}
        <TextField
          label="Other Hours"
          type="number"
          name="otherTaskHours"
          fullWidth
          sx={{ mb: 2 }}
          value={formData.otherTaskHours}
          onChange={handleChange}
          onFocus={handleFocus}
          inputProps={{ min: '0', max: '99.5', step: '0.5' }}
          disabled={!isEditable}
        />

        {/* Notes */}
        <TextField
          label="Notes"
          name="notes"
          multiline
          rows={3}
          fullWidth
          sx={{ mb: 2 }}
          value={formData.notes}
          onChange={handleChange}
          disabled={!isEditable}
        />

        {errorSave && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorSave}
          </Alert>
        )}

        <Button
          variant="contained"
          fullWidth
          onClick={handleSave}
          disabled={!isEditable || loadingSave}
        >
          {loadingSave ? <CircularProgress size={24} /> : 'Save'}
        </Button>
      </Box>
    </Drawer>
  );
};

export default TimeEntryDrawer;
