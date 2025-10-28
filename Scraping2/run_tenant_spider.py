"""Utility entrypoint to run the FixedUniversalSpider for a specific tenant.

This script is designed for programmatic usage (e.g. from the admin backend) so
we can provision tenant-scoped vector stores without requiring interactive
input.
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from urllib.parse import urlparse

import nltk
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

from Scraping2.spiders.spider import FixedUniversalSpider


def _ensure_nltk_models() -> None:
    """Best-effort download of tokenizers required by the pipelines."""
    for package in ("punkt", "punkt_tab"):
        try:
            nltk.data.find(f"tokenizers/{package}")
        except LookupError:
            try:
                nltk.download(package, quiet=True)
            except Exception as exc:  # pragma: no cover - download failure shouldn't crash job
                logging.warning("Failed to download NLTK package %s: %s", package, exc)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the universal scraper for a tenant")
    parser.add_argument("--start-url", required=True, help="Seed URL to begin crawling")
    parser.add_argument("--domain", help="Allowed domain. If omitted it's derived from the start URL")
    parser.add_argument("--resource-id", required=True, help="Tenant resource identifier")
    parser.add_argument("--user-id", help="MongoDB user id that owns this scrape")
    parser.add_argument("--vector-store-path", required=True, help="Directory where the tenant's Chroma DB lives")
    parser.add_argument("--collection-name", default="scraped_content", help="ChromaDB collection name")
    parser.add_argument("--embedding-model-name", help="SentenceTransformer model for embeddings")
    parser.add_argument("--max-depth", type=int, default=999, help="Maximum crawl depth")
    parser.add_argument("--max-links-per-page", type=int, default=1000, help="Maximum outgoing links followed per page")
    parser.add_argument("--sitemap-url", help="Optional explicit sitemap URL")
    parser.add_argument("--respect-robots", dest="respect_robots", action="store_true", help="Respect robots.txt during crawl")
    parser.add_argument("--no-respect-robots", dest="respect_robots", action="store_false", help="Ignore robots.txt during crawl")
    parser.set_defaults(respect_robots=None)
    parser.add_argument(
        "--aggressive-discovery",
        dest="aggressive_discovery",
        action="store_true",
        help="Enable aggressive discovery (default)"
    )
    parser.add_argument(
        "--no-aggressive-discovery",
        dest="aggressive_discovery",
        action="store_false",
        help="Disable aggressive discovery"
    )
    parser.set_defaults(aggressive_discovery=True)
    parser.add_argument("--job-id", help="Optional job identifier propagated from the caller")
    parser.add_argument("--log-level", default="INFO", help="Python logging level")
    parser.add_argument("--stats-output", help="Optional path to write crawl stats as JSON")
    return parser.parse_args(argv)


def _validate_and_normalise_args(args: argparse.Namespace) -> None:
    if not args.start_url.lower().startswith(("http://", "https://")):
        raise ValueError("start-url must begin with http:// or https://")

    if not args.domain:
        parsed = urlparse(args.start_url)
        if not parsed.netloc:
            raise ValueError("Unable to derive domain from start-url")
        args.domain = parsed.netloc

    vector_path = os.path.abspath(args.vector_store_path)
    os.makedirs(vector_path, exist_ok=True)
    args.vector_store_path = vector_path


def _configure_logging(level: str) -> None:
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )


def main(argv: list[str]) -> int:
    args = _parse_args(argv)

    try:
        _validate_and_normalise_args(args)
    except ValueError as exc:
        print(json.dumps({
            "status": "failed",
            "error": str(exc),
            "timestamp": datetime.utcnow().isoformat()
        }))
        return 2

    _configure_logging(args.log_level)
    _ensure_nltk_models()

    settings = get_project_settings()
    settings.set('ROBOTSTXT_OBEY', bool(args.respect_robots))
    settings.set('CHROMA_DB_PATH', args.vector_store_path)
    settings.set('CHROMA_COLLECTION_NAME', args.collection_name)
    if args.embedding_model_name:
        settings.set('CHROMA_EMBEDDING_MODEL', args.embedding_model_name)

    process = CrawlerProcess(settings)

    logging.info(
        "Starting tenant scrape",
        extra={
            'resource_id': args.resource_id,
            'start_url': args.start_url,
            'vector_store_path': args.vector_store_path,
            'job_id': args.job_id
        }
    )

    crawler = process.create_crawler(FixedUniversalSpider)
    process.crawl(
        crawler,
        domain=args.domain,
        start_url=args.start_url,
        max_depth=args.max_depth,
        sitemap_url=args.sitemap_url,
        max_links_per_page=args.max_links_per_page,
    respect_robots=bool(args.respect_robots),
        aggressive_discovery=bool(args.aggressive_discovery),
        resource_id=args.resource_id,
        tenant_user_id=args.user_id,
        vector_store_path=args.vector_store_path,
        collection_name=args.collection_name,
        embedding_model_name=args.embedding_model_name,
        scrape_job_id=args.job_id,
    )

    try:
        process.start()
    except KeyboardInterrupt:  # pragma: no cover
        logging.warning("Scrape interrupted by user")
        return 130
    except Exception as exc:
        logging.exception("Scrape failed: %s", exc)
        return 1

    stats = crawler.stats.get_stats() if crawler.stats else {}
    summary = {
        "status": "completed",
        "resource_id": args.resource_id,
        "user_id": args.user_id,
        "job_id": args.job_id,
        "start_url": args.start_url,
        "vector_store_path": args.vector_store_path,
        "collection_name": args.collection_name,
        "stats": stats,
        "timestamp": datetime.utcnow().isoformat()
    }

    if args.stats_output:
        try:
            with open(args.stats_output, "w", encoding="utf-8") as handle:
                json.dump(summary, handle, default=str, indent=2)
        except OSError as exc:
            logging.warning("Unable to write stats output %s: %s", args.stats_output, exc)

    print(json.dumps(summary, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
