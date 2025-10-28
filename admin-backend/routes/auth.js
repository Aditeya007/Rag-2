// admin-backend/routes/auth.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { name, email, username, password }
 * @security Rate limited to prevent spam registrations
 */
router.post('/register', authLimiter, validateRegister, authController.registerUser);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT token
 * @access  Public
 * @body    { username, password }
 * @security Rate limited to prevent brute force attacks
 */
router.post('/login', authLimiter, validateLogin, authController.loginUser);

// (Optional) Logout or password reset can be added here

module.exports = router;
