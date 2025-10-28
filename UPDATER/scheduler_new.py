import schedule
import time
import subprocess
import sys
import re
from datetime import datetime

def job(url):
    """
    The job function to be scheduled. This version will print all output from the subprocess.
    """
    print(f"\n[{time.ctime()}] Triggering run_updater.py for {url}...")
    try:
        # Run the subprocess and allow its output to be displayed in the console
        subprocess.run(
            [sys.executable, 'UPDATER/run_updater.py', url],
            check=True
        )
        print(f"[{time.ctime()}] Successfully finished run.")
    except subprocess.CalledProcessError as e:
        print(f"[{time.ctime()}] ERROR: The updater script failed to run. See error output above.")
    except FileNotFoundError:
        print("CRITICAL ERROR: Could not find the 'UPDATER/run_updater.py' script.")
        sys.exit(1)

def main():
    """
    Asks for a URL once, then schedules the updater to run.
    """
    print("--- Persistent RAG Updater Scheduler (DEBUG MODE) ---")
    url_input = input("Enter the full starting URL to monitor (e.g., https://www.example.com): ").strip()

    if not re.match(r'https?://', url_input):
        print("Invalid URL.")
        return

    print(f"\nScheduler configured for: {url_input}")

    # --- Set the Schedule ---
    schedule.every(15).minutes.do(job, url=url_input)

    # --- Run the first job immediately ---
    print("\nStarting the first run immediately...")
    job(url_input) # Simplified the first run call

    # --- Run the scheduler loop ---
    print("\nScheduler is now waiting for the next run.")
    while True:
        schedule.run_pending()
        next_run_time = schedule.next_run
        # This block is now fixed to prevent the 'strftime' crash
        if isinstance(next_run_time, datetime):
            print(f"Next run is scheduled for: {next_run_time.strftime('%Y-%m-%d %H:%M:%S')}", end='\r')
        time.sleep(1)

if __name__ == "__main__":
    main()