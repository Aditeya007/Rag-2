// src/config.js

// Base URL for backend API, can be overridden with .env file (REACT_APP_API_BASE)
export const API_BASE_URL = process.env.REACT_APP_API_BASE || '/api';

// If you want to centralize endpoints, add them here:
export const ENDPOINTS = {
  login: '/auth/login',
  register: '/auth/register',
  userMe: '/user/me',
  health: '/health',
  runBot: '/bot/run',
  // Add more as you go
};
