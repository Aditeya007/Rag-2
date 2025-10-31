// admin-backend/controllers/authController.js

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { provisionResourcesForUser, ensureUserResources } = require('../services/provisioningService');

/**
 * Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 * @param   {Object} req.body - { name, email, username, password }
 * @returns {Object} { message: string, user: Object }
 */
exports.registerUser = async (req, res) => {
  const { name, email, username, password } = req.body;
  
  try {
    // Sanitize and normalize inputs
    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedUsername = username.trim();
    const sanitizedName = name.trim();
    
    // Check if email or username already exists (parallel queries for performance)
    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email: sanitizedEmail }),
      User.findOne({ username: sanitizedUsername })
    ]);
    
    if (existingEmail) {
      return res.status(400).json({ 
        error: 'Email already in use',
        field: 'email'
      });
    }
    
    if (existingUsername) {
      return res.status(400).json({ 
        error: 'Username already in use',
        field: 'username'
      });
    }

    // Hash the password securely with salt rounds from config or default to 10
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user document with provisioned resources
    const user = new User({ 
      name: sanitizedName, 
      email: sanitizedEmail, 
      username: sanitizedUsername, 
      password: hashedPassword,
      role: 'user',
      isActive: true
    });

    try {
      const resources = provisionResourcesForUser({
        userId: user._id.toString(),
        username: sanitizedUsername
      });
      user.set(resources);
    } catch (provisionErr) {
      console.error('❌ Resource provisioning failed:', provisionErr);
      return res.status(500).json({ error: 'Failed to provision user resources' });
    }

    await user.save();

    console.log(`✅ New user registered: ${sanitizedUsername} (${sanitizedEmail})`);
    
    res.status(201).json({ 
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        resourceId: user.resourceId,
        databaseUri: user.databaseUri,
        botEndpoint: user.botEndpoint,
        schedulerEndpoint: user.schedulerEndpoint,
        scraperEndpoint: user.scraperEndpoint
      }
    });
  } catch (err) {
    console.error('❌ Register error:', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    // Handle duplicate key errors (in case of race condition)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use`,
        field
      });
    }
    
    res.status(500).json({ error: 'Server error during registration' });
  }
};

/**
 * Login a user and return JWT token
 * @route   POST /api/auth/login
 * @access  Public
 * @param   {Object} req.body - { username, password }
 * @returns {Object} { token: string, user: Object }
 */
exports.loginUser = async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Sanitize input
    const sanitizedUsername = username.trim();
    
    // Find user by username
    const user = await User.findOne({ username: sanitizedUsername });
    
    // Use same error message for both invalid username and password
    // This prevents username enumeration attacks
    if (!user) {
      console.warn(`⚠️  Failed login attempt for non-existent user: ${sanitizedUsername}`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.isActive) {
      console.warn(`⚠️  Inactive user attempted login: ${sanitizedUsername}`);
      return res.status(403).json({ error: 'Account is inactive. Please contact support.' });
    }

    // Compare password hash
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      console.warn(`⚠️  Failed login attempt for user: ${sanitizedUsername} (wrong password)`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Get JWT expiration from env or use default
    const jwtExpiration = process.env.JWT_EXPIRATION || '1d';
    
    // Sign JWT token with minimal payload (don't include sensitive data)
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: jwtExpiration,
        algorithm: 'HS256' // Explicitly set algorithm to prevent algorithm confusion attacks
      }
    );
    
    // Make sure resource metadata is always available before issuing token
    await ensureUserResources(user);

    console.log(`✅ User logged in: ${sanitizedUsername}`);
    
    res.json({
      message: 'Login successful',
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        username: user.username, 
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        resourceId: user.resourceId,
        databaseUri: user.databaseUri,
        botEndpoint: user.botEndpoint,
        schedulerEndpoint: user.schedulerEndpoint,
        scraperEndpoint: user.scraperEndpoint
      }
    });
  } catch (err) {
    console.error('❌ Login error:', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    
    // Don't leak error details to client
    res.status(500).json({ error: 'Server error during login' });
  }
};