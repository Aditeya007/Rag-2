// src/components/ProtectedRoute.js

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';

/**
 * ProtectedRoute - Guards routes that require authentication
 * Shows loader while checking auth, redirects to login if not authenticated
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Show loader while authentication status is being determined
  if (loading) {
    return <Loader message="Verifying authentication..." />;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Render protected content if authenticated
  return children;
}

export default ProtectedRoute;
