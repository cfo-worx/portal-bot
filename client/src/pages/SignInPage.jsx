// frontend/src/pages/SignInPage.jsx
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
import logo from '../assets/logo.png';
import { login as loginApi } from '../api/users';
import { useNavigate } from 'react-router-dom';

const NeumorphicBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: '16px',
  boxShadow: `
    8px 8px 16px ${theme.palette.grey[300]},
    -8px -8px 16px ${theme.palette.common.white}
  `,
  padding: theme.spacing(4),
}));

const Logo = styled('img')({
  width: '100%',
  maxWidth: '300px',
  marginBottom: '24px',
});

const SignInPage = ({ onSignIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await loginApi(email, password);
      const { token, user } = response; // 'user' includes roles = ['Admin'] or ['Consultant']

      // Store token in localStorage
      localStorage.setItem('token', token);

      // Let AuthContext know we are signed in
      onSignIn(token);

      // Redirect based on role
      if (user?.roles?.includes('Admin')) {
        navigate('/dashboard/admin');
      } else if (user?.roles?.includes('Consultant')) {
        navigate('/dashboard/consultant');
      } else {
        // Fallback if roles are empty or unrecognized
        navigate('/dashboard/admin');
      }

    } catch (err) {
      setError(err.response?.data || 'Invalid email or password');
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Logo src={logo} alt="Company Logo" />
        <NeumorphicBox>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Sign In
            </Button>
            <Typography variant="body2" color="textSecondary" align="center">
              If you are an admin, use your credentials to sign in.
            </Typography>
          </Box>
        </NeumorphicBox>
      </Box>
    </Container>
  );
};

export default SignInPage;
