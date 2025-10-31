const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const resolveTenant = require('../middleware/resolveTenant');
const { scrapeLimiter } = require('../middleware/rateLimiter');
const { validateScrapeRequest } = require('../middleware/validate');
const scrapeController = require('../controllers/scrapeController');

router.post('/run', auth, resolveTenant, scrapeLimiter, validateScrapeRequest, scrapeController.startScrape);
router.post('/update', auth, resolveTenant, scrapeLimiter, validateScrapeRequest, scrapeController.runUpdater);

module.exports = router;
