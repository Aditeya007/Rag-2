import logging
from datetime import datetime, timedelta
from pymongo import MongoClient
from typing import Dict, List
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

logger = logging.getLogger(__name__)


class UpdateReportGenerator:
    """
    Generates comprehensive reports on RAG database updates.
    Shows statistics, recent changes, and database health.
    """

    def __init__(self, mongo_uri=None, chroma_path=None):
        self.mongo_uri = mongo_uri or "mongodb://localhost:27017/"
        self.chroma_path = chroma_path or "./final_db"

        # MongoDB connection
        self.mongo_client = MongoClient(self.mongo_uri)
        self.db = self.mongo_client["rag_scraper"]
        self.url_tracking = self.db["url_tracking"]

    def generate_full_report(self):
        """Generate complete update report"""
        logger.info("\n" + "="*80)
        logger.info("📊 RAG DATABASE UPDATE REPORT")
        logger.info("="*80)
        logger.info(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"MongoDB: {self.mongo_uri}")
        logger.info(f"ChromaDB: {self.chroma_path}")
        logger.info("="*80 + "\n")

        # Overall statistics
        self._print_overall_stats()

        # Today's activity
        self._print_todays_activity()

        # Recent changes
        self._print_recent_changes()

        # Domain breakdown
        self._print_domain_breakdown()

        # Error summary
        self._print_error_summary()

        # Database health
        self._print_database_health()

        logger.info("\n" + "="*80)
        logger.info("✅ REPORT GENERATION COMPLETE")
        logger.info("="*80 + "\n")

    def _print_overall_stats(self):
        """Print overall database statistics"""
        total_urls = self.url_tracking.count_documents({})
        active_urls = self.url_tracking.count_documents({"status": "active"})
        error_urls = self.url_tracking.count_documents({"status": "error"})

        # Calculate total chunks
        total_chunks = 0
        for doc in self.url_tracking.find({"chunk_ids": {"$exists": True}}):
            total_chunks += len(doc.get("chunk_ids", []))

        # Get oldest and newest scrapes
        oldest = self.url_tracking.find_one(
            {"first_scraped": {"$exists": True}},
            sort=[("first_scraped", 1)]
        )
        newest = self.url_tracking.find_one(
            {"first_scraped": {"$exists": True}},
            sort=[("first_scraped", -1)]
        )

        logger.info("📈 OVERALL STATISTICS")
        logger.info("-" * 80)
        logger.info(f"  Total URLs Tracked: {total_urls:,}")
        logger.info(f"  Active URLs: {active_urls:,}")
        logger.info(f"  URLs with Errors: {error_urls:,}")
        logger.info(f"  Total Chunks in ChromaDB: {total_chunks:,}")

        if oldest:
            logger.info(f"  Oldest Scrape: {oldest.get('first_scraped', 'N/A')}")
        if newest:
            logger.info(f"  Newest Scrape: {newest.get('first_scraped', 'N/A')}")

        logger.info("-" * 80 + "\n")

    def _print_todays_activity(self):
        """Print today's update activity"""
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        new_today = self.url_tracking.count_documents({
            "first_scraped": {"$gte": today_start},
            "update_status": "new"
        })

        modified_today = self.url_tracking.count_documents({
            "last_modified": {"$gte": today_start},
            "update_status": "modified"
        })

        checked_today = self.url_tracking.count_documents({
            "last_checked": {"$gte": today_start}
        })

        logger.info("📅 TODAY'S ACTIVITY")
        logger.info("-" * 80)
        logger.info(f"  URLs Checked: {checked_today:,}")
        logger.info(f"  New URLs Added: {new_today:,}")
        logger.info(f"  URLs Modified: {modified_today:,}")
        logger.info(f"  URLs Unchanged: {checked_today - new_today - modified_today:,}")
        logger.info("-" * 80 + "\n")

    def _print_recent_changes(self, limit=10):
        """Print most recent changes"""
        recent = list(self.url_tracking.find(
            {"last_modified": {"$exists": True}},
            sort=[("last_modified", -1)]
        ).limit(limit))

        logger.info(f"🔄 RECENT CHANGES (Last {limit})")
        logger.info("-" * 80)

        if not recent:
            logger.info("  No recent changes found")
        else:
            for i, doc in enumerate(recent, 1):
                url = doc.get("url", "Unknown")
                status = doc.get("update_status", "unknown")
                modified = doc.get("last_modified", "N/A")
                chunks = len(doc.get("chunk_ids", []))

                logger.info(f"  {i}. [{status.upper()}] {url}")
                logger.info(f"     Modified: {modified} | Chunks: {chunks}")

        logger.info("-" * 80 + "\n")

    def _print_domain_breakdown(self):
        """Print statistics by domain"""
        pipeline = [
            {"$group": {
                "_id": "$domain",
                "count": {"$sum": 1},
                "total_chunks": {"$sum": {"$size": {"$ifNull": ["$chunk_ids", []]}}},
                "last_update": {"$max": "$last_modified"}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]

        domains = list(self.url_tracking.aggregate(pipeline))

        logger.info("🌐 DOMAIN BREAKDOWN (Top 10)")
        logger.info("-" * 80)

        if not domains:
            logger.info("  No domain data available")
        else:
            for i, domain_data in enumerate(domains, 1):
                domain = domain_data.get("_id", "Unknown")
                count = domain_data.get("count", 0)
                chunks = domain_data.get("total_chunks", 0)
                last_update = domain_data.get("last_update", "N/A")

                logger.info(f"  {i}. {domain}")
                logger.info(f"     URLs: {count:,} | Chunks: {chunks:,} | Last Update: {last_update}")

        logger.info("-" * 80 + "\n")

    def _print_error_summary(self):
        """Print error summary"""
        error_docs = list(self.url_tracking.find(
            {"status": "error"},
            {"url": 1, "last_error": 1, "last_checked": 1}
        ).limit(10))

        logger.info("❌ ERROR SUMMARY")
        logger.info("-" * 80)

        if not error_docs:
            logger.info("  ✅ No errors found!")
        else:
            logger.info(f"  Total URLs with Errors: {len(error_docs)}")
            logger.info("\n  Recent Errors:")
            for i, doc in enumerate(error_docs, 1):
                url = doc.get("url", "Unknown")
                error = doc.get("last_error", "No error message")
                checked = doc.get("last_checked", "N/A")

                logger.info(f"\n  {i}. {url}")
                logger.info(f"     Error: {error}")
                logger.info(f"     Last Checked: {checked}")

        logger.info("-" * 80 + "\n")

    def _print_database_health(self):
        """Print database health metrics"""
        # Check for stale URLs (not checked in 7+ days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        stale_count = self.url_tracking.count_documents({
            "last_checked": {"$lt": week_ago}
        })

        # Check for URLs without chunks
        no_chunks = self.url_tracking.count_documents({
            "$or": [
                {"chunk_ids": {"$exists": False}},
                {"chunk_ids": {"$size": 0}}
            ]
        })

        # Check for pending deletions
        pending_deletions = self.url_tracking.count_documents({
            "deletion_pending": True
        })

        total = self.url_tracking.count_documents({})
        health_score = 100

        if total > 0:
            stale_percent = (stale_count / total) * 100
            no_chunks_percent = (no_chunks / total) * 100

            health_score -= min(stale_percent, 30)
            health_score -= min(no_chunks_percent, 20)

        health_score = max(0, health_score)

        logger.info("🏥 DATABASE HEALTH")
        logger.info("-" * 80)
        logger.info(f"  Health Score: {health_score:.1f}/100")
        logger.info(f"  Stale URLs (>7 days): {stale_count:,}")
        logger.info(f"  URLs Without Chunks: {no_chunks:,}")
        logger.info(f"  Pending Deletions: {pending_deletions:,}")

        if health_score >= 90:
            logger.info("  Status: ✅ EXCELLENT")
        elif health_score >= 70:
            logger.info("  Status: ⚠️ GOOD")
        elif health_score >= 50:
            logger.info("  Status: ⚠️ FAIR")
        else:
            logger.info("  Status: ❌ NEEDS ATTENTION")

        logger.info("-" * 80 + "\n")

    def export_csv_report(self, output_file="update_report.csv"):
        """Export detailed report to CSV"""
        import csv

        docs = list(self.url_tracking.find({}))

        if not docs:
            logger.warning("No data to export")
            return

        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            fieldnames = [
                'url', 'domain', 'status', 'update_status', 
                'first_scraped', 'last_checked', 'last_modified',
                'chunk_count', 'content_hash'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for doc in docs:
                writer.writerow({
                    'url': doc.get('url', ''),
                    'domain': doc.get('domain', ''),
                    'status': doc.get('status', ''),
                    'update_status': doc.get('update_status', ''),
                    'first_scraped': str(doc.get('first_scraped', '')),
                    'last_checked': str(doc.get('last_checked', '')),
                    'last_modified': str(doc.get('last_modified', '')),
                    'chunk_count': len(doc.get('chunk_ids', [])),
                    'content_hash': doc.get('content_hash', '')[:16]
                })

        logger.info(f"✅ CSV report exported to: {output_file}")
        logger.info(f"📊 Total records: {len(docs):,}\n")

    def close(self):
        """Close database connections"""
        if self.mongo_client:
            self.mongo_client.close()


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("\nUsage: python report_generator.py <command> [mongo_uri] [chroma_path]")
        print("\nCommands:")
        print("  report     - Generate and display full report")
        print("  export     - Export report to CSV")
        print("\nExamples:")
        print("  python report_generator.py report")
        print("  python report_generator.py export")
        print("  python report_generator.py report mongodb://localhost:27017/")
        print()
        sys.exit(1)

    command = sys.argv[1].lower()
    mongo_uri = sys.argv[2] if len(sys.argv) > 2 else None
    chroma_path = sys.argv[3] if len(sys.argv) > 3 else None

    generator = UpdateReportGenerator(mongo_uri, chroma_path)

    try:
        if command == "report":
            generator.generate_full_report()
        elif command == "export":
            generator.generate_full_report()
            generator.export_csv_report()
        else:
            print(f"❌ Unknown command: {command}")
            print("Use 'report' or 'export'")
            sys.exit(1)
    finally:
        generator.close()


if __name__ == "__main__":
    main()
