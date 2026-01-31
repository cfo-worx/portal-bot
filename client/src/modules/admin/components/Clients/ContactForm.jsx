// src/modules/admin/components/Clients/ContactForm.jsx

import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import { createContact, updateContact } from '../../../../api/contacts'; // Adjust path as needed
// import { v4 as uuidv4 } from 'uuid'; // Remove uuidv4 import as ContactID is now generated in the backend

const ContactForm = ({ client, contact, isEditMode, onClose, refreshContacts }) => {
  const [formData, setFormData] = useState({
    Name: '',
    Title: '',
    PhoneNumber: '',
    Email: '',
    Timezone: '',
  });

  const [errors, setErrors] = useState({});
  const [submissionError, setSubmissionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    console.log('ContactForm - useEffect triggered');
    console.log('isEditMode:', isEditMode);
    console.log('contact:', contact);

    if (isEditMode && contact) {
      setFormData({
        Name: contact.Name || '',
        Title: contact.Title || '',
        PhoneNumber: contact.PhoneNumber || '',
        Email: contact.Email || '',
        Timezone: contact.Timezone || '',
      });
    } else {
      setFormData({
        Name: '',
        Title: '',
        PhoneNumber: '',
        Email: '',
        Timezone: '',
      });
    }
  }, [isEditMode, contact]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
    // Clear the error for the current field
    if (errors[name]) {
      setErrors(prevErrors => ({ ...prevErrors, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.Name.trim()) {
      newErrors.Name = 'Name is required.';
    }

    if (!formData.Email.trim()) {
      newErrors.Email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.Email)) {
      newErrors.Email = 'Email is invalid.';
    }

    // Add more validations as needed (e.g., phone number format)

    setErrors(newErrors);

    // Return true if no errors
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmissionError('');

    console.log('handleSubmit: Starting submission');
    const isValid = validate();
    console.log('handleSubmit: Validation result:', isValid);
    if (!isValid) {
      console.log('handleSubmit: Validation failed:', errors);
      return;
    }

    console.log('handleSubmit: Form is valid. Proceeding to API call...');
    setIsSubmitting(true);

    try {
      // Ensure client and client.ClientID are present
      if (!client || !client.ClientID) {
        throw new Error('Invalid client data: Missing ClientID.');
      }

      let response;
      if (isEditMode) {
        if (!contact || !contact.ContactID) {
          throw new Error('Invalid contact data: Missing ContactID.');
        }

        // console.log('handleSubmit: Editing contact:', contact.ContactID);
        response = await updateContact(client.ClientID, contact.ContactID, {
          ...formData,
          UpdatedOn: new Date(),
        });
        console.log('handleSubmit: Update Contact Response:', response);
      } else {
        // No need to generate ContactID here
        console.log('handleSubmit: Creating new contact');
        response = await createContact(client.ClientID, {
          ...formData,
          CreatedOn: new Date(),
          UpdatedOn: new Date(),
        });
        console.log('handleSubmit: Create Contact Response:', response);
      }

      if (response && response.ContactID) {
        console.log('handleSubmit: Contact created/updated successfully');
        refreshContacts();
        onClose();
      } else {
        console.log('handleSubmit: Invalid response from server: Missing ContactID.');
        throw new Error('Invalid response from server: Missing ContactID.');
      }
    } catch (error) {
      console.error('handleSubmit: Error submitting contact form:', error);
      // Display a user-friendly error message
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

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        {isEditMode ? 'Edit Contact' : 'Add Contact'}
      </Typography>

      {/* Display Submission Error */}
      {submissionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submissionError}
        </Alert>
      )}

      <TextField
        label="Name"
        name="Name"
        value={formData.Name}
        onChange={handleChange}
        fullWidth
        required
        margin="normal"
        error={Boolean(errors.Name)}
        helperText={errors.Name}
      />

      <TextField
        label="Title"
        name="Title"
        value={formData.Title}
        onChange={handleChange}
        fullWidth
        margin="normal"
        error={Boolean(errors.Title)}
        helperText={errors.Title}
      />

      <TextField
        label="Phone Number"
        name="PhoneNumber"
        value={formData.PhoneNumber}
        onChange={handleChange}
        fullWidth
        margin="normal"
        error={Boolean(errors.PhoneNumber)}
        helperText={errors.PhoneNumber}
      />

      <TextField
        label="Email"
        name="Email"
        value={formData.Email}
        onChange={handleChange}
        fullWidth
        required
        margin="normal"
        type="email"
        error={Boolean(errors.Email)}
        helperText={errors.Email}
      />

      <TextField
        label="Timezone"
        name="Timezone"
        value={formData.Timezone}
        onChange={handleChange}
        fullWidth
        margin="normal"
        placeholder="e.g., America/New_York, UTC"
        error={Boolean(errors.Timezone)}
        helperText={errors.Timezone}
      />

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

export default ContactForm;
