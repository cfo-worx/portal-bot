import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  MenuItem,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { createBenchmark, updateBenchmark } from '../../../../api/benchmarks';
import { getActiveConsultants } from '../../../../api/consultants';
import { v4 as uuidv4 } from 'uuid';

const BenchmarkForm = ({
  client,
  benchmark,
  isEditMode,
  onClose,
  refreshBenchmarks,
  allBenchmarks, // The entire list of benchmarks for the client
}) => {
  const [formData, setFormData] = useState({
    ConsultantID: '',
    Role: '',
    LowRangeHours: '',
    TargetHours: '',
    HighRangeHours: '',
    DistributionType: 'linear',
    // new fields:
    BillRate: '',
    calculatedBenchmark: false, // boolean
    EffectiveDate: '',          // date string (YYYY-MM-DD)
    // This was for EndDate usage in history logic
    StartDate: '', // used only in edit mode
  });

  const [consultants, setConsultants] = useState([]);
  const [errors, setErrors] = useState({});
  const [submissionError, setSubmissionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch consultants
    const fetchAllConsultants = async () => {
      try {
        const data = await getActiveConsultants();
        
        // Sort consultants alphabetically by First Name
        const sortedConsultants = data.sort((a, b) =>
          a.FirstName.localeCompare(b.FirstName)
        );
    
        setConsultants(sortedConsultants || []);
      } catch (error) {
        console.error('Error fetching consultants:', error);
      }
    };
    
    fetchAllConsultants();

    // Populate form if edit mode
    if (isEditMode && benchmark) {
      setFormData({
        ConsultantID: benchmark.ConsultantID || '',
        Role: benchmark.Role || '',
        LowRangeHours: benchmark.LowRangeHours || '',
        TargetHours: benchmark.TargetHours || '',
        HighRangeHours: benchmark.HighRangeHours || '',
        DistributionType: benchmark.DistributionType || benchmark.distributionType || 'linear',
        BillRate: benchmark.BillRate || '',
        calculatedBenchmark:
          benchmark.calculatedBenchmark === true || benchmark.calculatedBenchmark === 1,
        EffectiveDate: benchmark.EffectiveDate
          ? new Date(benchmark.EffectiveDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0], // fallback to today
        // For the history end date
        StartDate: new Date().toISOString().split('T')[0],
      });
    } else {
      // New record
      setFormData({
        ConsultantID: '',
        Role: '',
        LowRangeHours: '',
        TargetHours: '',
        HighRangeHours: '',
        DistributionType: 'linear',
        BillRate: '',
        calculatedBenchmark: false,
        EffectiveDate: new Date().toISOString().split('T')[0], // default to today
        StartDate: '', // not used in create
      });
    }
  }, [isEditMode, benchmark]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // If it's a checkbox
    if (type === 'checkbox') {
      if (name === 'calculatedBenchmark') {
        // Attempting to set "calculatedBenchmark" to true?
        if (checked) {
          // Check if there's already one in allBenchmarks
          // Exclude the current record if it's already the "controller"
          const existingController = allBenchmarks.find((b) => {
            const isController = b.calculatedBenchmark === true || b.calculatedBenchmark === 1;
            const isDifferent = b.BenchmarkID !== benchmark?.BenchmarkID; // exclude if editing the same
            return isController && isDifferent;
          });

          if (existingController) {
            // We already have a 'controller'
            setSubmissionError(
              'You cannot set another "Controller" because one is already set for this client.'
            );
            // revert the checkbox
            return;
          }
        }
        // If we made it here, it's safe to update
        setFormData((prev) => ({ ...prev, [name]: checked }));
        setSubmissionError(''); // clear any previous error
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      setSubmissionError(''); // clear any previous error
    }

    // Clear field-level error if present
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.ConsultantID) newErrors.ConsultantID = 'Consultant is required.';
    if (!formData.TargetHours && !formData.calculatedBenchmark) {
      newErrors.TargetHours = 'Target Hours must be a number (unless this is a controller).';
    } else if (!formData.calculatedBenchmark && isNaN(parseFloat(formData.TargetHours))) {
      newErrors.TargetHours = 'Target Hours must be a valid number.';
    }
    if (formData.LowRangeHours && isNaN(parseFloat(formData.LowRangeHours))) {
      newErrors.LowRangeHours = 'Low Range Hours must be a number.';
    }
    if (formData.HighRangeHours && isNaN(parseFloat(formData.HighRangeHours))) {
      newErrors.HighRangeHours = 'High Range Hours must be a number.';
    }
    if (formData.BillRate && isNaN(parseFloat(formData.BillRate))) {
      newErrors.BillRate = 'Bill Rate must be a number.';
    }

    // EffectiveDate check (not strictly required, but you could require a date)
    if (!formData.EffectiveDate) {
      newErrors.EffectiveDate = 'Effective Date is required.';
    }

    // Only validate StartDate if in edit mode
    if (isEditMode && !formData.StartDate) {
      newErrors.StartDate = 'Start Date is required in edit mode.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmissionError('');
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      let response;
      if (isEditMode) {
        response = await updateBenchmark(benchmark.BenchmarkID, {
          ...formData,
          LowRangeHours: parseFloat(formData.LowRangeHours) || 0,
          TargetHours: parseFloat(formData.TargetHours) || 0,
          HighRangeHours: parseFloat(formData.HighRangeHours) || 0,
          BillRate: parseFloat(formData.BillRate) || 0,
          // The server expects a date or a full Date object, either is okay
          EffectiveDate: formData.EffectiveDate
            ? new Date(formData.EffectiveDate)
            : new Date(),
          StartDate: formData.StartDate, // used for history end date
          calculatedBenchmark: formData.calculatedBenchmark ? 1 : 0,
        });
      } else {
        response = await createBenchmark({
          BenchmarkID: uuidv4(),
          ClientID: client.ClientID,
          ConsultantID: formData.ConsultantID,
          Role: formData.Role,
          DistributionType: formData.DistributionType,
          LowRangeHours: parseFloat(formData.LowRangeHours) || 0,
          TargetHours: parseFloat(formData.TargetHours) || 0,
          HighRangeHours: parseFloat(formData.HighRangeHours) || 0,
          BillRate: parseFloat(formData.BillRate) || 0,
          calculatedBenchmark: formData.calculatedBenchmark ? 1 : 0,
          EffectiveDate: formData.EffectiveDate
            ? new Date(formData.EffectiveDate)
            : new Date(),
          CreatedOn: new Date(),
          UpdatedOn: new Date(),
        });
      }

      if (response && response.BenchmarkID) {
        refreshBenchmarks();
        onClose();
      } else {
        throw new Error('Invalid response from server: Missing BenchmarkID.');
      }
    } catch (error) {
      console.error('Error submitting benchmark form:', error);
      if (error.response && error.response.data && error.response.data.error) {
        setSubmissionError(error.response.data.error);
      } else if (error.message) {
        setSubmissionError(error.message);
      } else {
        setSubmissionError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isController = formData.calculatedBenchmark;

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, fontSize: '0.9rem' }}>
      <Typography variant="h6" gutterBottom>
        {isEditMode ? 'Edit Benchmark' : 'Add Benchmark'}
      </Typography>

      {submissionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submissionError}
        </Alert>
      )}

      {/* Consultant Selection */}
      <TextField
        select
        label="Consultant"
        name="ConsultantID"
        value={formData.ConsultantID}
        onChange={handleChange}
        fullWidth
        required
        margin="normal"
        error={Boolean(errors.ConsultantID)}
        helperText={errors.ConsultantID}
      >
        {consultants.map((c) => {
          const fullName = `${c.FirstName || ''} ${c.LastName || ''}`.trim() || 'Unnamed Consultant';
          return (
            <MenuItem key={c.ConsultantID} value={c.ConsultantID}>
              {fullName}
            </MenuItem>
          );
        })}
      </TextField>

      <TextField
        label="Role"
        name="Role"
        value={formData.Role}
        onChange={handleChange}
        fullWidth
        margin="normal"
      />

      <TextField
        select
        label="Distribution Profile"
        name="DistributionType"
        value={formData.DistributionType || 'linear'}
        onChange={handleChange}
        fullWidth
        margin="normal"
        helperText="How benchmark hours should be distributed across the month (used for expected MTD/projection)."
      >
        <MenuItem value="linear">Linear (even)</MenuItem>
        <MenuItem value="front_loaded">Front-loaded</MenuItem>
        <MenuItem value="back_loaded">Back-loaded</MenuItem>
        <MenuItem value="u_shaped">U-shaped</MenuItem>
      </TextField>

      <FormControlLabel
        control={
          <Checkbox
            name="calculatedBenchmark"
            checked={formData.calculatedBenchmark}
            onChange={handleChange}
          />
        }
        label="Controller (Calculated Benchmark)?"
        sx={{ mt: 1 }}
      />

      <TextField
        label="Low Range Hours"
        name="LowRangeHours"
        value={formData.LowRangeHours}
        onChange={handleChange}
        fullWidth
        margin="normal"
        type="number"
        error={Boolean(errors.LowRangeHours)}
        helperText={errors.LowRangeHours}
      />

      <TextField
        label="Target Hours"
        name="TargetHours"
        value={formData.TargetHours}
        onChange={handleChange}
        fullWidth
        margin="normal"
        type="number"
        disabled={isController} // Disable if it's a "Controller"
        error={Boolean(errors.TargetHours)}
        helperText={
          isController
            ? 'Disabled because this is marked as the Controller.'
            : errors.TargetHours
        }
      />

      <TextField
        label="High Range Hours"
        name="HighRangeHours"
        value={formData.HighRangeHours}
        onChange={handleChange}
        fullWidth
        margin="normal"
        type="number"
        error={Boolean(errors.HighRangeHours)}
        helperText={errors.HighRangeHours}
      />

      <TextField
        label="Bill Rate"
        name="BillRate"
        value={formData.BillRate}
        onChange={handleChange}
        fullWidth
        margin="normal"
        type="number"
        error={Boolean(errors.BillRate)}
        helperText={errors.BillRate}
      />

      <TextField
        label="Effective Date"
        name="EffectiveDate"
        value={formData.EffectiveDate}
        onChange={handleChange}
        fullWidth
        margin="normal"
        type="date"
        InputLabelProps={{ shrink: true }}
        error={Boolean(errors.EffectiveDate)}
        helperText={errors.EffectiveDate}
      />

      {/* Show StartDate only if editing (used for History EndDate) */}
      {isEditMode && (
        <TextField
          label="Start Date"
          name="StartDate"
          value={formData.StartDate}
          onChange={handleChange}
          fullWidth
          margin="normal"
          required
          type="date"
          InputLabelProps={{ shrink: true }}
          error={Boolean(errors.StartDate)}
          helperText={errors.StartDate}
        />
      )}

      <Box mt={2} display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          color="primary"
          type="submit"
          sx={{ mr: 1 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
};

export default BenchmarkForm;