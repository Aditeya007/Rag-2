// admin-backend/controllers/userController.js

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { ensureUserResources } = require('../services/provisioningService');
const { invalidateUserTenantContext } = require('../services/userContextService');

/**
 * Get the currently logged-in user's profile
 * @route   GET /api/user/me
 * @access  Protected (requires JWT)
 * @returns {Object} User object (without password)
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await ensureUserResources(user);

    const safeUser = user.toObject({ versionKey: false });
    delete safeUser.password;
    if (safeUser.role !== 'admin') {
      delete safeUser.vectorStorePath;
    }

    res.json(safeUser);
  } catch (err) {
    console.error('❌ Error fetching user profile:', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    res.status(500).json({ error: 'Server error fetching profile' });
  }
};

/**
 * Update the currently logged-in user's profile
 * @route   PUT /api/user/me
 * @access  Protected (requires JWT)
 * @param   {Object} req.body - { name?, email?, username?, password? }
 * @returns {Object} Updated user object (without password)
 */
exports.updateMe = async (req, res) => {
  const updates = {};
  const { name, email, username, password } = req.body;

  // Build updates object
  if (name) updates.name = name.trim();
  if (email) updates.email = email.toLowerCase().trim();
  if (username) updates.username = username.trim();
  
  // Hash password if provided
  if (password) {
    try {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    } catch (err) {
      console.error('❌ Error hashing password:', err);
      return res.status(500).json({ error: 'Error updating password' });
    }
  }

  try {
    // Check for duplicate email/username before updating
    if (email) {
      const existingEmail = await User.findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: req.user.userId } // Exclude current user
      });
      if (existingEmail) {
        return res.status(400).json({ 
          error: 'Email already in use by another user',
          field: 'email'
        });
      }
    }
    
    if (username) {
      const existingUsername = await User.findOne({ 
        username: username.trim(),
        _id: { $ne: req.user.userId } // Exclude current user
      });
      if (existingUsername) {
        return res.status(400).json({ 
          error: 'Username already in use by another user',
          field: 'username'
        });
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`✅ User profile updated: ${user.username}`);

    invalidateUserTenantContext(req.user.userId);
    
    const responseUser = user.toObject({ versionKey: false });
    if (responseUser.role !== 'admin') {
      delete responseUser.vectorStorePath;
    }

    res.json({
      message: 'Profile updated successfully',
      user: responseUser
    });
  } catch (err) {
    console.error('❌ Profile update error:', err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use`,
        field
      });
    }
    
    res.status(500).json({ error: 'Update failed' });
  }
};
