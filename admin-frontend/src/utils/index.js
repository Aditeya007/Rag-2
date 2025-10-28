// src/utils/index.js

// ============================================
// Token Management
// ============================================

export function saveToken(token) {
  localStorage.setItem('jwt', token);
}

export function getToken() {
  return localStorage.getItem('jwt');
}

export function removeToken() {
  localStorage.removeItem('jwt');
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  // Comprehensive email regex - RFC 5322 simplified
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requirements: At least 6 characters, one letter, one number
 * @param {string} password - Password to validate
 * @returns {boolean} True if meets requirements
 */
export function isStrongPassword(password) {
  // At least 6 chars, one letter, one number
  return password.length >= 6 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

/**
 * Get password strength message
 * @param {string} password - Password to check
 * @returns {string} Strength message
 */
export function getPasswordStrength(password) {
  if (!password) return '';
  if (password.length < 6) return 'Too short (min 6 characters)';
  if (!/[A-Za-z]/.test(password)) return 'Must contain at least one letter';
  if (!/\d/.test(password)) return 'Must contain at least one number';
  if (password.length < 8) return 'Good, but consider 8+ characters';
  return 'Strong';
}

/**
 * Validate username format
 * Requirements: 3-20 chars, alphanumeric with underscores
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid
 */
export function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * Validate name format (allows letters, spaces, hyphens)
 * @param {string} name - Name to validate
 * @returns {boolean} True if valid
 */
export function isValidName(name) {
  return name && name.trim().length >= 2 && /^[a-zA-Z\s\-']+$/.test(name);
}

// ============================================
// Formatting Utilities
// ============================================

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format error message for display
 * @param {Error|string|Object} error - Error to format
 * @returns {string} Formatted error message
 */
export function formatError(error) {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'An unexpected error occurred.';
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================
// Form Helpers
// ============================================

/**
 * Validate form field and return error message if invalid
 * @param {string} fieldName - Name of field
 * @param {string} value - Field value
 * @returns {string} Error message or empty string if valid
 */
export function validateField(fieldName, value) {
  switch (fieldName) {
    case 'email':
      if (!value) return 'Email is required';
      if (!isValidEmail(value)) return 'Please enter a valid email address';
      return '';
    
    case 'password':
      if (!value) return 'Password is required';
      if (value.length < 6) return 'Password must be at least 6 characters';
      if (!/[A-Za-z]/.test(value)) return 'Password must contain at least one letter';
      if (!/\d/.test(value)) return 'Password must contain at least one number';
      return '';
    
    case 'username':
      if (!value) return 'Username is required';
      if (!isValidUsername(value)) return 'Username must be 3-20 characters (letters, numbers, underscores only)';
      return '';
    
    case 'name':
      if (!value) return 'Name is required';
      if (!isValidName(value)) return 'Please enter a valid name (letters, spaces, hyphens only)';
      return '';
    
    default:
      return '';
  }
}
