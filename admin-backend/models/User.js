// admin-backend/models/User.js

const mongoose = require('mongoose');

/**
 * User Schema
 * Represents a user in the RAG Admin system
 * 
 * Security notes:
 * - Passwords are never stored in plain text (hashed with bcrypt in controller)
 * - Email is stored in lowercase for case-insensitive lookups
 * - Unique indexes prevent duplicate usernames/emails
 */
const UserSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: { 
      type: String, 
      required: [true, 'Email is required'], 
      unique: true, 
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    username: { 
      type: String, 
      required: [true, 'Username is required'], 
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    password: { 
      type: String, 
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters']
      // Note: Stored as bcrypt hash, never plain text!
    },
    resourceId: {
      type: String,
      required: [true, 'Resource identifier is required'],
      unique: true,
      sparse: true,
      trim: true,
      minlength: [6, 'Resource identifier must be at least 6 characters'],
      maxlength: [60, 'Resource identifier cannot exceed 60 characters'],
      immutable: true
    },
    databaseUri: {
      type: String,
      required: [true, 'Database URI is required'],
      trim: true
    },
    botEndpoint: {
      type: String,
      required: [true, 'Bot endpoint is required'],
      trim: true
    },
    schedulerEndpoint: {
      type: String,
      required: [true, 'Scheduler endpoint is required'],
      trim: true
    },
    scraperEndpoint: {
      type: String,
      required: [true, 'Scraper endpoint is required'],
      trim: true
    },
    vectorStorePath: {
      type: String,
      required: [true, 'Vector store path is required'],
      trim: true
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
      lowercase: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // lastLogin: { 
    //   type: Date 
    // },
    // botPreferences: {
    //   type: mongoose.Schema.Types.Mixed,
    //   default: {}
    // }
  },
  {
    timestamps: true, // Auto-manages createdAt/updatedAt fields
    collection: 'users' // Explicit collection name
  }
);

// Indexes for performance
// Note: email and username already have unique indexes, so we don't duplicate them
UserSchema.index({ createdAt: -1 });

// Instance method to get public profile (exclude password)
UserSchema.methods.toPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    username: this.username,
    email: this.email,
    resourceId: this.resourceId,
    databaseUri: this.databaseUri,
    botEndpoint: this.botEndpoint,
    schedulerEndpoint: this.schedulerEndpoint,
    scraperEndpoint: this.scraperEndpoint,
    ...(this.role === 'admin' && { vectorStorePath: this.vectorStorePath }),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static method to find user by email or username
UserSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  });
};

// Export for use everywhere (routes, controllers)
module.exports = mongoose.model('User', UserSchema);
