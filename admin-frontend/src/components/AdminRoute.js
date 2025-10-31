// src/components/AdminRoute.js

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';

/**
 * AdminRoute - Guards routes that require administrator privileges
 */
function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader message="Verifying authentication..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default AdminRoute;
