const path = require('path');
const { runPythonJob } = require('./pythonJob');

const repoRoot = path.resolve(__dirname, '..', '..');
const scraperScriptPath = path.resolve(repoRoot, 'Scraping2', 'run_tenant_spider.py');
const updaterScriptPath = path.resolve(repoRoot, 'UPDATER', 'run_tenant_updater.py');

const buildArgs = (options = {}) => {
  const args = [];

  const push = (flag, value) => {
    if (typeof value === 'undefined' || value === null) {
      return;
    }
    if (typeof value === 'boolean') {
      if (value) {
        args.push(flag);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => push(flag, entry));
      return;
    }
    args.push(flag, String(value));
  };

  push('--start-url', options.startUrl);
  push('--domain', options.domain);
  push('--resource-id', options.resourceId);
  push('--user-id', options.userId);
  push('--vector-store-path', options.vectorStorePath);
  push('--collection-name', options.collectionName);
  push('--embedding-model-name', options.embeddingModelName);
  push('--mongo-uri', options.mongoUri);
  push('--max-depth', options.maxDepth);
  push('--max-links-per-page', options.maxLinksPerPage);
  push('--sitemap-url', options.sitemapUrl);
  push('--job-id', options.jobId);
  push('--log-level', options.logLevel);

  if (options.respectRobots === true) {
    push('--respect-robots', true);
  } else if (options.respectRobots === false) {
    push('--no-respect-robots', true);
  }

  if (options.aggressiveDiscovery === true) {
    push('--aggressive-discovery', true);
  } else if (options.aggressiveDiscovery === false) {
    push('--no-aggressive-discovery', true);
  }

  if (options.statsOutput) {
    push('--stats-output', options.statsOutput);
  }

  return args;
};

const runTenantScrape = async (options) => {
  const args = buildArgs(options);
  const result = await runPythonJob({
    scriptPath: scraperScriptPath,
    args,
    cwd: repoRoot,
    logLabel: `scrape:${options.resourceId || 'unknown'}`
  });
  return result;
};

const runTenantUpdater = async (options) => {
  const args = buildArgs(options);
  const result = await runPythonJob({
    scriptPath: updaterScriptPath,
    args,
    cwd: repoRoot,
    logLabel: `updater:${options.resourceId || 'unknown'}`
  });
  return result;
};

module.exports = {
  runTenantScrape,
  runTenantUpdater
};