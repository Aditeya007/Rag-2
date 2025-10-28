// src/pages/RegisterPage.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateField, getPasswordStrength } from '../utils';
import Loader from '../components/Loader';

import '../styles/index.css';

function RegisterPage() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [showPasswordStrength, setShowPasswordStrength] = useState(false);

  // Validate entire form
  function validateForm() {
    const newErrors = {};
    
    // Validate each field
    ['name', 'email', 'username', 'password'].forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });
    
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

    // Attempt registration
    const res = await register({
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      username: formData.username.trim(),
      password: formData.password,
    });

    if (res.success) {
      navigate('/dashboard');
    } else {
      setServerError(res.message);
    }
  }

  // Handle input changes
  function handleChange(field) {
    return (e) => {
      setFormData(prev => ({ ...prev, [field]: e.target.value }));
      // Clear field error on change
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    };
  }

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className="auth-container">
      <h2 className="auth-heading">Admin Portal Register</h2>
      
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Full Name
          <input
            type="text"
            className={`auth-input ${errors.name ? 'input-error' : ''}`}
            value={formData.name}
            onChange={handleChange('name')}
            disabled={loading}
            required
            autoFocus
            autoComplete="name"
            placeholder="Enter your full name"
          />
          {errors.name && (
            <span className="field-error">{errors.name}</span>
          )}
        </label>

        <label>
          Email
          <input
            type="email"
            className={`auth-input ${errors.email ? 'input-error' : ''}`}
            value={formData.email}
            onChange={handleChange('email')}
            disabled={loading}
            required
            autoComplete="email"
            placeholder="your.email@example.com"
          />
          {errors.email && (
            <span className="field-error">{errors.email}</span>
          )}
        </label>

        <label>
          Username
          <input
            type="text"
            className={`auth-input ${errors.username ? 'input-error' : ''}`}
            value={formData.username}
            onChange={handleChange('username')}
            disabled={loading}
            required
            autoComplete="username"
            placeholder="Choose a username (3-20 chars)"
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
            value={formData.password}
            onChange={handleChange('password')}
            onFocus={() => setShowPasswordStrength(true)}
            onBlur={() => setShowPasswordStrength(false)}
            disabled={loading}
            required
            autoComplete="new-password"
            placeholder="Create a strong password"
          />
          {errors.password && (
            <span className="field-error">{errors.password}</span>
          )}
          {showPasswordStrength && formData.password && !errors.password && (
            <span className={`password-strength ${passwordStrength === 'Strong' ? 'strong' : 'weak'}`}>
              {passwordStrength}
            </span>
          )}
        </label>

        {serverError && <div className="auth-error">{serverError}</div>}
        
        <button 
          className="auth-btn" 
          type="submit" 
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Register'}
        </button>
      </form>

      {loading && <Loader size="small" message="Creating your account..." />}

      <div className="auth-footer">
        <span>Already have an account?</span>
        <button 
          className="auth-link" 
          onClick={() => navigate('/login')}
          disabled={loading}
        >
          Login
        </button>
      </div>
    </div>
  );
}

export default RegisterPage;
