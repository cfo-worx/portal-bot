// /var/www/html/client/src/components/ProtectedRoute.jsx

import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import PropTypes from 'prop-types';

/**
 * ProtectedRoute ensures that only authenticated users with the required role can access certain routes.
 * @param {React.Component} children - The component to render if access is granted.
 * @param {string} requiredRole - The role required to access the route.
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { auth } = useContext(AuthContext);

  if (!auth.isAuthenticated) {
    // User is not authenticated
    return <Navigate to="/signin" replace />;
  }

  if (requiredRole && auth.role !== requiredRole) {
    // User does not have the required role
    return <Navigate to="/" replace />;
  }

  // User is authenticated and has the required role
  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredRole: PropTypes.string,
};

export default ProtectedRoute;
