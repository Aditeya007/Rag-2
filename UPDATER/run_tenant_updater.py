"""Tenant-aware wrapper around updater.run_updater.

This script mirrors `Scraping2/run_tenant_spider.py` but targets the incremental
updater. It ensures each tenant writes to its own vector store, tracks job
metadata, and emits JSON output suitable for background processing.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from urllib.parse import urlparse

import nltk

# Ensure parent directory (project root) is on path for imports
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from UPDATER.updater import run_updater  # noqa: E402


def _ensure_nltk_models() -> None:
    """Ensure sentence tokenizers are available for the chunking pipeline."""
    for package in ("punkt", "punkt_tab"):
        try:
            nltk.data.find(f"tokenizers/{package}")
        except LookupError:
            try:
                nltk.download(package, quiet=True)
            except Exception as exc:  # pragma: no cover
                logging.warning("Failed to download NLTK package %s: %s", package, exc)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the incremental updater for a tenant")
    parser.add_argument("--start-url", required=True, help="Seed URL that defines the crawl scope")
    parser.add_argument("--domain", help="Allowed domain (default derived from start-url)")
    parser.add_argument("--resource-id", required=True, help="Tenant resource identifier")
    parser.add_argument("--user-id", help="Tenant user identifier")
    parser.add_argument("--vector-store-path", required=True, help="Tenant-specific ChromaDB directory")
    parser.add_argument("--collection-name", default="scraped_content", help="ChromaDB collection name")
    parser.add_argument("--embedding-model-name", help="SentenceTransformer model override")
    parser.add_argument("--mongo-uri", help="MongoDB connection override for change tracking")
    parser.add_argument("--max-depth", type=int, default=999, help="Maximum crawl depth")
    parser.add_argument("--max-links-per-page", type=int, default=1000, help="Outgoing link cap per page")
    parser.add_argument("--sitemap-url", help="Optional sitemap URL to prime discovery")
    parser.add_argument("--respect-robots", dest="respect_robots", action="store_true", help="Respect robots.txt during crawl")
    parser.add_argument("--no-respect-robots", dest="respect_robots", action="store_false", help="Ignore robots.txt during crawl")
    parser.add_argument("--aggressive-discovery", dest="aggressive_discovery", action="store_true", help="Enable aggressive link discovery (default)")
    parser.add_argument("--no-aggressive-discovery", dest="aggressive_discovery", action="store_false", help="Disable aggressive link discovery")
    parser.set_defaults(aggressive_discovery=True)
    parser.set_defaults(respect_robots=None)
    parser.add_argument("--job-id", help="Optional job identifier for tracking")
    parser.add_argument("--log-level", default="INFO", help="Python logging level (default INFO)")
    parser.add_argument("--stats-output", help="Optional path to write JSON stats summary")
    return parser.parse_args(argv)


def _normalise_args(args: argparse.Namespace) -> None:
    if not args.start_url.lower().startswith(("http://", "https://")):
        raise ValueError("start-url must include http:// or https://")

    if not args.domain:
        parsed = urlparse(args.start_url)
        if not parsed.netloc:
            raise ValueError("Unable to derive domain from start-url")
        args.domain = parsed.netloc

    args.vector_store_path = os.path.abspath(args.vector_store_path)
    os.makedirs(args.vector_store_path, exist_ok=True)


def _configure_logging(level: str) -> None:
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )


def main(argv: list[str]) -> int:
    try:
        args = _parse_args(argv)
        _normalise_args(args)
    except ValueError as exc:
        print(json.dumps({
            "status": "failed",
            "error": str(exc),
            "timestamp": datetime.utcnow().isoformat()
        }))
        return 2

    _configure_logging(args.log_level)
    _ensure_nltk_models()

    logging.info(
        "Starting tenant updater",
        extra={
            'resource_id': args.resource_id,
            'start_url': args.start_url,
            'vector_store_path': args.vector_store_path,
            'job_id': args.job_id
        }
    )

    try:
        stats = run_updater(
            domain=args.domain,
            start_url=args.start_url,
            mongo_uri=args.mongo_uri,
            max_depth=args.max_depth,
            sitemap_url=args.sitemap_url,
            resource_id=args.resource_id,
            tenant_user_id=args.user_id,
            vector_store_path=args.vector_store_path,
            collection_name=args.collection_name,
            embedding_model_name=args.embedding_model_name,
            job_id=args.job_id,
            respect_robots=args.respect_robots,
            aggressive_discovery=args.aggressive_discovery,
            max_links_per_page=args.max_links_per_page,
        )
    except KeyboardInterrupt:  # pragma: no cover
        logging.warning("Updater interrupted by user")
        return 130
    except Exception as exc:
        logging.exception("Updater failed: %s", exc)
        print(json.dumps({
            "status": "failed",
            "error": str(exc),
            "resource_id": args.resource_id,
            "user_id": args.user_id,
            "job_id": args.job_id,
            "timestamp": datetime.utcnow().isoformat()
        }))
        return 1

    summary = {
        "status": "completed",
        "resource_id": args.resource_id,
        "user_id": args.user_id,
        "job_id": args.job_id,
        "start_url": args.start_url,
        "domain": args.domain,
        "vector_store_path": args.vector_store_path,
        "collection_name": args.collection_name,
        "stats": stats or {},
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
    raise SystemExit(main(sys.argv[1:]))
