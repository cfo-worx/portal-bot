// src/components/Team/ConsultantForm.jsx

import React, { useState, useEffect } from 'react';
import {
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Snackbar,
  Alert,
  Typography,
  Divider,
} from '@mui/material';
import Modal from '../../../../components/Shared/Modal';
import { validateConsultant } from '../../../../utils/validation';
import { addConsultant, updateConsultant } from '../../../../api/consultants';

const ConsultantForm = ({
  consultant,
  isEditMode,
  onClose,
  refreshConsultants,
}) => {
  // Initialize form data with HireDate defaulted to '1900-01-01'
  const [formData, setFormData] = useState({
    FirstName: '',
    LastName: '',
    CompanyEmail: '',
    PersonalEmail: '',
    PhoneNumber: '',
    EmergencyContactName: '',
    EmergencyContactPhone: '',
    JobTitle: '',
    HireDate: '1900-01-01',
    PayType: '',
    PayRate: '',
    HourlyRate: '',
    TimecardCycle: '',
    DomesticInternational: false,
    Status: true,
    Address: '',
    Category: '',
  });

  // Snackbar state for user notifications
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success', // 'success' | 'error' | 'warning' | 'info'
  });

  // Populate form data when editing an existing consultant
  useEffect(() => {
    if (consultant) {
      setFormData({
        ...consultant,
        // Convert HireDate from yyyy-mm-ddThh:mm:ss to yyyy-mm-dd
        HireDate: consultant.HireDate
          ? consultant.HireDate.split('T')[0]
          : '1900-01-01',
        Category: consultant.Category || '',
      });
    }
  }, [consultant]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // Determine label for PayRate field (changes if PayType is Salary)
  const payRateLabel =
    formData.PayType === 'Salary' ? 'Salary Amount' : 'Pay Rate';

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate the form data
    const errors = validateConsultant(formData);
    if (errors.length > 0) {
      setSnackbar({
        open: true,
        message: errors.join('\n'),
        severity: 'error',
      });
      return;
    }

    try {
      if (consultant) {
        // Update existing consultant
        await updateConsultant(consultant.ConsultantID, formData);
        setSnackbar({
          open: true,
          message: 'Consultant updated successfully.',
          severity: 'success',
        });
      } else {
        // Add new consultant
        await addConsultant(formData);
        setSnackbar({
          open: true,
          message: 'Consultant added successfully.',
          severity: 'success',
        });
      }
      refreshConsultants();
      onClose();
    } catch (error) {
      console.error('Error submitting consultant form:', error);
      setSnackbar({
        open: true,
        message: 'Failed to submit the form. Please try again.',
        severity: 'error',
      });
    }
  };

  const formTitle = consultant ? 'Edit Consultant' : 'Add Consultant';

  return (
    <Modal open={true} onClose={onClose}>
      {/* Container to control overall font size */}
      <div style={{ fontSize: '0.85rem' }}>
        
        {/* Header / Title Section */}
        <Typography variant="h6" style={{ marginBottom: '0.25rem' }}>
          {formTitle}
        </Typography>
        {consultant && (
          <Typography variant="body2" style={{ marginBottom: '1rem' }}>
            {consultant.FirstName} {consultant.LastName}
          </Typography>
        )}
        <Divider style={{ marginBottom: '1rem' }} />

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* First Name */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="First Name"
                name="FirstName"
                value={formData.FirstName}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Last Name */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Last Name"
                name="LastName"
                value={formData.LastName}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Job Title */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Job Title"
                name="JobTitle"
                value={formData.JobTitle}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Company Email */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Company Email"
                name="CompanyEmail"
                value={formData.CompanyEmail}
                onChange={handleChange}
                fullWidth
                type="email"
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Personal Email */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Personal Email"
                name="PersonalEmail"
                value={formData.PersonalEmail}
                onChange={handleChange}
                fullWidth
                type="email"
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Phone Number */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Phone Number"
                name="PhoneNumber"
                value={formData.PhoneNumber}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Emergency Contact Name */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Emergency Contact Name"
                name="EmergencyContactName"
                value={formData.EmergencyContactName}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Emergency Contact Phone */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Emergency Contact Phone"
                name="EmergencyContactPhone"
                value={formData.EmergencyContactPhone}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Hire Date */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Hire Date"
                name="HireDate"
                value={formData.HireDate}
                onChange={handleChange}
                fullWidth
                type="date"
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{
                  shrink: true,
                  style: { fontSize: '0.85rem' },
                }}
              />
            </Grid>

            {/* Pay Type */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl
                fullWidth
                variant="outlined"
                size="small"
                disabled={!isEditMode && consultant}
              >
                <InputLabel id="pay-type-label" style={{ fontSize: '0.85rem' }}>
                  Pay Type
                </InputLabel>
                <Select
                  labelId="pay-type-label"
                  id="pay-type"
                  value={formData.PayType}
                  label="Pay Type"
                  onChange={handleChange}
                  name="PayType"
                  style={{ fontSize: '0.85rem' }}
                >
                  <MenuItem value="Hourly" style={{ fontSize: '0.85rem' }}>
                    Hourly
                  </MenuItem>
                  <MenuItem value="Flat Rate" style={{ fontSize: '0.85rem' }}>
                    Flat Rate
                  </MenuItem>
                  {/* New Salary option */}
                  <MenuItem value="Salary" style={{ fontSize: '0.85rem' }}>
                    Salary
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Pay Rate / Salary Amount */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label={payRateLabel}
                name="PayRate"
                value={formData.PayRate}
                onChange={handleChange}
                fullWidth
                type="number"
                required
                variant="outlined"
                size="small"
                InputProps={{
                  step: '0.01',
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Hourly Rate - Only shown when PayType is Salary */}
            {formData.PayType === 'Salary' && (
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Hourly Rate"
                  name="HourlyRate"
                  value={formData.HourlyRate}
                  onChange={handleChange}
                  fullWidth
                  type="number"
                  variant="outlined"
                  size="small"
                  InputProps={{
                    step: '0.01',
                    readOnly: !isEditMode && consultant,
                    style: { fontSize: '0.85rem' },
                  }}
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>
            )}

            {/* Timecard Cycle */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl
                fullWidth
                variant="outlined"
                size="small"
                disabled={!isEditMode && consultant}
              >
                <InputLabel
                  id="timecard-cycle-label"
                  style={{ fontSize: '0.85rem' }}
                >
                  Timecard Cycle
                </InputLabel>
                <Select
                  labelId="timecard-cycle-label"
                  id="timecard-cycle"
                  value={formData.TimecardCycle}
                  label="Timecard Cycle"
                  onChange={handleChange}
                  name="TimecardCycle"
                  style={{ fontSize: '0.85rem' }}
                >
                  <MenuItem value="Weekly" style={{ fontSize: '0.85rem' }}>
                    Weekly
                  </MenuItem>
                  <MenuItem value="Bi-Weekly" style={{ fontSize: '0.85rem' }}>
                    Bi-Weekly
                  </MenuItem>
                  <MenuItem value="Monthly" style={{ fontSize: '0.85rem' }}>
                    Monthly
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Domestic/International */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.DomesticInternational}
                    onChange={handleChange}
                    name="DomesticInternational"
                    disabled={!isEditMode && consultant}
                    sx={{
                      '& .MuiSvgIcon-root': { fontSize: 18 },
                    }}
                  />
                }
                label={
                  <span style={{ fontSize: '0.85rem' }}>International</span>
                }
              />
            </Grid>

            {/* Status */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.Status}
                    onChange={handleChange}
                    name="Status"
                    disabled={!isEditMode && consultant}
                    sx={{
                      '& .MuiSvgIcon-root': { fontSize: 18 },
                    }}
                  />
                }
                label={
                  <span style={{ fontSize: '0.85rem' }}>Active Status</span>
                }
              />
            </Grid>

            {/* Address */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Address"
                name="Address"
                value={formData.Address}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: !isEditMode && consultant,
                  style: { fontSize: '0.85rem' },
                }}
                InputLabelProps={{ style: { fontSize: '0.85rem' } }}
              />
            </Grid>

            {/* Category */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl
                fullWidth
                variant="outlined"
                size="small"
                disabled={!isEditMode && consultant}
              >
                <InputLabel id="category-label" style={{ fontSize: '0.85rem' }}>
                  Category
                </InputLabel>
                <Select
                  labelId="category-label"
                  id="category"
                  value={formData.Category}
                  label="Category"
                  onChange={handleChange}
                  name="Category"
                  style={{ fontSize: '0.85rem' }}
                >
            
                  <MenuItem value="Hourly" style={{ fontSize: '0.85rem' }}>
                    Hourly
                  </MenuItem>
                  <MenuItem value="Philippines" style={{ fontSize: '0.85rem' }}>
                    Philippines
                  </MenuItem>
                  <MenuItem value="Salary" style={{ fontSize: '0.85rem' }}>
                    Salary
                  </MenuItem>
                  <MenuItem value="Upwork" style={{ fontSize: '0.85rem' }}>
                    Upwork
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Submit Button */}
            {(isEditMode || !consultant) && (
              <Grid item xs={12}>
                <div style={{ textAlign: 'right' }}>
                  <Button type="submit" variant="contained" color="primary">
                    {consultant ? 'Save' : 'Add'}
                  </Button>
                </div>
              </Grid>
            )}
          </Grid>
        </form>
      </div>

      {/* Snackbar for Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Modal>
  );
};

export default ConsultantForm;
