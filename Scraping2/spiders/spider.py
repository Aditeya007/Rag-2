# Scraping2/spiders/spider.py

import scrapy
import xml.etree.ElementTree as ET
from scrapy.linkextractors import LinkExtractor
from datetime import datetime
import logging
import re
import json
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
from typing import List, Set
import html
from collections import Counter

try:
    from scrapy_playwright.page import PageMethod
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    PageMethod = None

try:
    from Scraping2.items import ScrapedContentItem
except ImportError:
    from ..items import ScrapedContentItem

logger = logging.getLogger(__name__)

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "fbclid", "mc_cid", "mc_eid", "igshid", "ref", "ref_src", "mkt_tok",
    "yclid", "msclkid"
}

SKIP_ENDPOINT_PATTERNS = [
    "/wp-json/oembed", "/oembed", "embed=true", "format=oembed"
]

ALLOW_JSON_VALUE_PATTERNS = [
    "/wp-json/wp/v2/", "/wp-json/wp/v2/posts", "/wp-json/wp/v2/pages", "/wp-json/wp/v2/search"
]

class FixedUniversalSpider(scrapy.Spider):
    name = "fixed_universal"

    custom_settings = {
        "PLAYWRIGHT_BROWSER_TYPE": "chromium",
        "PLAYWRIGHT_LAUNCH_OPTIONS": {"headless": True},
    }

    # Centralized list of file extensions to skip
    SKIP_EXTENSIONS = [
        # Documents
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".rtf", ".odt", ".ods", ".odp", ".txt", ".csv",
        
        # Archives
        ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2",
        
        # Executables
        ".exe", ".msi", ".dmg", ".pkg", ".deb", ".rpm",
        
        # Media files
        ".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico", ".webp",
        ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm",
        ".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma",
        
        # Web assets
        ".css", ".js", ".xml", ".json", ".rss", ".atom",
        
        # Fonts
        ".ttf", ".otf", ".woff", ".woff2", ".eot"
    ]

    def __init__(
        self,
        domain: str,
        start_url: str,
        max_depth: int = 999,
        sitemap_url: str = None,
        max_links_per_page: int = 1000,
        respect_robots: bool = True,
        aggressive_discovery: bool = True,
        *args, **kwargs
    ):
        self.resource_id = kwargs.pop('resource_id', None)
        self.tenant_user_id = kwargs.pop('tenant_user_id', None)
        self.vector_store_path = kwargs.pop('vector_store_path', None)
        self.collection_name = kwargs.pop('collection_name', None)
        self.embedding_model_name = kwargs.pop('embedding_model_name', None)
        self.scrape_job_id = kwargs.pop('scrape_job_id', None)

        super().__init__(*args, **kwargs)

        # Core args
        self.allowed_domains = [domain]
        self.start_urls = [start_url] if isinstance(start_url, str) else list(start_url or [])
        self.max_depth = int(max_depth) if max_depth is not None else 999
        self.sitemap_url = sitemap_url
        self.max_links_per_page = int(max_links_per_page)
        self.respect_robots = respect_robots
        self.aggressive_discovery = aggressive_discovery

        # Tracking
        self.urls_processed = 0
        self.items_extracted = 0
        self.discovered_urls: Set[str] = set()
        self.sitemap_urls: Set[str] = set()
        self.failed_urls: Set[str] = set()
        
        # NEW: Track fully processed pages to prevent re-scraping
        self.fully_processed_urls: Set[str] = set()
        self.currently_processing_urls: Set[str] = set()

        # Build potential sitemaps using a single string URL (fixes urlparse(list) crash)
        base_for_parse = None
        if self.sitemap_url and isinstance(self.sitemap_url, str):
            base_for_parse = self.sitemap_url
        elif self.start_urls and len(self.start_urls) > 0:
            first_url = self.start_urls[0]
            if isinstance(first_url, str):
                base_for_parse = first_url
        
        if base_for_parse and isinstance(base_for_parse, str):
            try:
                parsed_url = urlparse(base_for_parse)
                base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
                self.potential_sitemaps = [
                    f"{base_url}/sitemap.xml",
                    f"{base_url}/sitemap_index.xml",
                    f"{base_url}/sitemaps.xml",
                    f"{base_url}/sitemap/sitemap.xml",
                ]
            except Exception as e:
                logger.warning(f"Failed to parse base URL for sitemaps: {e}")
                self.potential_sitemaps = []
        else:
            self.potential_sitemaps = []

        logger.info(f"🕷️ FixedUniversalSpider initialized for {domain}")
        logger.info(f"📊 Max depth: {self.max_depth}, Max links/page: {self.max_links_per_page}")
        logger.info(f"🎯 Aggressive discovery: {self.aggressive_discovery}")

    def _clean_webpage_text(self, text: str) -> str:
        """
        Clean extracted webpage text to remove navigation, boilerplate, and low-quality content.
        Returns clean, meaningful text suitable for RAG retrieval.
        """
        if not text or not text.strip():
            return ""
        
        # Decode HTML entities
        text = html.unescape(text)
        
        # Remove JavaScript and CSS
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<noscript[^>]*>.*?</noscript>', '', text, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove HTML tags but preserve text content
        text = re.sub(r'<[^>]+>', ' ', text)
        
        # Remove HTML comments
        text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\n\s*\n', '\n', text)
        
        # Split into sentences for quality filtering
        sentences = self._split_into_sentences(text)
        clean_sentences = []
        
        # Track seen sentences to avoid repetition
        seen_sentences = set()
        
        for sentence in sentences:
            sentence = sentence.strip()
            
            # Basic length and word count filters
            if len(sentence) < 15:
                continue
            
            words = sentence.split()
            if len(words) < 2:
                continue
            
            # Skip if we've seen this exact sentence
            sentence_lower = sentence.lower()
            if sentence_lower in seen_sentences:
                continue
            
            # Skip navigation and boilerplate patterns
            if self._is_boilerplate_text(sentence):
                continue
            
            # Check for reasonable word variety (not too repetitive)
            if not self._has_good_word_variety(words):
                continue
            
            # Skip sentences that are mostly punctuation or numbers
            alpha_chars = sum(1 for c in sentence if c.isalpha())
            if alpha_chars / len(sentence) < 0.6:
                continue
            
            seen_sentences.add(sentence_lower)
            clean_sentences.append(sentence)
        
        return ' '.join(clean_sentences)
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences using multiple delimiters."""
        # Split on common sentence endings
        sentences = re.split(r'[.!?]+\s+', text)
        
        # Further split on line breaks that might indicate sentence boundaries
        expanded_sentences = []
        for sentence in sentences:
            # Split on line breaks only if they seem to separate complete thoughts
            parts = sentence.split('\n')
            for part in parts:
                part = part.strip()
                if part:
                    expanded_sentences.append(part)
        
        return expanded_sentences
    
    def _is_boilerplate_text(self, text: str) -> bool:
        """Check if text appears to be navigation, boilerplate, or low-value content."""
        text_lower = text.lower().strip()
        
        # Navigation patterns
        nav_patterns = [
            r'\bhome\b.*\babout\b.*\bcontact\b',
            r'\bmenu\b',
            r'\bnavigation\b',
            r'\bskip to\b',
            r'\bmain content\b',
            r'\bbreadcrumb\b',
            r'\bgo to\b.*\bpage\b',
            r'\bprevious\b.*\bnext\b',
            r'^(home|about|contact|services|products|blog|news)$',
        ]
        
        # Social media and sharing patterns
        social_patterns = [
            r'\bfollow us\b',
            r'\bshare this\b',
            r'\blike us on\b',
            r'\bfacebook\b.*\btwitter\b.*\binstagram\b',
            r'\bsocial media\b',
            r'\bsubscribe\b.*\bnewsletter\b',
            r'\bsign up\b.*\bupdates\b',
        ]
        
        # Legal and footer patterns
        legal_patterns = [
            r'\bcopyright\b.*\d{4}',
            r'\ball rights reserved\b',
            r'\bprivacy policy\b',
            r'\bterms of service\b',
            r'\bterms and conditions\b',
            r'\bcookie policy\b',
            r'\bpowered by\b',
            r'\bdesigned by\b',
        ]
        
        # Generic boilerplate patterns
        generic_patterns = [
            r'^(click here|read more|learn more|view all|see all|show more)\.?$',
            r'^\d+\s+(comments?|views?|likes?|shares?)\.?$',
            r'^\w+\s*:\s*$',  # Labels ending with colon
            r'^(yes|no|ok|cancel|submit|send|search)\.?$',
            r'^\s*[\d\s\-\(\)]+\s*$',  # Phone numbers or similar
        ]
        
        all_patterns = nav_patterns + social_patterns + legal_patterns + generic_patterns
        
        for pattern in all_patterns:
            if re.search(pattern, text_lower):
                return True
        
        # Check for repetitive patterns (same word repeated)
        words = text_lower.split()
        if len(words) > 2:
            word_counts = Counter(words)
            most_common_count = word_counts.most_common(1)[0][1]
            if most_common_count / len(words) > 0.5:  # More than 50% repetition
                return True
        
        return False
    
    def _has_good_word_variety(self, words: List[str]) -> bool:
        """Check if the words show good variety (not too repetitive)."""
        if len(words) < 4:
            return False
        
        # Count unique words
        unique_words = set(word.lower() for word in words)
        variety_ratio = len(unique_words) / len(words)
        
        # We want at least 60% unique words for good variety
        return variety_ratio >= 0.6

    def _build_item(self, response, text: str, **kwargs):
        """Helper to construct items with tenant metadata automatically attached."""
        item_kwargs = {
            'resource_id': self.resource_id,
            'tenant_user_id': self.tenant_user_id
        }
        item_kwargs.update(kwargs)
        return ScrapedContentItem.from_response(response, text, **item_kwargs)
    
    def _light_webpage_cleaning(self, text: str) -> str:
        """
        Light text cleaning for comprehensive extraction - preserve more content.
        """
        if not text or not text.strip():
            return ""
        
        # Decode HTML entities
        text = html.unescape(text)
        
        # Remove only the most obvious problematic content
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', text)  # Remove HTML tags
        text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)  # Remove HTML comments
        
        # Basic whitespace normalization
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text

    async def start(self):
        for req in self.start_requests():
            yield req

    def start_requests(self):
        headers = self._get_default_headers()

        # Phase 1: ALWAYS process start URLs first (highest priority)
        for url in self.start_urls:
            logger.info(f"🎯 Yielding start URL: {url}")
            yield scrapy.Request(
                url,  # Don't canonicalize start URL to avoid issues
                callback=self.parse_any,
                errback=self.handle_error,
                headers=headers,
                meta={
                    "depth": 0,
                    "playwright": False,
                    "dont_cache": True,
                    "from_sitemap": False,
                    "url_source": "start_url",
                },
                priority=1000,  # Highest priority
                dont_filter=True,  # Force processing
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

    def _get_default_headers(self):
        return {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        }

    def _canonicalize_url(self, url: str) -> str:
        try:
            url = url.split("#")[0]  # Remove fragment, keep only the first part
            parsed = urlparse(url if url.startswith(("http://", "https://")) else "https://" + url)
            q = [(k, v) for (k, v) in parse_qsl(parsed.query, keep_blank_values=True)
                 if not (k in TRACKING_PARAMS or k.startswith("utm_") or k.startswith("hsa_"))]
            clean_path = re.sub(r"//+", "/", parsed.path) or "/"
            return urlunparse(parsed._replace(query=urlencode(q, doseq=True), path=clean_path))
        except Exception:
            return url

    def _is_url_already_processed(self, url: str) -> bool:
        """Check if a URL has already been fully processed to avoid duplicate scraping."""
        canonical_url = self._canonicalize_url(url)
        return canonical_url in self.fully_processed_urls

    def _mark_url_as_processing(self, url: str):
        """Mark a URL as currently being processed."""
        canonical_url = self._canonicalize_url(url)
        self.currently_processing_urls.add(canonical_url)

    def _mark_url_as_fully_processed(self, url: str):
        """Mark a URL as fully processed (content extracted)."""
        canonical_url = self._canonicalize_url(url)
        self.fully_processed_urls.add(canonical_url)
        self.currently_processing_urls.discard(canonical_url)
        logger.debug(f"✅ Marked as fully processed: {canonical_url}")

    def _should_process_url(self, url: str) -> bool:
        """Check if a URL should be processed, filtering out binary files and already processed URLs."""
        if not url:
            return False
        
        # First check if already fully processed
        if self._is_url_already_processed(url):
            logger.debug(f"🔄 Skipping already processed URL: {url}")
            return False
            
        try:
            parsed = urlparse(url)
            # More lenient domain checking
            if not any(d in parsed.netloc for d in self.allowed_domains):
                return False
            
            # Check against centralized skip extensions list
            if any(parsed.path.lower().endswith(ext) for ext in self.SKIP_EXTENSIONS):
                logger.debug(f"Skipping binary file URL: {url}")
                return False
                
            # Skip URLs that look like file downloads based on path patterns
            download_patterns = [
                "/wp-content/uploads/",
                "/downloads/",
                "/files/",
                "/assets/uploads/",
                "/media/uploads/",
                "/static/files/"
            ]
            
            if any(pattern in parsed.path.lower() for pattern in download_patterns):
                # Check if it ends with a likely file extension
                path_lower = parsed.path.lower()
                if any(path_lower.endswith(ext) for ext in self.SKIP_EXTENSIONS):
                    logger.debug(f"Skipping download URL with binary extension: {url}")
                    return False
            
            if len(url) > 2000:  # Much more lenient
                return False
            return True
        except Exception:
            return True  # Default to True on error

    def parse_sitemap(self, response):
        try:
            urls_found = 0
            try:
                root = ET.fromstring(response.body)
                namespaces = [
                    {'sitemap': 'http://www.sitemaps.org/schemas/sitemap/0.9'},
                    {'sitemap': 'http://www.google.com/schemas/sitemap/0.84'},
                    {}
                ]
                for ns in namespaces:
                    url_elems = root.findall('.//sitemap:url', ns) if ns else root.findall('.//url')
                    sitemap_elems = root.findall('.//sitemap:sitemap', ns) if ns else root.findall('.//sitemap')

                    for sm in sitemap_elems:
                        loc = sm.find('sitemap:loc', ns) if ns else (sm.find('loc') or sm.find('.//loc'))
                        if loc is not None and loc.text:
                            sm_url = self._canonicalize_url(loc.text.strip())
                            yield scrapy.Request(
                                sm_url, callback=self.parse_sitemap,
                                meta={"dont_cache": True, "depth": 0},
                                priority=999, errback=self.handle_error
                            )

                    for u in url_elems:
                        loc = u.find('sitemap:loc', ns) if ns else (u.find('loc') or u.find('.//loc'))
                        if loc is not None and loc.text:
                            page_url = self._canonicalize_url(loc.text.strip())
                            if self._should_process_url(page_url) and not self._is_url_already_processed(page_url):
                                self.sitemap_urls.add(page_url)
                                self.discovered_urls.add(page_url)
                                yield self._create_request_for_url(page_url, from_sitemap=True, depth=0)
                                urls_found += 1
                    if urls_found:
                        break

                if urls_found == 0:
                    for loc in root.findall('.//loc'):
                        if loc.text:
                            page_url = self._canonicalize_url(loc.text.strip())
                            if self._should_process_url(page_url) and not self._is_url_already_processed(page_url):
                                self.sitemap_urls.add(page_url)
                                self.discovered_urls.add(page_url)
                                yield self._create_request_for_url(page_url, from_sitemap=True, depth=0)
                                urls_found += 1

                logger.info(f"Queued {urls_found} sitemap URLs from {response.url}")
            except ET.ParseError:
                urls = re.findall(r']*>(https?://[^<]+)', response.text, re.IGNORECASE)
                for u in urls:
                    page_url = self._canonicalize_url(u)
                    if self._should_process_url(page_url) and not self._is_url_already_processed(page_url):
                        self.sitemap_urls.add(page_url)
                        self.discovered_urls.add(page_url)
                        yield self._create_request_for_url(page_url, from_sitemap=True, depth=0)
                logger.info(f"Regex-extracted {len(urls)} URLs from {response.url}")
        except Exception as e:
            logger.error(f"Sitemap parse error {response.url}: {e}")

    def _create_request_for_url(self, url: str, from_sitemap: bool = False, depth: int = 0) -> scrapy.Request:
        priority = 95 if from_sitemap else max(10, 80 - (depth * 5))
        return scrapy.Request(
            url,
            callback=self.parse_any,
            errback=self.handle_error,
            headers=self._get_default_headers(),
            meta={"depth": depth, "playwright": False, "dont_cache": True, "from_sitemap": from_sitemap},
            priority=priority,
            dont_filter=False,
        )

    def parse_any(self, response):
        ctype = (response.headers.get("Content-Type") or b"").decode("latin1").lower()
        url = response.url.lower()
        if "application/json" in ctype or url.endswith(".json") or "/wp-json/" in url:
            yield from self.parse_json(response)
        else:
            yield from self.parse_page(response)

    def parse_page(self, response):
        try:
            # Check if already processed before doing any work
            if self._is_url_already_processed(response.url):
                logger.info(f"🔄 Skipping already processed page: {response.url}")
                return
                
            # Mark as currently being processed
            self._mark_url_as_processing(response.url)
            
            self.urls_processed += 1
            current_depth = response.meta.get("depth", 0)

            # Early exit for binary files - check URL before any processing
            if not self._should_process_url(response.url):
                logger.debug(f"Skipping binary file in parse_page: {response.url}")
                return

            if response.status == 404:
                self.failed_urls.add(response.url)
                return
            if response.status != 200:
                return
            if not getattr(response, "text", ""):
                return

            extracted_count = 0
            for item in self._extract_content_from_page(response):
                extracted_count += 1
                self.items_extracted += 1
                yield item

            # Mark as fully processed after content extraction
            self._mark_url_as_fully_processed(response.url)

            # Discover links and pagination
            yield from self._discover_and_follow_links(response)

            # Fallback to Playwright if thin content
            if extracted_count < 3 and not response.meta.get("playwright", False) and PLAYWRIGHT_AVAILABLE:
                yield scrapy.Request(
                    response.url,
                    callback=self.parse_rendered,
                    errback=self.handle_error,
                    meta={
                        "playwright": True,
                        "playwright_page_methods": [
                            PageMethod("wait_for_timeout", 1500),
                            PageMethod("wait_for_load_state", "networkidle"),
                        ],
                        "depth": current_depth,
                        "from_sitemap": response.meta.get("from_sitemap", False),
                    },
                    priority=50,
                    dont_filter=True,
                )
        except Exception as e:
            logger.error(f"Critical error processing page {response.url}: {e}")

    def _discover_and_follow_links(self, response):
        try:
            current_depth = response.meta.get("depth", 0)
            if self.max_depth and current_depth >= self.max_depth:
                return

            # Use centralized SKIP_EXTENSIONS list, removing dots for LinkExtractor
            deny_extensions_list = [ext.lstrip('.') for ext in self.SKIP_EXTENSIONS]
            
            le = LinkExtractor(
                allow_domains=self.allowed_domains,
                unique=True,
                deny_extensions=deny_extensions_list,
                deny=[
                    r'/wp-content/uploads/.*\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$',
                    r'/downloads/.*\.(pdf|doc|docx|zip|exe)$',
                    r'/files/.*\.(pdf|doc|docx)$',
                ]
            )
            links = [l.url for l in le.extract_links(response)]

            if self.aggressive_discovery:
                extra_selectors = [
                    'a::attr(href)',
                    'nav a::attr(href)',
                    'header a::attr(href)',
                    'footer a::attr(href)',
                    '.menu a::attr(href)',
                    '.navigation a::attr(href)',
                    '.sidebar a::attr(href)',
                    '.widget a::attr(href)',
                    'link[rel="next"]::attr(href)',
                    'a[rel="next"]::attr(href)',
                ]
                for sel in extra_selectors:
                    try:
                        links.extend(response.css(sel).getall())
                    except Exception:
                        pass

            # Pagination candidates
            links.extend(self._generate_pagination_candidates(response))

            followed = 0
            seen = set()
            for href in links:
                if not href or href in seen:
                    continue
                seen.add(href)
                if href.startswith(("javascript:", "mailto:", "tel:", "#")):
                    continue
                absolute_url = self._canonicalize_url(response.urljoin(href))
                
                # Double-check URL filtering before yielding request
                if not self._should_process_url(absolute_url):
                    logger.debug(f"Filtering out binary file URL in link discovery: {absolute_url}")
                    continue
                    
                if not self._should_follow_link(absolute_url):
                    continue
                
                # Skip if already processed or currently being processed
                if self._is_url_already_processed(absolute_url):
                    logger.debug(f"🔄 Skipping already processed URL in link discovery: {absolute_url}")
                    continue
                
                canonical_url = self._canonicalize_url(absolute_url)
                if canonical_url in self.currently_processing_urls:
                    logger.debug(f"⏳ Skipping currently processing URL: {absolute_url}")
                    continue
                    
                self.discovered_urls.add(absolute_url)
                yield scrapy.Request(
                    absolute_url,
                    callback=self.parse_any,
                    errback=self.handle_error,
                    headers=self._get_default_headers(),
                    meta={
                        "depth": current_depth + 1,
                        "playwright": False,
                        "dont_cache": True,
                        "from_sitemap": False,
                        "parent_url": response.url,
                    },
                    priority=max(10, self._calculate_link_priority(absolute_url)),
                    dont_filter=False,
                )
                followed += 1
                if followed >= self.max_links_per_page:
                    break
        except Exception as e:
            logger.warning(f"Link discovery error for {response.url}: {e}")

    def _generate_pagination_candidates(self, response) -> List[str]:
        url = response.url
        candidates = []
        patterns = [
            (r"([?&])page=(\d+)", "page"),
            (r"/page/(\d+)/?$", "slashpage"),
            (r"([?&])p=(\d+)", "p"),
            (r"([?&])offset=(\d+)", "offset"),
            (r"([?&])start=(\d+)", "start"),
        ]
        for pat, kind in patterns:
            m = re.search(pat, url, re.IGNORECASE)
            if m:
                try:
                    cur = int(m.group(2))
                    for nxt in range(cur + 1, cur + 4):
                        if kind == "slashpage":
                            cand = re.sub(r"/page/\d+/?$", f"/page/{nxt}", url)
                        else:
                            prefix = m.group(1)
                            cand = re.sub(pat, f"{prefix}{kind}={nxt}", url, flags=re.IGNORECASE)
                        candidates.append(cand)
                except Exception:
                    pass
        return [self._canonicalize_url(response.urljoin(c)) for c in candidates]

    def _calculate_link_priority(self, url: str) -> int:
        try:
            parsed = urlparse(url)
            path = parsed.path.lower()
            base = 50
            for hp in ["/about", "/services", "/products", "/contact", "/blog", "/news", "/article", "/post",
                       "/category", "/tag", "/archive", "/page", "/author"]:
                if hp in path:
                    base += 10
                    break
            if path.count("/") > 6:
                base -= 10
            if len(parsed.query) > 80:
                base -= 10
            return max(10, min(100, base))
        except Exception:
            return 50

    def _should_follow_link(self, url: str) -> bool:
        try:
            parsed = urlparse(url)
            # Very lenient - only basic domain check and obvious exclusions
            if not any(d in parsed.netloc for d in self.allowed_domains):
                return False
            
            # Only exclude obvious non-content patterns
            exclude_patterns = [
                '/wp-admin/', '/admin/', '/login/', '/register/',
                '/wp-login.php', '/wp-register.php',
                '?action=logout', '?action=login',
                '/feed/', '/rss/', '/atom/',
                '?format=rss', '?format=atom'
            ]
            
            for pattern in exclude_patterns:
                if pattern in url.lower():
                    return False
            
            return True
        except Exception:
            return True  # Default to True - be aggressive

    def _extract_content_from_page(self, response):
        items = []

        def mk(text: str, ctype: str):
            if not text or not text.strip():
                return
            
            # MINIMAL cleaning to preserve maximum content for comprehensive extraction
            text = text.strip()
            # Only remove excessive whitespace
            text = re.sub(r'\s+', ' ', text)
            
            # Very permissive - include almost everything
            if len(text) >= 2:  # Very low threshold
                try:
                    item = self._build_item(response, text, content_type=ctype)
                    items.append(item)
                except ValueError as e:
                    logger.debug(f"Skipping content from {response.url}: {e}")

        # Extract full page text first (most comprehensive)
        full_text = response.css("body").xpath("normalize-space(string(.))").get()
        if full_text and len(full_text.strip()) > 50:
            mk(full_text.strip(), "full_page_text")

        # Title (clean but don't over-process titles)
        title = response.css("title::text").get()
        if title and title.strip():
            # Light cleaning for title - remove extra whitespace but preserve structure
            clean_title = re.sub(r'\s+', ' ', title.strip())
            if len(clean_title) >= 3:
                try:
                    item = self._build_item(response, clean_title, content_type="title")
                    items.append(item)
                except ValueError:
                    pass

        # COMPREHENSIVE content extraction - get everything possible
        all_selectors = [
            # Main content areas
            "article", "main", "[role='main']", ".content", "#content", 
            ".post-content", ".entry-content", ".article-content", ".page-content",
            ".rich-text", ".prose", ".text-content", ".body-content",
            
            # All text containers
            "p", "div", "span", "section", "aside", "header", "footer",
            
            # Lists and navigation
            "ul", "ol", "li", "nav", "menu",
            
            # Text elements
            "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "b", "i",
            
            # Form elements
            "label", "button", "input[type=submit]", "input[type=button]",
            
            # Tables
            "table", "td", "th", "caption",
            
            # Media captions
            "figcaption", "caption", "[alt]",
        ]
        
        # Extract from ALL possible selectors
        for sel in all_selectors:
            try:
                for el in response.css(sel):
                    txt = el.xpath("normalize-space(string(.))").get()
                    if txt and len(txt) > 5:  # Very low threshold
                        mk(txt, f"element_{sel.replace('[', '').replace(']', '').replace('=', '_')}")
            except Exception:
                continue

        # Meta description (clean but preserve)
        md = response.css('meta[name="description"]::attr(content), meta[property="og:description"]::attr(content)').get()
        if md and len(md.strip()) > 15:
            clean_meta = re.sub(r'\s+', ' ', md.strip())
            try:
                item = self._build_item(response, clean_meta, content_type="meta_description")
                items.append(item)
            except ValueError:
                pass

        # Alt text and captions (only meaningful ones)
        for t in response.css("img::attr(alt), figure figcaption::text").getall():
            if t and t.strip() and len(t.strip()) > 10:
                clean_alt = re.sub(r'\s+', ' ', t.strip())
                if not self._is_boilerplate_text(clean_alt):
                    try:
                        item = self._build_item(response, clean_alt, content_type="alt_or_caption")
                        items.append(item)
                    except ValueError:
                        pass

        # JSON-LD structured data (extract meaningful text content)
        for js in response.css('script[type="application/ld+json"]::text').getall():
            try:
                data = json.loads(js)
                structured_text = self._extract_text_from_jsonld(data)
                if structured_text and len(structured_text) > 20:
                    mk(structured_text, "structured_data")
            except Exception:
                pass

        return items
    
    def _extract_text_from_jsonld(self, data) -> str:
        """Extract meaningful text content from JSON-LD structured data."""
        text_parts = []
        
        def extract_text_recursive(obj):
            if isinstance(obj, dict):
                # Extract common text fields
                text_fields = ['name', 'title', 'description', 'text', 'articleBody', 'headline', 'summary']
                for field in text_fields:
                    if field in obj and isinstance(obj[field], str):
                        text_parts.append(obj[field].strip())
                
                # Recurse into other dict values
                for value in obj.values():
                    extract_text_recursive(value)
            elif isinstance(obj, list):
                for item in obj:
                    extract_text_recursive(item)
            elif isinstance(obj, str) and len(obj.strip()) > 20:
                # Only include substantial text strings
                text_parts.append(obj.strip())
        
        extract_text_recursive(data)
        return ' '.join(text_parts)

    def parse_json(self, response):
        try:
            # Check if already processed before doing any work
            if self._is_url_already_processed(response.url):
                logger.info(f"🔄 Skipping already processed JSON: {response.url}")
                return
                
            # Mark as currently being processed
            self._mark_url_as_processing(response.url)
            
            url = response.url.lower()
            try:
                data = json.loads(response.text)
            except Exception:
                return

            def yield_text(text: str, ctype: str):
                if text and isinstance(text, str) and text.strip():
                    clean = re.sub(r"<[^>]+>", " ", text)
                    clean = re.sub(r"\s+", " ", clean).strip()
                    item = self._build_item(response, clean, content_type=ctype)
                    yield item

            extracted_any = False

            # Handle WordPress REST API fields
            if any(p in url for p in ALLOW_JSON_VALUE_PATTERNS):
                objs = data if isinstance(data, list) else [data]
                for obj in objs:
                    title = (((obj or {}).get("title") or {}).get("rendered")) or obj.get("title")
                    content = (((obj or {}).get("content") or {}).get("rendered")) or obj.get("content")
                    excerpt = (((obj or {}).get("excerpt") or {}).get("rendered")) or obj.get("excerpt")
                    if title:
                        yield from yield_text(title, "title")
                        extracted_any = True
                    if content:
                        yield from yield_text(content, "block")
                        extracted_any = True
                    if excerpt:
                        yield from yield_text(excerpt, "meta_description")
                        extracted_any = True
                
                # Mark as fully processed after content extraction
                if extracted_any:
                    self._mark_url_as_fully_processed(response.url)
                return

            # Generic JSON string harvesting
            def walk(v):
                if isinstance(v, dict):
                    for vv in v.values():
                        yield from walk(vv)
                elif isinstance(v, list):
                    for vv in v:
                        yield from walk(vv)
                elif isinstance(v, str):
                    if len(v.strip()) >= 10:
                        yield v.strip()
            
            for s in walk(data):
                item = self._build_item(response, s, content_type="json_text")
                yield item
                extracted_any = True
            
            # Mark as fully processed after content extraction
            if extracted_any:
                self._mark_url_as_fully_processed(response.url)

        except Exception as e:
            logger.debug(f"JSON parse error at {response.url}: {e}")

    def parse_rendered(self, response):
        try:
            # Check if already processed before doing any work
            if self._is_url_already_processed(response.url):
                logger.info(f"🔄 Skipping already processed rendered page: {response.url}")
                return
                
            # Mark as currently being processed (if not already)
            self._mark_url_as_processing(response.url)
            
            if not getattr(response, "text", ""):
                return
            
            extracted_any = False
            for text in response.xpath('//text()[normalize-space() and string-length(normalize-space()) > 10]').getall():
                clean = re.sub(r"\s+", " ", text.strip())
                if 20 < len(clean) < 50000:
                    item = self._build_item(response, clean, content_type="rendered_text")
                    yield item
                    extracted_any = True
            
            # Mark as fully processed after content extraction
            if extracted_any:
                self._mark_url_as_fully_processed(response.url)
        except Exception as e:
            logger.error(f"Playwright rendered parse error {response.url}: {e}")

    def handle_sitemap_error(self, failure):
        logger.warning(f"Sitemap failed: {getattr(failure, 'request', None) and failure.request.url}")
        return []

    def handle_error(self, failure):
        url_str = failure.request.url if hasattr(failure, "request") else str(failure)
        logger.error(f"Request failed for {url_str}: {getattr(failure, 'value', failure)}")

    def close(self, reason):
        logger.info(f"\n🛑 SPIDER CLOSING - Reason: {reason}")
        logger.info(f"📊 Total URLs processed: {self.urls_processed}")
        logger.info(f"📊 Total items extracted: {self.items_extracted}")
        logger.info(f"📊 Total URLs discovered: {len(self.discovered_urls)}")
        logger.info(f"📊 Total URLs fully processed: {len(self.fully_processed_urls)}")
        logger.info(f"📊 Total URLs failed: {len(self.failed_urls)}")
        logger.info(f"📊 Sitemap URLs: {len(self.sitemap_urls)}")
        logger.info(f"📊 URLs still processing: {len(self.currently_processing_urls)}")
        
        # Report duplicate prevention effectiveness
        total_discovered = len(self.discovered_urls)
        total_processed = len(self.fully_processed_urls)
        if total_discovered > 0:
            dedup_rate = (total_discovered - total_processed) / total_discovered * 100
            logger.info(f"📊 Deduplication effectiveness: {dedup_rate:.1f}% URLs avoided reprocessing")