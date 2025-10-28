// src/hooks/useApi.js

import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api';

/**
 * useApi - Custom hook for making authenticated API calls
 * Handles loading, error states, and automatic token injection
 * 
 * @returns {Object} { data, loading, error, execute, reset }
 */
function useApi() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Execute API request
   * @param {string} endpoint - API endpoint (e.g., '/user/me')
   * @param {Object} options - Request options (method, data, etc.)
   */
  const execute = useCallback(
    async (endpoint, options = {}) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiRequest(endpoint, {
          ...options,
          token,
        });
        setData(result);
        return { success: true, data: result };
      } catch (err) {
        const errorMessage = err.message || 'An unexpected error occurred';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

export default useApi;
