# Scraping2/settings.py

BOT_NAME = "scraping"
SPIDER_MODULES = ["Scraping2.spiders"]
NEWSPIDER_MODULE = "Scraping2.spiders"

# Politeness + throughput - BALANCED SETTINGS FOR COMPREHENSIVE CRAWLING
ROBOTSTXT_OBEY = False  # Ignore robots.txt to get more content
CONCURRENT_REQUESTS = 20  # Balanced for good performance
DOWNLOAD_DELAY = 0.1  # Fast but not overwhelming
RANDOMIZE_DOWNLOAD_DELAY = 0.5  # Reasonable randomization
DOWNLOAD_TIMEOUT = 100  # Good timeout for complex pages

# AutoThrottle - MORE AGGRESSIVE
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 0.5  # Balanced start speed
AUTOTHROTTLE_MAX_DELAY = 20  # Higher max delay for safety
AUTOTHROTTLE_TARGET_CONCURRENCY = 12.0  # Balanced concurrency
AUTOTHROTTLE_DEBUG = False

# Retry (avoid retrying 404/406)
RETRY_ENABLED = True
RETRY_TIMES = 5
RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429, 403, 404]

# Async reactor
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

# Playwright
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
PLAYWRIGHT_BROWSER_TYPE = "chromium"
PLAYWRIGHT_LAUNCH_OPTIONS = {
    "headless": True,
    "args": [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-extensions",
        "--no-first-run",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--memory-pressure-off",
        "--disable-renderer-backgrounding",
    ],
}
PLAYWRIGHT_PAGE_GOTO_KWARGS = {
    'wait_until': 'domcontentloaded',
    'timeout': 120000
}

PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT = 120000
PLAYWRIGHT_MAX_PAGES_PER_CONTEXT = 4
PLAYWRIGHT_MAX_CONTEXTS = 4
PLAYWRIGHT_ABORT_REQUEST = lambda req: req.resource_type in ["stylesheet", "font", "image"]

# Depth and scheduler - ALLOW DEEPER CRAWLING
DEPTH_LIMIT = 999  # Very high depth limit for comprehensive crawling
DEPTH_PRIORITY = 1
SCHEDULER_MEMORY_QUEUE = 'scrapy.squeues.PickleFifoDiskQueue'
SCHEDULER_DISK_QUEUE = 'scrapy.squeues.PickleFifoDiskQueue'

# Headers
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}

# Middlewares
DOWNLOADER_MIDDLEWARES = {
    "Scraping2.middlewares.RotateUserAgentMiddleware": 400,
    "Scraping2.middlewares.StealthMiddleware": 450,
    "scrapy.downloadermiddlewares.httpproxy.HttpProxyMiddleware": 750,
    "Scraping2.middlewares.ProxyMiddleware": 760,
    "Scraping2.middlewares.CustomRetryMiddleware": 550,
    "scrapy.downloadermiddlewares.retry.RetryMiddleware": None,
}

# Pipelines
ITEM_PIPELINES = {
    "Scraping2.pipelines.ContentPipeline": 300,
    "Scraping2.pipelines.ChunkingPipeline": 320,
    "Scraping2.pipelines.ChromaDBPipeline": 350,
}

# ChromaDB
CHROMA_DB_PATH = "./tech1"
CHROMA_COLLECTION_NAME = "scraped_content"
CHROMA_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
CHROMA_BATCH_SIZE = 25
CHROMA_MAX_RETRIES = 3
CHROMA_RETRY_DELAY = 1
CHROMA_METADATA_FIELDS = ["url", "scraped_at", "word_count", "domain", "text_length"]
CHROMA_CLIENT_SETTINGS = {"anonymized_telemetry": False, "allow_reset": True}

# Chunking for RAG (Updated for improved chunking)
CHUNK_TARGET_WORDS = 300  # Target chunk size
CHUNK_MAX_WORDS = 500     # Maximum chunk size  
CHUNK_OVERLAP_WORDS = 150  # Words to overlap between chunks
CHUNK_MIN_WORDS = 50      # Minimum chunk size

# Legacy settings for backward compatibility
CHUNK_MAX_TOKENS = 650
CHUNK_OVERLAP_TOKENS = 200

# Dedup + thresholds - LESS AGGRESSIVE DEDUPLICATION
DUPEFILTER_DEBUG = True  # Enable debug to see what's being filtered
DUPEFILTER_CLASS = 'scrapy.dupefilters.RFPDupeFilter'
DEDUPLICATE_BY_HASH = False  # Disable content hash deduplication for now
MIN_WORD_COUNT = 1  # Lower threshold to capture more content

# Telnet console (explicit fixed port)
TELNETCONSOLE_PORT = None

# Logging
LOG_LEVEL = "INFO"
LOG_FILE = "LOG_FILE"

# UA rotation list
USER_AGENT_LIST = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
]