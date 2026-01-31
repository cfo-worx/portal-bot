// frontend/src/pages/SetPasswordPage.jsx

import React, { useState } from 'react';
import {
  Button,
  TextField,
  Box,
  Container,
  CssBaseline,
  Typography,
  Alert,
} from '@mui/material';
import { styled } from '@mui/system';
import { useParams, useNavigate } from 'react-router-dom'; // Correct hook import
import { setPassword as setPasswordApi } from '../api/users';

const NeumorphicBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: '16px',
  boxShadow: `
    8px 8px 16px ${theme.palette.grey[300]},
    -8px -8px 16px ${theme.palette.common.white}
  `,
  padding: theme.spacing(4),
}));

const SetPasswordPage = () => {
  const { inviteToken } = useParams(); // Extract the invite token from URL parameters
  const navigate = useNavigate(); // Initialize the navigate function
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset previous error messages
    setError('');
    setSuccess('');

    // Basic validation to ensure passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Optional: Add more password strength validations here

    try {
      // Call the backend API to set the password using the invite token
      await setPasswordApi(inviteToken, password);
      
      // Set success message
      setSuccess('Password set successfully. You can now log in.');

      // Redirect to the sign-in page after a short delay
      setTimeout(() => {
        navigate('/signin'); // Use navigate instead of history.push
      }, 3000);
    } catch (err) {
      // Handle and display errors returned from the API
      setError(err.response?.data || 'Failed to set password.');
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <CssBaseline /> {/* Normalize CSS across browsers */}
      <Box
        sx={{
          marginTop: 8, // Add top margin
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center', // Center the form horizontally
        }}
      >
        <NeumorphicBox>
          <Typography component="h1" variant="h5" gutterBottom>
            Set Your Password
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            {/* Display error message if any */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {/* Display success message if any */}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}
            {/* New Password Field */}
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="New Password"
              type="password"
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* Confirm New Password Field */}
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm New Password"
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Set Password
            </Button>
          </Box>
        </NeumorphicBox>
      </Box>
    </Container>
  );
};

export default SetPasswordPage;
