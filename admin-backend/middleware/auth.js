// admin-backend/middleware/auth.js

const jwt = require('jsonwebtoken');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request object
 * Protects routes from unauthorized access
 * 
 * Usage: router.get('/protected', auth, controller.method)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const auth = (req, res, next) => {
  try {
    // Extract token from 'Authorization: Bearer <token>' header
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'No authorization header provided',
        message: 'Please provide a valid authentication token'
      });
    }
    
    // Check if header follows 'Bearer <token>' format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ 
        error: 'Invalid authorization header format',
        message: 'Authorization header must be in format: Bearer <token>'
      });
    }
    
    const token = parts[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No token provided',
        message: 'Authentication token is missing'
      });
    }

    // Verify token with explicit algorithm specification
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'] // Prevent algorithm confusion attacks
    });
    
    // Attach user info to request for use in controllers
    req.user = decoded;
    
    // Optional: Log authentication for security auditing (production)
    if (process.env.NODE_ENV === 'production') {
      console.log(`🔐 Authenticated request: ${decoded.username} (${req.method} ${req.path})`);
    }
    
    next();
  } catch (err) {
    // Handle different JWT errors with specific messages
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
        expiredAt: err.expiredAt
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Authentication token is invalid or malformed'
      });
    }
    
    if (err.name === 'NotBeforeError') {
      return res.status(401).json({ 
        error: 'Token not active',
        message: 'Token is not yet valid'
      });
    }
    
    // Log unexpected errors
    console.error('❌ Authentication error:', {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Unable to authenticate request'
    });
  }
};

module.exports = auth;
