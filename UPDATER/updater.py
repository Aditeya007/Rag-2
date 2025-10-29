# updater.py - RAG Database Updater (REWRITTEN)
# Uses FixedUniversalSpider's EXACT extraction logic with change detection wrapper

import sys
import os

# Add the parent directory to Python path to find Scraping2 module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import scrapy
import hashlib
import logging
import re
from datetime import datetime
from pymongo import MongoClient
from urllib.parse import urlparse
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

# Import configuration
try:
    from config import (
        MONGO_URI, MONGO_DATABASE, MONGO_COLLECTION_URL_TRACKING,
        CHROMA_DB_PATH, CHROMA_COLLECTION_NAME, CHROMA_EMBEDDING_MODEL,
        MINIMUM_CONTENT_LENGTH, METADATA_FIELDS, CHUNK_BATCH_SIZE,
        MAX_RETRIES, RETRY_DELAY
    )
except ImportError:
    # Fallback defaults if config.py doesn't exist
    MONGO_URI = "mongodb://localhost:27017/"
    MONGO_DATABASE = "rag_updater"
    MONGO_COLLECTION_URL_TRACKING = "url_tracking"
    CHROMA_DB_PATH = "./final_db"
    CHROMA_COLLECTION_NAME = "scraped_content"
    CHROMA_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    MINIMUM_CONTENT_LENGTH = 100
    CHUNK_BATCH_SIZE = 50
    MAX_RETRIES = 3
    RETRY_DELAY = 1
    METADATA_FIELDS = [
        'url', 'title', 'content_type', 'extraction_method',
        'page_depth', 'response_status', 'content_length',
        'page_title', 'meta_description', 'extracted_at',
        'scraped_at', 'word_count', 'domain', 'text_length'
    ]

logger = logging.getLogger(__name__)


def build_url_tracking_collection(resource_id, tenant_user_id):
    """Return a tenant-specific MongoDB collection name for URL tracking."""
    base_identifier = (resource_id or tenant_user_id or "").strip()
    if not base_identifier:
        return MONGO_COLLECTION_URL_TRACKING

    # Limit characters to be Mongo-friendly and cap length to avoid exceeding 120 bytes.
    safe_identifier = re.sub(r"[^a-zA-Z0-9._-]", "_", base_identifier)[:80]
    if not safe_identifier:
        safe_identifier = "tenant"

    return f"{MONGO_COLLECTION_URL_TRACKING}_{safe_identifier}"

# Import the exact spider and items you're already using
try:
    from Scraping2.spiders.spider import FixedUniversalSpider
    from Scraping2.items import ScrapedContentItem
except ImportError:
    logger.error("Could not import Scraping2 modules")
    raise


class ContentChangeDetectorSpider(FixedUniversalSpider):
    """
    Extends FixedUniversalSpider with change detection wrapper.
    Does NOT override parse() - uses parent's comprehensive extraction logic.
    Only adds change detection to decide whether to process URLs.
    """

    name = "content_change_detector"

    def __init__(
        self,
        domain: str,
        start_url: str,
    mongo_uri=None,
    url_tracking_collection=None,
        resource_id=None,
        tenant_user_id=None,
        vector_store_path=None,
        collection_name=None,
        embedding_model_name=None,
        scrape_job_id=None,
        *args,
        **kwargs
    ):
        # Extract domain from URL if full URL provided and remove port
        if domain.startswith('http://') or domain.startswith('https://'):
            parsed = urlparse(domain)
            domain = parsed.netloc.split(':')[0]  # Remove port if exists
        else:
            # Handle domain with port (e.g., localhost:8000)
            domain = domain.split(':')[0]
        
        # Handle localhost normalization
        if 'localhost' in start_url.lower():
            start_url = start_url.replace('localhost', '127.0.0.1')
            start_url = start_url.replace('LOCALHOST', '127.0.0.1')

        # Set max_depth to 999 by default
        max_depth = kwargs.get('max_depth', 999)

        # Persist tenant metadata so pipelines inherit correct context
        self.resource_id = resource_id
        self.tenant_user_id = tenant_user_id
        self.vector_store_path = vector_store_path
        self.collection_name = collection_name
        self.embedding_model_name = embedding_model_name
        self.scrape_job_id = scrape_job_id

        # Initialize parent spider with all its powerful extraction logic
        super().__init__(
            domain=domain,
            start_url=start_url,
            max_depth=max_depth,
            sitemap_url=kwargs.get('sitemap_url'),
            max_links_per_page=kwargs.get('max_links_per_page', 1000),
            respect_robots=kwargs.get('respect_robots', True),
            aggressive_discovery=kwargs.get('aggressive_discovery', True),
            resource_id=resource_id,
            tenant_user_id=tenant_user_id,
            vector_store_path=vector_store_path,
            collection_name=collection_name,
            embedding_model_name=embedding_model_name,
            scrape_job_id=scrape_job_id,
        )

        # Determine the tenant-scoped MongoDB collection name for URL tracking
        self.url_tracking_collection_name = (
            url_tracking_collection
            or build_url_tracking_collection(resource_id, tenant_user_id)
        )

        # MongoDB connection for URL tracking
        self.mongo_uri = mongo_uri or MONGO_URI
        try:
            self.mongo_client = MongoClient(self.mongo_uri)
            self.db = self.mongo_client[MONGO_DATABASE]
            self.url_tracking = self.db[self.url_tracking_collection_name]
            self.url_tracking.create_index("url", unique=True)
            
            # Test connection
            self.mongo_client.admin.command('ping')
            logger.info(f"✅ MongoDB connected successfully: {self.mongo_uri}")
            logger.info(f"✅ Database: {MONGO_DATABASE}")
            logger.info(f"✅ Collection: {self.url_tracking_collection_name}")
        except Exception as e:
            logger.error(f"❌ MongoDB connection FAILED: {e}")
            logger.error(f"   URI: {self.mongo_uri}")
            logger.error(f"   Database: {MONGO_DATABASE}")
            logger.error(f"   Collection: {self.url_tracking_collection_name}")
            raise

        # Track which URLs should be processed (NEW or MODIFIED)
        self.urls_to_process = set()
        
        # Store content hashes for URLs that will be processed
        self.url_content_hashes = {}  # url -> content_hash

        # Statistics
        self.urls_checked = 0
        self.urls_new = 0
        self.urls_modified = 0
        self.urls_unchanged = 0

        logger.info(f"\n{'='*80}")
        logger.info(f"🔄 ContentChangeDetectorSpider initialized")
        logger.info(f"{'='*80}")
        logger.info(f"📊 MongoDB: {self.mongo_uri}")
        logger.info(f"📂 Database: {MONGO_DATABASE}")
        logger.info(f"📋 Collection: {self.url_tracking_collection_name}")
        logger.info(f"🎯 Target: {start_url}")
        if self.resource_id:
            logger.info(f"🧾 Resource ID: {self.resource_id}")
        if self.tenant_user_id:
            logger.info(f"👤 Tenant User ID: {self.tenant_user_id}")
        logger.info(f"🌐 Allowed domains: {self.allowed_domains}")
        logger.info(f"🔍 Strategy: Wrap parent spider's extraction with change detection")
        logger.info(f"{'='*80}\n")

    def start_requests(self):
        """
        Override parent's start_requests to ensure OUR parse() method is called.
        Parent uses callback=self.parse_any, but we need callback=self.parse for change detection.
        """
        headers = self._get_default_headers()
        
        logger.info(f"🚀 start_requests: Overriding to use OUR parse() callback")
        
        # Process start URLs with OUR parse() callback
        for url in self.start_urls:
            logger.info(f"🎯 Yielding start URL with custom parse callback: {url}")
            yield scrapy.Request(
                url,
                callback=self.parse,  # ← Use OUR parse() method, not parent's parse_any
                errback=self.handle_error,
                headers=headers,
                meta={
                    "depth": 0,
                    "playwright": False,
                    "dont_cache": True,
                    "from_sitemap": False,
                    "url_source": "start_url",
                },
                priority=1000,
                dont_filter=True,
            )

        # Phase 2: sitemap discovery (lower priority)
        if self.sitemap_url:
            yield scrapy.Request(
                self.sitemap_url,
                callback=self.parse_sitemap,
                headers=headers,
                meta={"dont_cache": True, "sitemap_attempt": True, "depth": 0},
                priority=900,
                errback=self.handle_sitemap_error,
            )
        elif hasattr(self, "potential_sitemaps"):
            for i, sm in enumerate(self.potential_sitemaps):
                yield scrapy.Request(
                    sm,
                    callback=self.parse_sitemap,
                    headers=headers,
                    meta={"dont_cache": True, "sitemap_attempt": True, "depth": 0},
                    priority=900 - i,
                    errback=self.handle_sitemap_error,
                )

    def parse_any(self, response):
        """
        Override parent's parse_any to route through OUR change detection.
        Parent's parse_any is the entry point for discovered links - we intercept it here.
        """
        logger.debug(f"🔀 parse_any called for {response.url}, routing to parse() for change detection")
        # Call OUR parse() method which has change detection
        yield from self.parse(response)

    def parse(self, response):
        """
        WRAPPER around parent's parse().
        1. Check for content changes FIRST
        2. If NEW or MODIFIED -> call parent's parse() (full extraction)
        3. If UNCHANGED -> skip but follow links
        4. Store content hash for pipeline to use
        """
        # 🔍 DEBUG: Confirm this method is being called
        logger.info(f"🔍 parse() method CALLED for: {response.url}")
        
        try:
            url = response.url
            self.urls_checked += 1
            
            logger.info(f"\n{'─'*60}")
            logger.info(f"🔍 Checking: {url}")
            
            # === QUICK CONTENT PREVIEW for hash calculation ===
            # Extract minimal content just to calculate hash (not for storage)
            preview_text = response.css("body").xpath("normalize-space(string(.))").get() or ""
            
            if not preview_text or len(preview_text.strip()) < 10:
                logger.info(f"⏭️  Empty page, following links only")
                # Empty page - still follow links using parent's link discovery
                yield from self._discover_and_follow_links(response)
                return
            
            # Clean text SAME way as parent spider's extraction does
            # This ensures hash matches what pipeline will calculate from final item
            cleaned_text = self._clean_webpage_text(preview_text)
            
            # Calculate hash from CLEANED text (matches pipeline's hash)
            content_hash = hashlib.sha256(cleaned_text.encode('utf-8')).hexdigest()
            
            # === CHANGE DETECTION ===
            existing_record = self.url_tracking.find_one({"url": url})
            
            if not existing_record:
                # ✨ NEW URL - process with parent spider
                self.urls_new += 1
                self.urls_to_process.add(url)
                self.url_content_hashes[url] = content_hash
                
                logger.info(f"✨ NEW URL detected")
                logger.info(f"   Hash: {content_hash[:16]}...")
                
                # UPDATE MONGODB IMMEDIATELY with cleaned_text hash (ONCE per URL)
                try:
                    result = self.url_tracking.update_one(
                        {"url": url},
                        {
                            "$set": {
                                "url": url,
                                "content_hash": content_hash,  # Use spider's cleaned_text hash
                                "last_checked": datetime.utcnow(),
                                "last_modified": datetime.utcnow()
                            }
                        },
                        upsert=True
                    )
                    if result.upserted_id:
                        logger.info(f"📝 MongoDB tracking STORED for NEW URL (inserted)")
                    elif result.modified_count > 0:
                        logger.info(f"📝 MongoDB tracking STORED for NEW URL (updated)")
                    else:
                        logger.info(f"📝 MongoDB tracking STORED for NEW URL (no change)")
                except Exception as e:
                    logger.error(f"❌ MongoDB update FAILED for NEW URL {url}: {e}")
                    logger.error(f"   Hash: {content_hash[:16]}...")
                    # Continue processing even if MongoDB update fails
                
                logger.info(f"   🚀 Calling parent spider's parse() for full extraction")
                
                # Call parent's parse_page() - uses comprehensive extraction
                yield from super().parse_page(response)
                
            elif existing_record.get("content_hash") != content_hash:
                # 🔄 MODIFIED URL - process with parent spider
                self.urls_modified += 1
                self.urls_to_process.add(url)
                self.url_content_hashes[url] = content_hash
                
                old_hash = existing_record.get("content_hash", "unknown")[:16]
                logger.info(f"🔄 MODIFIED URL detected")
                logger.info(f"   Old hash: {old_hash}...")
                logger.info(f"   New hash: {content_hash[:16]}...")
                
                # UPDATE MONGODB IMMEDIATELY with new cleaned_text hash (ONCE per URL)
                try:
                    result = self.url_tracking.update_one(
                        {"url": url},
                        {
                            "$set": {
                                "content_hash": content_hash,  # Use spider's cleaned_text hash
                                "last_checked": datetime.utcnow(),
                                "last_modified": datetime.utcnow()
                            }
                        }
                    )
                    if result.modified_count > 0:
                        logger.info(f"📝 MongoDB tracking UPDATED for MODIFIED URL")
                    else:
                        logger.warning(f"⚠️ MongoDB update matched but didn't modify: {url}")
                except Exception as e:
                    logger.error(f"❌ MongoDB update FAILED for MODIFIED URL {url}: {e}")
                    logger.error(f"   Old hash: {old_hash}...")
                    logger.error(f"   New hash: {content_hash[:16]}...")
                    # Continue processing even if MongoDB update fails
                
                logger.info(f"   🚀 Calling parent spider's parse() for full extraction")
                
                # Call parent's parse_page() - uses comprehensive extraction
                yield from super().parse_page(response)
                
            else:
                # ⏭️  UNCHANGED URL - skip but follow links
                self.urls_unchanged += 1
                
                logger.info(f"⏭️  UNCHANGED - skipping extraction")
                logger.info(f"   Hash: {content_hash[:16]}...")
                
                # Update last_checked timestamp only
                try:
                    self.url_tracking.update_one(
                        {"url": url},
                        {"$set": {"last_checked": datetime.utcnow()}}
                    )
                    logger.debug(f"✅ Updated last_checked timestamp for: {url}")
                except Exception as e:
                    logger.error(f"❌ Failed to update last_checked for {url}: {e}")
                
                # Still follow links to discover new pages (use parent's link discovery)
                yield from self._discover_and_follow_links(response)
            
            logger.info(f"{'─'*60}\n")
                
        except Exception as e:
            logger.error(f"❌ Error in parse wrapper for {response.url}: {e}")
            import traceback
            traceback.print_exc()
            # Try to at least follow links
            try:
                yield from self._discover_and_follow_links(response)
            except Exception:
                pass

    def closed(self, reason):
        """Spider closed callback"""
        logger.info(f"\n{'='*80}")
        logger.info(f"🛑 UPDATER SPIDER CLOSED")
        logger.info(f"{'='*80}")
        logger.info(f"📊 Statistics:")
        logger.info(f"   URLs Checked: {self.urls_checked}")
        logger.info(f"   ✨ New URLs: {self.urls_new}")
        logger.info(f"   🔄 Modified URLs: {self.urls_modified}")
        logger.info(f"   ⏭️  Unchanged URLs: {self.urls_unchanged}")
        logger.info(f"   📦 URLs Sent to Pipeline: {self.urls_new + self.urls_modified}")
        logger.info(f"\n📋 Reason: {reason}")
        logger.info(f"{'='*80}\n")

        # Close MongoDB connection
        self.mongo_client.close()


def run_updater(
    domain,
    start_url,
    mongo_uri=None,
    max_depth=999,
    sitemap_url=None,
    resource_id=None,
    tenant_user_id=None,
    vector_store_path=None,
    collection_name=None,
    embedding_model_name=None,
    job_id=None,
    respect_robots=None,
    aggressive_discovery=None,
    max_links_per_page=None,
):
    """
    Run the updater with proper pipeline configuration.
    Uses parent spider's extraction + our MongoDB tracking pipeline.
    """
    settings = get_project_settings()

    # Configure pipelines: Use Scraping2's existing pipelines + our tracking pipeline
    settings['ITEM_PIPELINES'] = {
        'Scraping2.pipelines.ContentPipeline': 100,       # Content cleaning and validation
        'Scraping2.pipelines.ChunkingPipeline': 200,      # Text chunking
        'Scraping2.pipelines.ChromaDBPipeline': 300,      # Store in ChromaDB
        'updater_tracking_pipeline.MongoDBTrackingPipeline': 400,  # Update MongoDB tracking
    }

    logger.info(f"\n{'='*80}")
    logger.info(f"🚀 Starting Updater")
    logger.info(f"{'='*80}")
    tenant_collection = build_url_tracking_collection(resource_id, tenant_user_id)

    logger.info(f"Domain: {domain}")
    logger.info(f"Start URL: {start_url}")
    logger.info(f"MongoDB: {mongo_uri or MONGO_URI}")
    logger.info(f"URL Tracking Collection: {tenant_collection}")
    if resource_id:
        logger.info(f"Resource ID: {resource_id}")
    if tenant_user_id:
        logger.info(f"Tenant User ID: {tenant_user_id}")
    if vector_store_path:
        logger.info(f"Chroma Path: {vector_store_path}")
    if collection_name:
        logger.info(f"Collection: {collection_name}")
    logger.info(f"Pipelines: ContentPipeline → ChunkingPipeline → ChromaDBPipeline → MongoDBTrackingPipeline")
    logger.info(f"{'='*80}\n")

    if vector_store_path:
        settings.set('CHROMA_DB_PATH', vector_store_path, priority='cmdline')
    if collection_name:
        settings.set('CHROMA_COLLECTION_NAME', collection_name, priority='cmdline')
    if embedding_model_name:
        settings.set('CHROMA_EMBEDDING_MODEL', embedding_model_name, priority='cmdline')
    if respect_robots is not None:
        settings.set('ROBOTSTXT_OBEY', bool(respect_robots), priority='cmdline')

    process = CrawlerProcess(settings)
    crawler = process.create_crawler(ContentChangeDetectorSpider)

    spider_kwargs = dict(
        domain=domain,
        start_url=start_url,
        mongo_uri=mongo_uri,
        url_tracking_collection=tenant_collection,
        max_depth=max_depth,
        sitemap_url=sitemap_url,
        resource_id=resource_id,
        tenant_user_id=tenant_user_id,
        vector_store_path=vector_store_path,
        collection_name=collection_name,
        embedding_model_name=embedding_model_name,
        scrape_job_id=job_id,
    )

    if respect_robots is not None:
        spider_kwargs['respect_robots'] = respect_robots
    if aggressive_discovery is not None:
        spider_kwargs['aggressive_discovery'] = aggressive_discovery
    if max_links_per_page is not None:
        spider_kwargs['max_links_per_page'] = max_links_per_page

    process.crawl(crawler, **spider_kwargs)

    process.start()

    return crawler.stats.get_stats() if crawler.stats else {}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python updater.py <domain> <start_url> [mongo_uri]")
        print("Example: python updater.py localhost:8000 http://localhost:8000")
        sys.exit(1)

    domain = sys.argv[1]
    start_url = sys.argv[2]
    mongo_uri = sys.argv[3] if len(sys.argv) > 3 else None

    run_updater(domain, start_url, mongo_uri)
