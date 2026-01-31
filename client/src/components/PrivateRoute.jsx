// frontend/src/components/PrivateRoute.jsx

import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { auth } = useContext(AuthContext);

  // Check if the user is authenticated
  if (auth.isAuthenticated) {
    return <>{children}</>;
  }

  // If not authenticated, redirect to sign-in page
  return <Navigate to="/signin" replace />;
};

export default PrivateRoute;
