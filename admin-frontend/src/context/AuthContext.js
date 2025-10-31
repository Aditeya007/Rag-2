// src/context/AuthContext.js

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('jwt') || '');
  const [loading, setLoading] = useState(true); // Add loading state
  const [activeTenant, setActiveTenantState] = useState(() => {
    const stored = localStorage.getItem('activeTenant');
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to parse stored tenant:', error);
      localStorage.removeItem('activeTenant');
      return null;
    }
  });

  // On mount: fetch user if token exists
  useEffect(() => {
    async function fetchUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/user/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          // Token invalid or expired
          setUser(null);
          setToken('');
          localStorage.removeItem('jwt');
          setActiveTenantState(null);
          localStorage.removeItem('activeTenant');
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [token]);

  // Login helper
  async function login(username, password) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem('jwt', data.token);
        setUser(data.user || null);
        setActiveTenantState(null);
        localStorage.removeItem('activeTenant');
        return { success: true };
      } else {
        setUser(null);
        return { success: false, message: data.error || data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    } finally {
      setLoading(false);
    }
  }

  // Register helper - backend expects: name, email, username, password
  async function register({ name, email, username, password }) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, username, password }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem('jwt', data.token);
        setUser(data.user || null);
        setActiveTenantState(null);
        localStorage.removeItem('activeTenant');
        return { success: true };
      } else {
        setUser(null);
        return { success: false, message: data.error || data.message || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setUser(null);
    setToken('');
    localStorage.removeItem('jwt');
    setActiveTenantState(null);
    localStorage.removeItem('activeTenant');
  }

  const setActiveTenant = useCallback((tenant) => {
    if (tenant) {
      setActiveTenantState(tenant);
      localStorage.setItem('activeTenant', JSON.stringify(tenant));
    } else {
      setActiveTenantState(null);
      localStorage.removeItem('activeTenant');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        activeTenant,
        setActiveTenant
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
