// admin-backend/middleware/rateLimiter.js

const rateLimit = require('express-rate-limit');

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on login/register
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { 
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  skipFailedRequests: false, // Count failed requests
});

/**
 * Moderate rate limiter for bot endpoints
 * Prevents API abuse while allowing reasonable usage
 */
const botLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 bot requests per minute
  message: { 
    error: 'Too many bot requests, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Lenient rate limiter for user profile endpoints
 */
const userLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 requests per 5 minutes
  message: { 
    error: 'Too many requests, please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Conservative limiter for scraping/updater triggers to prevent resource abuse
 */
const scrapeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many scraping jobs started. Please wait before launching another.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  botLimiter,
  userLimiter,
  scrapeLimiter
};
