// admin-backend/middleware/validate.js

/**
 * Validation middleware for request bodies
 * Provides reusable validators for common API endpoints
 */

/**
 * Validate registration request
 * Required: name, email, username, password
 */
exports.validateRegister = (req, res, next) => {
  const { name, email, username, password } = req.body;
  const errors = [];

  // Required fields validation
  if (!name || name.trim() === '') {
    errors.push('Name is required');
  }
  
  if (!email || email.trim() === '') {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  }
  
  if (!username || username.trim() === '') {
    errors.push('Username is required');
  } else if (username.length < 3) {
    errors.push('Username must be at least 3 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }
  
  if (!password || password.trim() === '') {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
};

/**
 * Validate admin create user request
 */
exports.validateCreateUser = (req, res, next) => {
  const { name, email, username, password } = req.body;
  const errors = [];

  if (!name || !name.trim()) {
    errors.push('Name is required');
  }

  if (!email || !email.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  }

  if (!username || !username.trim()) {
    errors.push('Username is required');
  } else if (username.trim().length < 3) {
    errors.push('Username must be at least 3 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  if (!password || !password.trim()) {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
};

/**
 * Validate admin update user request
 */
exports.validateUpdateUser = (req, res, next) => {
  const { name, email, username, password, isActive } = req.body;

  if (
    typeof name === 'undefined' &&
    typeof email === 'undefined' &&
    typeof username === 'undefined' &&
    typeof password === 'undefined' &&
    typeof isActive === 'undefined'
  ) {
    return res.status(400).json({ error: 'At least one field is required to update the user' });
  }

  const errors = [];

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  }

  if (username) {
    if (username.trim().length < 3) {
      errors.push('Username must be at least 3 characters');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }
  }

  if (password && password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
};

/**
 * Validate login request
 * Required: username, password
 */
exports.validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  if (!username || username.trim() === '') {
    errors.push('Username is required');
  }
  
  if (!password || password.trim() === '') {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
};

/**
 * Validate bot run request
 * Required: input (the user's query/message)
 */
exports.validateBotRun = (req, res, next) => {
  const { input } = req.body;

  if (!input || input.trim() === '') {
    return res.status(400).json({ error: 'Input query is required' });
  }

  if (input.length > 1000) {
    return res.status(400).json({ error: 'Input query is too long (max 1000 characters)' });
  }

  next();
};

/**
 * Validate profile update request
 * At least one field must be provided
 */
exports.validateProfileUpdate = (req, res, next) => {
  const { name, email, username, password } = req.body;

  // Check if at least one field is provided
  if (!name && !email && !username && !password) {
    return res.status(400).json({ error: 'At least one field must be provided for update' });
  }

  // Validate email format if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate username if provided
  if (username) {
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
  }

  // Validate password if provided
  if (password && password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  next();
};

/**
 * Validate scrape/updater request payloads
 * Required: startUrl (must be http/https)
 */
exports.validateScrapeRequest = (req, res, next) => {
  const { startUrl } = req.body;

  if (!startUrl || typeof startUrl !== 'string' || !startUrl.trim()) {
    return res.status(400).json({ error: 'startUrl is required for scraping' });
  }

  const normalized = startUrl.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    return res.status(400).json({ error: 'startUrl must begin with http:// or https://' });
  }

  next();
};
