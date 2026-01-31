// frontend/src/contexts/AuthContext.jsx

import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Utility function to decode JWT
const decodeJWT = (token) => {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

// Create the AuthContext
export const AuthContext = createContext();

// Create a provider component
export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    role: null,
    token: null,
    user: null, // Added user object to store detailed user info
  });

  // Initialize authentication state from localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const user = decodeJWT(token);
      if (user) {
        setAuth({
          isAuthenticated: true,
          role: user.roles ? user.roles[0] : null, // Assuming roles are an array
          token,
          user, // Store the entire user object
        });
      } else {
        // Invalid token; remove it and redirect to sign-in
        setAuth({
          isAuthenticated: false,
          role: null,
          token: null,
          user: null,
        });
        localStorage.removeItem('token');
        navigate('/signin');
      }
    }
  }, [navigate]);

  // Function to handle sign-in
  const signIn = (token) => {
    const user = decodeJWT(token);
    if (user) {
      setAuth({
        isAuthenticated: true,
        role: user.roles ? user.roles[0] : null,
        token,
        user,
      });
      localStorage.setItem('token', token);
      navigate('/dashboard'); // Redirect to dashboard upon sign-in
    } else {
      console.error('Invalid token received during sign-in.');
    }
  };

  // Function to handle sign-out
  const signOut = () => {
    setAuth({
      isAuthenticated: false,
      role: null,
      token: null,
      user: null,
    });
    localStorage.removeItem('token');
    navigate('/signin'); // Redirect to sign-in after logout
  };

  return (
    <AuthContext.Provider value={{ auth, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
