// admin-backend/server.js

require('dotenv').config();                // Loads secrets from .env

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');              // Allow frontend calls (React dev server)
const helmet = require('helmet');          // Security headers
const rateLimit = require('express-rate-limit'); // Rate limiting
const dbConnect = require('./utils/db');   // Your MongoDB connection utility

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const botRoutes = require('./routes/bot');
const scrapeRoutes = require('./routes/scrape');

// =============================================================================
// ENVIRONMENT VALIDATION - Ensure all critical variables are set
// =============================================================================
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'CORS_ORIGIN', 'FASTAPI_BOT_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ FATAL ERROR: Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease set the required values in your .env file.');
  process.exit(1);
}

const sharedSecret = process.env.FASTAPI_SHARED_SECRET;
if (!sharedSecret || sharedSecret.trim().toLowerCase() === 'change-me') {
  console.warn('⚠️  FASTAPI_SHARED_SECRET is not yet configured. Update it in .env to enforce secure bot communication.');
}

// Validate CORS_ORIGIN is not wildcard in production
if (process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN === '*') {
  console.error('❌ FATAL ERROR: CORS_ORIGIN cannot be "*" in production!');
  console.error('   Please set specific allowed origins in your .env file.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Helmet: Set security-related HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding if needed for widgets
}));

// CORS: Strict origin control from environment variable
const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];

const corsFallbackOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:3000'
];

const allowedOrigins = Array.from(new Set([...envOrigins, ...corsFallbackOrigins]));
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));                   // Parse JSON requests with size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// General rate limiter for all routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

app.use(generalLimiter);

// =============================================================================
// REQUEST LOGGING
// =============================================================================
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${req.method} ${req.path}`;
  
  // Log different levels based on environment
  if (process.env.NODE_ENV === 'development') {
    console.log(`${logMessage} - IP: ${req.ip}`);
  } else {
    // Production: Log only to stdout (captured by logging services)
    console.log(logMessage);
  }
  next();
});

// =============================================================================
// DATABASE CONNECTION
// =============================================================================
dbConnect();

// API Routes
app.use('/api/auth', authRoutes);          // Register, login
app.use('/api/user', userRoutes);          // User info, CRUD
app.use('/api/bot', botRoutes);            // Bot interaction endpoints
app.use('/api/scrape', scrapeRoutes);      // Scraper + updater triggers

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'admin-backend',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Admin Backend API',
    version: '1.0.0',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/user/me',
      'PUT /api/user/me',
      'POST /api/bot/run',
      'POST /api/scrape/run',
      'POST /api/scrape/update',
      'GET /api/health'
    ]
  });
});

// =============================================================================
// ERROR HANDLERS
// =============================================================================

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  // Log error details server-side
  console.error('❌ Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Prepare error response
  const errorResponse = {
    error: process.env.NODE_ENV === 'production' 
      ? (statusCode === 500 ? 'Internal server error' : err.message)
      : err.message,
    status: statusCode
  };
  
  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details;
  }
  
  res.status(statusCode).json(errorResponse);
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
const server = app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log(`🚀 Admin Backend Server Started`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '⏳ Connecting...'}`);
  console.log(`🤖 FastAPI Bot URL: ${process.env.FASTAPI_BOT_URL || 'NOT SET'}`);
  console.log(`🛡️  CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log(`🔒 Security: Helmet enabled, Rate limiting active`);
  console.log('='.repeat(70));
  
  // Warn if critical optional configs are missing
  if (!process.env.FASTAPI_BOT_URL) {
    console.warn('⚠️  WARNING: FASTAPI_BOT_URL not set. Bot endpoints will fail.');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});


