# run_scraper.py

import logging
import sys
import nltk
from urllib.parse import urlparse
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

# Import spider from the project module
from Scraping2.spiders.spider import FixedUniversalSpider

# Pre-fetch NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('punkt_tab', quiet=True)
    print("✅ NLTK data downloaded successfully")
except Exception as e:
    print(f"⚠️ NLTK download failed: {e}")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler('scrapy_comprehensive.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

def spider_stats_callback(spider, reason):
    print(f"\n🛑 SPIDER CLOSED - Reason: {reason}")
    print(f"📊 URLs processed: {getattr(spider, 'urls_processed', 0)}")
    print(f"📊 Items extracted: {getattr(spider, 'items_extracted', 0)}")

def validate_url(url):
    """Validate URL format and extract domain"""
    if not url.startswith(('http://', 'https://')):
        return False, None, "URL must start with http:// or https://"

    try:
        parsed = urlparse(url)
        if not parsed.netloc:
            return False, None, "Invalid URL format"
        return True, parsed.netloc, None
    except Exception as e:
        return False, None, f"URL parsing error: {str(e)}"

if __name__ == "__main__":
    # Get URL from user
    print("\n" + "=" * 70)
    print("RAG Chatbot - Website Scraper")
    print("=" * 70)
    print()

    while True:
        START_URL = input("Enter website URL to scrape: ").strip()

        if not START_URL:
            print("❌ URL cannot be empty. Please try again.\n")
            continue

        valid, domain, error = validate_url(START_URL)

        if valid:
            DOMAIN = domain
            break
        else:
            print(f"❌ {error}\n")

    # Keep all other settings hardcoded as original
    MAX_DEPTH = 999
    SITEMAP_URL = None
    MAX_LINKS_PER_PAGE = 50000
    RESPECT_ROBOTS = False
    AGGRESSIVE_DISCOVERY = True

    # Display configuration
    print()
    print("=" * 70)
    print("🌐 Comprehensive Website Crawling - MAXIMUM EXTRACTION MODE")
    print("=" * 70)
    print(f"📍 Domain: {DOMAIN}")
    print(f"🌐 Start URL: {START_URL}")
    print(f"📊 Max Depth: {MAX_DEPTH} (VERY HIGH)")
    print(f"🔗 Max Links Per Page: {MAX_LINKS_PER_PAGE}")
    print(f"🤖 Respect Robots: {RESPECT_ROBOTS}")
    print(f"🎯 Aggressive Discovery: {AGGRESSIVE_DISCOVERY}")
    print("=" * 70)
    print()

    settings = get_project_settings()

    # Keep overrides minimal and consistent with settings.py - MAXIMUM EXTRACTION MODE
    settings.update({
        'ROBOTSTXT_OBEY': False,  # Ignore robots.txt completely
        'CONCURRENT_REQUESTS': 8,  # MUCH LOWER to avoid blocking
        'DOWNLOAD_DELAY': 1.5,  # MUCH SLOWER to be more human-like
        'RANDOMIZE_DOWNLOAD_DELAY': 0.8,  # More randomization
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 2.0,  # Start slower
        'AUTOTHROTTLE_MAX_DELAY': 30,  # Allow much longer delays
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 3.0,  # Much lower concurrency
        'RETRY_TIMES': 5,  # More retries
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 522, 524, 408, 429, 403, 404],
        'MIN_WORD_COUNT': 1,  # Accept almost everything
        'DEPTH_LIMIT': 0,  # DISABLE Scrapy's built-in depth limit
        'DEPTH_PRIORITY': 1,
        'SCHEDULER_DISK_QUEUE': 'scrapy.squeues.PickleFifoDiskQueue',
        'SCHEDULER_MEMORY_QUEUE': 'scrapy.squeues.PickleFifoDiskQueue',
        # Force disable duplicate filtering that's too aggressive
        'DUPEFILTER_CLASS': 'scrapy.dupefilters.RFPDupeFilter',

    })

    process = CrawlerProcess(settings)

    try:
        process.crawl(
            FixedUniversalSpider,
            domain=DOMAIN,
            start_url=START_URL,
            max_depth=MAX_DEPTH,
            sitemap_url=SITEMAP_URL,
            max_links_per_page=MAX_LINKS_PER_PAGE,
            respect_robots=RESPECT_ROBOTS,
            aggressive_discovery=AGGRESSIVE_DISCOVERY,
        )

        logging.info("🚀 Starting comprehensive crawling...")
        process.start()
        logging.info("✅ Crawling finished!")

    except KeyboardInterrupt:
        logging.info("🛑 Crawling interrupted by user")
        print("🛑 Crawling stopped by user")
    except Exception as e:
        logging.error(f"❌ Crawling failed: {e}")
        print(f"❌ Error: {e}")
        sys.exit(1)
