const crypto = require('crypto');
const { runTenantScrape, runTenantUpdater } = require('../jobs/scrapeJob');
const { getUserTenantContext } = require('../services/userContextService');

const buildJobId = (prefix, resourceId) => {
  const random = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
  return `${prefix}_${resourceId || 'tenant'}_${random}`;
};

const truncateLog = (value) => {
  if (!value) {
    return value;
  }
  const maxLength = 8_192;
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n... [truncated ${value.length - maxLength} chars]`;
};

const ensureTenantResources = (tenantContext) => {
  if (!tenantContext.vectorStorePath || !tenantContext.resourceId) {
    const error = new Error('Tenant resources are incomplete. Re-provision before running scrape.');
    error.statusCode = 503;
    throw error;
  }
};

const toBooleanOrUndefined = (value) => {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const parseIntegerOrUndefined = (value) => {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

exports.startScrape = async (req, res) => {
  req.setTimeout(0);
  if (typeof res.setTimeout === 'function') {
    res.setTimeout(0);
  }

  const startUrl = typeof req.body.startUrl === 'string' ? req.body.startUrl.trim() : '';
  const sitemapUrl = typeof req.body.sitemapUrl === 'string' ? req.body.sitemapUrl.trim() : undefined;
  const embeddingModelName = typeof req.body.embeddingModelName === 'string' ? req.body.embeddingModelName.trim() : undefined;
  const collectionName = typeof req.body.collectionName === 'string' ? req.body.collectionName.trim() : undefined;
  const domain = typeof req.body.domain === 'string' ? req.body.domain.trim() : undefined;
  const respectRobots = toBooleanOrUndefined(req.body.respectRobots);
  const aggressiveDiscovery = toBooleanOrUndefined(req.body.aggressiveDiscovery);
  const maxDepth = parseIntegerOrUndefined(req.body.maxDepth);
  const maxLinksPerPage = parseIntegerOrUndefined(req.body.maxLinksPerPage);

  try {
  const userId = req.tenantUserId || req.user.userId;
  const tenantContext = await getUserTenantContext(userId);
    ensureTenantResources(tenantContext);

    const jobId = buildJobId('scrape', tenantContext.resourceId);
    const scrapeOptions = {
      startUrl,
      sitemapUrl,
      resourceId: tenantContext.resourceId,
      userId: tenantContext.userId,
      vectorStorePath: tenantContext.vectorStorePath,
      collectionName,
      embeddingModelName,
      domain,
      maxDepth,
      maxLinksPerPage,
      respectRobots,
      aggressiveDiscovery,
      jobId,
      logLevel: process.env.SCRAPER_LOG_LEVEL || 'INFO'
    };

    const result = await runTenantScrape(scrapeOptions);

    res.json({
      success: true,
      jobId,
      resourceId: tenantContext.resourceId,
      summary: result.summary,
      stdout: truncateLog(result.stdout),
      stderr: truncateLog(result.stderr)
    });
  } catch (err) {
    console.error('❌ Scrape job failed:', {
  userId: req.tenantUserId || req.user.userId,
      error: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message,
      code: err.code,
      summary: err.summary || null
    });
  }
};

exports.runUpdater = async (req, res) => {
  req.setTimeout(0);
  if (typeof res.setTimeout === 'function') {
    res.setTimeout(0);
  }

  const startUrl = typeof req.body.startUrl === 'string' ? req.body.startUrl.trim() : '';
  const sitemapUrl = typeof req.body.sitemapUrl === 'string' ? req.body.sitemapUrl.trim() : undefined;
  const embeddingModelName = typeof req.body.embeddingModelName === 'string' ? req.body.embeddingModelName.trim() : undefined;
  const collectionName = typeof req.body.collectionName === 'string' ? req.body.collectionName.trim() : undefined;
  const domain = typeof req.body.domain === 'string' ? req.body.domain.trim() : undefined;
  const mongoUri = typeof req.body.mongoUri === 'string' ? req.body.mongoUri.trim() : undefined;
  const respectRobots = toBooleanOrUndefined(req.body.respectRobots);
  const aggressiveDiscovery = toBooleanOrUndefined(req.body.aggressiveDiscovery);
  const maxDepth = parseIntegerOrUndefined(req.body.maxDepth);
  const maxLinksPerPage = parseIntegerOrUndefined(req.body.maxLinksPerPage);

  try {
  const userId = req.tenantUserId || req.user.userId;
  const tenantContext = await getUserTenantContext(userId);
    ensureTenantResources(tenantContext);

    const jobId = buildJobId('update', tenantContext.resourceId);
    const updaterOptions = {
      startUrl,
      sitemapUrl,
      resourceId: tenantContext.resourceId,
      userId: tenantContext.userId,
      vectorStorePath: tenantContext.vectorStorePath,
      collectionName,
      embeddingModelName,
      domain,
      maxDepth,
      maxLinksPerPage,
      respectRobots,
      aggressiveDiscovery,
      mongoUri,
      jobId,
      logLevel: process.env.UPDATER_LOG_LEVEL || 'INFO'
    };

    const result = await runTenantUpdater(updaterOptions);

    res.json({
      success: true,
      jobId,
      resourceId: tenantContext.resourceId,
      summary: result.summary,
      stdout: truncateLog(result.stdout),
      stderr: truncateLog(result.stderr)
    });
  } catch (err) {
    console.error('❌ Updater job failed:', {
  userId: req.tenantUserId || req.user.userId,
      error: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message,
      code: err.code,
      summary: err.summary || null
    });
  }
};
