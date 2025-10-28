// src/pages/LoginPage.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateField } from '../utils';
import Loader from '../components/Loader';

import '../styles/index.css';

function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  // Validate form before submission
  function validateForm() {
    const newErrors = {};
    
    // Validate username (required, 3-20 chars)
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.length < 3 || username.length > 20) {
      newErrors.username = 'Username must be 3-20 characters';
    }
    
    // Validate password
    const passwordError = validateField('password', password);
    if (passwordError) {
      newErrors.password = passwordError;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    
    // Client-side validation
    if (!validateForm()) {
      return;
    }

    // Attempt login
    const res = await login(username.trim(), password);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setServerError(res.message);
    }
  }

  // Clear field error on change
  function handleUsernameChange(e) {
    setUsername(e.target.value);
    if (errors.username) {
      setErrors(prev => ({ ...prev, username: '' }));
    }
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value);
    if (errors.password) {
      setErrors(prev => ({ ...prev, password: '' }));
    }
  }

  return (
    <div className="auth-container">
      <h2 className="auth-heading">Admin Portal Login</h2>
      
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            className={`auth-input ${errors.username ? 'input-error' : ''}`}
            value={username}
            onChange={handleUsernameChange}
            disabled={loading}
            required
            autoFocus
            autoComplete="username"
            placeholder="Enter your username"
          />
          {errors.username && (
            <span className="field-error">{errors.username}</span>
          )}
        </label>

        <label>
          Password
          <input
            type="password"
            className={`auth-input ${errors.password ? 'input-error' : ''}`}
            value={password}
            onChange={handlePasswordChange}
            disabled={loading}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />
          {errors.password && (
            <span className="field-error">{errors.password}</span>
          )}
        </label>

        {serverError && <div className="auth-error">{serverError}</div>}
        
        <button 
          className="auth-btn" 
          type="submit" 
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      {loading && <Loader size="small" message="Authenticating..." />}

      <div className="auth-footer">
        <span>Don't have an account?</span>
        <button 
          className="auth-link" 
          onClick={() => navigate('/register')}
          disabled={loading}
        >
          Register
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
