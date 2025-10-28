// admin-backend/services/userContextService.js

const User = require('../models/User');
const { ensureUserResources } = require('./provisioningService');

/**
 * Lightweight in-memory cache used to avoid repeated database lookups for
 * tenant-scoped connection metadata. The cache is refreshed automatically on
 * expiration or explicit invalidation.
 */
const userContextCache = new Map();

const DEFAULT_CACHE_TTL_MS = parseInt(process.env.USER_CONTEXT_CACHE_TTL_MS, 10) || 60_000;

const buildCacheKey = (userId) => `user-context:${userId}`;

const setCache = (key, value, ttlMs = DEFAULT_CACHE_TTL_MS) => {
  userContextCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(ttlMs, 1_000)
  });
};

const getCache = (key) => {
  const cached = userContextCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    userContextCache.delete(key);
    return null;
  }

  return cached.value;
};

const toTenantContext = (userDoc) => ({
  userId: userDoc._id.toString(),
  username: userDoc.username,
  email: userDoc.email,
  role: userDoc.role,
  isActive: userDoc.isActive,
  resourceId: userDoc.resourceId,
  databaseUri: userDoc.databaseUri,
  botEndpoint: userDoc.botEndpoint,
  schedulerEndpoint: userDoc.schedulerEndpoint,
  scraperEndpoint: userDoc.scraperEndpoint,
  vectorStorePath: userDoc.vectorStorePath,
  updatedAt: userDoc.updatedAt
});

/**
 * Load or compute the tenant context for a user. Optionally bypass the cache
 * when a fresh read is required (e.g. immediately after updating resources).
 */
const getUserTenantContext = async (userId, { forceRefresh = false } = {}) => {
  if (!userId) {
    throw new Error('Cannot load user tenant context without userId');
  }

  const cacheKey = buildCacheKey(userId);

  if (!forceRefresh) {
    const cachedContext = getCache(cacheKey);
    if (cachedContext) {
      return cachedContext;
    }
  }

  const user = await User.findById(userId).select(
    'username email role isActive resourceId databaseUri botEndpoint schedulerEndpoint scraperEndpoint vectorStorePath updatedAt'
  );

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error('User account is inactive');
    error.statusCode = 403;
    throw error;
  }

  const hydratedUser = await ensureUserResources(user);

  const context = toTenantContext(hydratedUser || user);
  setCache(cacheKey, context);
  return context;
};

const invalidateUserTenantContext = (userId) => {
  if (!userId) {
    return;
  }
  userContextCache.delete(buildCacheKey(userId));
};

module.exports = {
  getUserTenantContext,
  invalidateUserTenantContext
};
