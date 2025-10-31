// admin-backend/middleware/requireAdmin.js

/**
 * Ensures the authenticated user has admin privileges before allowing access.
 * This middleware assumes `auth` has already populated `req.user` from JWT.
 */
module.exports = function requireAdmin(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be signed in to access this resource.'
    });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Administrator privileges are required to perform this action.'
    });
  }

  return next();
};
