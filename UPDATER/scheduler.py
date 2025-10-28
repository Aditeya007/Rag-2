# scheduler.py - Automated RAG Update Scheduler
# Runs the updater on a schedule (daily, hourly, weekly, or custom intervals)

import schedule
import time
import logging
from datetime import datetime
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('rag_scheduler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class UpdateScheduler:
    """
    Automated scheduler for RAG database updates.
    Runs the updater spider on a configurable schedule.
    """

    def __init__(self, domain, start_url, mongo_uri=None):
        self.domain = domain
        self.start_url = start_url
        self.mongo_uri = mongo_uri or "mongodb://localhost:27017/"
        self.last_run = None
        self.run_count = 0

    def run_update(self):
        """Execute a single update cycle"""
        try:
            self.run_count += 1
            logger.info(f"\n{'='*80}")
            logger.info(f"⏰ SCHEDULED UPDATE #{self.run_count} STARTED")
            logger.info(f"🕐 Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"{'='*80}")

            # Import and run the updater
            from updater import run_updater

            run_updater(
                domain=self.domain,
                start_url=self.start_url,
                mongo_uri=self.mongo_uri
            )

            self.last_run = datetime.now()
            logger.info(f"\n{'='*80}")
            logger.info(f"✅ UPDATE #{self.run_count} COMPLETED SUCCESSFULLY")
            logger.info(f"🕐 Finished: {self.last_run.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"{'='*80}\n")

        except Exception as e:
            logger.error(f"\n{'='*80}")
            logger.error(f"❌ UPDATE #{self.run_count} FAILED")
            logger.error(f"Error: {e}")
            logger.error(f"{'='*80}\n", exc_info=True)

    def start_daily(self, hour=2, minute=0):
        """
        Schedule daily updates at a specific time.

        Args:
            hour: Hour of day (0-23) to run update (default: 2 AM)
            minute: Minute of hour (0-59) to run update (default: 0)
        """
        schedule_time = f"{hour:02d}:{minute:02d}"
        schedule.every().day.at(schedule_time).do(self.run_update)

        logger.info(f"\n{'='*80}")
        logger.info(f"📅 SCHEDULER STARTED - DAILY MODE")
        logger.info(f"{'='*80}")
        logger.info(f"⏰ Schedule: Every day at {schedule_time}")
        logger.info(f"🎯 Target: {self.start_url}")
        logger.info(f"🗄️ MongoDB: {self.mongo_uri}")
        logger.info(f"{'='*80}")
        logger.info(f"Press Ctrl+C to stop scheduler\n")

        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            logger.info(f"\n🛑 Scheduler stopped by user")
            logger.info(f"📊 Total updates run: {self.run_count}")

    def start_hourly(self):
        """Schedule updates to run every hour"""
        schedule.every().hour.do(self.run_update)

        logger.info(f"\n{'='*80}")
        logger.info(f"📅 SCHEDULER STARTED - HOURLY MODE")
        logger.info(f"{'='*80}")
        logger.info(f"⏰ Schedule: Every hour")
        logger.info(f"🎯 Target: {self.start_url}")
        logger.info(f"🗄️ MongoDB: {self.mongo_uri}")
        logger.info(f"{'='*80}")
        logger.info(f"Press Ctrl+C to stop scheduler\n")

        try:
            while True:
                schedule.run_pending()
                time.sleep(60)
        except KeyboardInterrupt:
            logger.info(f"\n🛑 Scheduler stopped by user")
            logger.info(f"📊 Total updates run: {self.run_count}")

    def start_weekly(self, day="monday", hour=2, minute=0):
        """
        Schedule weekly updates on a specific day and time.

        Args:
            day: Day of week (monday, tuesday, etc.)
            hour: Hour of day (0-23) to run update
            minute: Minute of hour (0-59) to run update
        """
        schedule_time = f"{hour:02d}:{minute:02d}"
        day_lower = day.lower()

        # Map day to schedule method
        day_methods = {
            "monday": schedule.every().monday,
            "tuesday": schedule.every().tuesday,
            "wednesday": schedule.every().wednesday,
            "thursday": schedule.every().thursday,
            "friday": schedule.every().friday,
            "saturday": schedule.every().saturday,
            "sunday": schedule.every().sunday
        }

        if day_lower not in day_methods:
            logger.error(f"❌ Invalid day: {day}. Use monday, tuesday, etc.")
            sys.exit(1)

        day_methods[day_lower].at(schedule_time).do(self.run_update)

        logger.info(f"\n{'='*80}")
        logger.info(f"📅 SCHEDULER STARTED - WEEKLY MODE")
        logger.info(f"{'='*80}")
        logger.info(f"⏰ Schedule: Every {day.capitalize()} at {schedule_time}")
        logger.info(f"🎯 Target: {self.start_url}")
        logger.info(f"🗄️ MongoDB: {self.mongo_uri}")
        logger.info(f"{'='*80}")
        logger.info(f"Press Ctrl+C to stop scheduler\n")

        try:
            while True:
                schedule.run_pending()
                time.sleep(60)
        except KeyboardInterrupt:
            logger.info(f"\n🛑 Scheduler stopped by user")
            logger.info(f"📊 Total updates run: {self.run_count}")

    def start_custom(self, interval_minutes=30):
        """
        Schedule updates at custom intervals.

        Args:
            interval_minutes: Minutes between updates (default: 30)
        """
        schedule.every(interval_minutes).minutes.do(self.run_update)

        logger.info(f"\n{'='*80}")
        logger.info(f"📅 SCHEDULER STARTED - CUSTOM INTERVAL MODE")
        logger.info(f"{'='*80}")
        logger.info(f"⏰ Schedule: Every {interval_minutes} minutes")
        logger.info(f"🎯 Target: {self.start_url}")
        logger.info(f"🗄️ MongoDB: {self.mongo_uri}")
        logger.info(f"{'='*80}")
        logger.info(f"Press Ctrl+C to stop scheduler\n")

        try:
            while True:
                schedule.run_pending()
                time.sleep(60)
        except KeyboardInterrupt:
            logger.info(f"\n🛑 Scheduler stopped by user")
            logger.info(f"📊 Total updates run: {self.run_count}")


def print_usage():
    """Print usage instructions"""
    print("\nUsage: python scheduler.py <domain> <start_url> <schedule_type> [options] [mongo_uri]")
    print("\nSchedule Types:")
    print("  daily <hour> <minute>           - Daily at specific time (default: 02:00)")
    print("  hourly                          - Every hour")
    print("  weekly <day> <hour> <minute>    - Weekly on specific day (default: monday 02:00)")
    print("  custom <minutes>                - Custom interval in minutes")
    print("\nExamples:")
    print("  python scheduler.py example.com https://example.com daily 3 30")
    print("  python scheduler.py example.com https://example.com hourly")
    print("  python scheduler.py example.com https://example.com weekly friday 2 0")
    print("  python scheduler.py example.com https://example.com custom 120")
    print("  python scheduler.py example.com https://example.com daily 2 0 mongodb://localhost:27017/")
    print()


def main():
    """Main entry point"""
    if len(sys.argv) < 4:
        print("❌ Error: Insufficient arguments")
        print_usage()
        sys.exit(1)

    domain = sys.argv[1]
    start_url = sys.argv[2]
    schedule_type = sys.argv[3].lower()

    # Find MongoDB URI if provided (always last argument)
    mongo_uri = None
    for arg in sys.argv[4:]:
        if arg.startswith("mongodb://") or arg.startswith("mongodb+srv://"):
            mongo_uri = arg
            break

    # Create scheduler
    scheduler = UpdateScheduler(domain, start_url, mongo_uri)

    try:
        if schedule_type == "daily":
            hour = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4].isdigit() else 2
            minute = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5].isdigit() else 0
            scheduler.start_daily(hour, minute)

        elif schedule_type == "hourly":
            scheduler.start_hourly()

        elif schedule_type == "weekly":
            day = sys.argv[4] if len(sys.argv) > 4 and not sys.argv[4].isdigit() else "monday"
            hour = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5].isdigit() else 2
            minute = int(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6].isdigit() else 0
            scheduler.start_weekly(day, hour, minute)

        elif schedule_type == "custom":
            interval = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4].isdigit() else 30
            scheduler.start_custom(interval)

        else:
            print(f"❌ Error: Unknown schedule type '{schedule_type}'")
            print_usage()
            sys.exit(1)

    except ValueError as e:
        print(f"❌ Error: Invalid numeric argument - {e}")
        print_usage()
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Scheduler error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
