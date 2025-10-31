// admin-backend/middleware/resolveTenant.js

/**
 * Determines which tenant (user) the request should operate on.
 *
 * Default behaviour: operate on the authenticated user.
 * Admins may impersonate another tenant by specifying one of:
 *   - `x-tenant-id` header
 *   - `x-impersonate-user` header
 *   - `tenantUserId` query parameter
 *   - `tenantUserId` property in request body
 */
function resolveTenant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be signed in to access tenant resources.'
    });
  }

  const fallbackUserId = String(req.user.userId || '').trim();
  let tenantUserId = fallbackUserId;
  let impersonating = false;

  const headerOverride = req.headers['x-tenant-id'] || req.headers['x-impersonate-user'];
  const queryOverride = req.query ? req.query.tenantUserId : undefined;
  const bodyOverride = req.body && typeof req.body === 'object' ? req.body.tenantUserId : undefined;

  const requestedOverride = headerOverride || queryOverride || bodyOverride;

  if (requestedOverride) {
    const normalizedOverride = String(requestedOverride || '').trim();

    if (normalizedOverride && normalizedOverride === fallbackUserId) {
      tenantUserId = normalizedOverride;
    } else if (req.user.role === 'admin') {
      tenantUserId = normalizedOverride || fallbackUserId;
    } else {
      tenantUserId = fallbackUserId;
    }

    impersonating = tenantUserId !== fallbackUserId;
  }

  if (!tenantUserId) {
    return res.status(400).json({
      error: 'Tenant not resolved',
      message: 'Unable to determine which tenant resources should be used.'
    });
  }

  req.tenantUserId = tenantUserId;
  req.isImpersonatingTenant = impersonating;
  next();
}

module.exports = resolveTenant;
