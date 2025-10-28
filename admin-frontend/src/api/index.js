// src/api/index.js

import { API_BASE_URL } from '../config';

/**
 * Generic API request function with error handling
 * @param {string} endpoint - API endpoint (e.g., '/user/me')
 * @param {Object} options - Request configuration
 * @returns {Promise<Object>} Response data
 * @throws {Error} API error with message
 */
export async function apiRequest(endpoint, { method = 'GET', token, data, ...custom } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const options = {
    method,
    headers,
    ...(data ? { body: JSON.stringify(data) } : {}),
    ...custom,
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    // Parse response
    let result;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      result = await res.json();
    } else {
      result = { message: await res.text() };
    }

    // Handle non-OK responses
    if (!res.ok) {
      const errorMessage = result.error || result.message || `API error: ${res.status}`;
      throw new Error(errorMessage);
    }

    return result;
  } catch (error) {
    // Re-throw with better error message
    if (error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
}
