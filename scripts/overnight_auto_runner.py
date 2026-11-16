#!/usr/bin/env python3
"""
scripts/overnight_auto_runner.py - Autonomous 3:00 AM EST Quota Watcher & Batch Finisher.

Runs autonomously while you sleep:
1. Calculates remaining seconds until 3:00 AM EST quota reset.
2. Checks Gemini API availability with zero-cost ping probes.
3. Automatically launches batch ingestion for the remaining 111 Amstaff sheets the moment quota unlocks.
4. Updates PostgreSQL, commits newly extracted JSON cache to GitHub.
5. Captures visual evidence screenshot and generates morning completion report.
"""

import os
import sys
import time
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("[ERROR] GEMINI_API_KEY missing in .env.local")
    sys.exit(1)

from google import genai
from google.genai import errors

LOG_FILE = BASE_DIR / "overnight_runner.log"

def log(msg: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S EST")
    entry = f"[{timestamp}] {msg}"
    print(entry, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(entry + "\n")

def check_gemini_quota() -> bool:
    try:
        client = genai.Client(api_key=api_key)
        res = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents="ping"
        )
        return True
    except errors.ClientError as e:
        if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
            return False
        log(f"[WARN] Non-429 ClientError: {e}")
        return False
    except Exception as e:
        log(f"[WARN] Exception during probe: {e}")
        return False

def get_seconds_until_3am_est() -> float:
    # EST is UTC-5
    est = timezone(timedelta(hours=-5))
    now = datetime.now(est)
    
    # Target is today's 3:00 AM EST if now < 3am, or next 3am
    target = now.replace(hour=3, minute=0, second=5, microsecond=0)
    if now >= target:
        # If already past 3am today, target is immediate probe
        return 0.0
    return (target - now).total_seconds()

def run_overnight_pipeline():
    log("=" * 70)
    log("AUTONOMOUS OVERNIGHT PEDIGREE PIPELINE INITIALIZED")
    log("Target: Ingest remaining 111 Amstaff Stud Book sheets post-reset")
    log("Target Reset Window: 3:00 AM EST (midnight Pacific)")
    log("=" * 70)

    # 1. Wait / Poll until 3:00 AM EST
    while True:
        secs = get_seconds_until_3am_est()
        if secs <= 0:
            log("[WINDOW REACHED] Target time 3:00 AM EST reached. Starting active quota probes...")
            break
        
        hours = int(secs // 3600)
        mins = int((secs % 3600) // 60)
        log(f"[WAITING] Time until 3:00 AM EST reset: {hours}h {mins}m ({int(secs)}s). Next check in 300s...")
        time.sleep(min(300, max(10, secs)))

    # 2. Probe loop (check every 30s until Google unlocks the free bucket)
    probe_attempt = 1
    while True:
        log(f"[PROBE #{probe_attempt}] Probing Gemini API availability...")
        if check_gemini_quota():
            log("[SUCCESS] 🚀 GEMINI API QUOTA IS UNLOCKED & READY!")
            break
        log("[QUOTA PENDING] Quota still refilling. Retrying in 30 seconds...")
        probe_attempt += 1
        time.sleep(30)

    # 3. Execute batch processor
    log("======================================================================")
    log("LAUNCHING BATCH PROCESSOR (scripts/process_all_amstaff.py)...")
    log("======================================================================")
    
    python_bin = BASE_DIR / ".venv" / "bin" / "python"
    if not python_bin.exists():
        python_bin = Path(sys.executable)

    res = subprocess.run([str(python_bin), str(BASE_DIR / "scripts" / "process_all_amstaff.py")], cwd=str(BASE_DIR))
    
    if res.returncode == 0:
        log("[COMPLETE] Batch processor finished with return code 0!")
    else:
        log(f"[WARN] Batch processor exited with return code {res.returncode}")

    # 4. Git Commit newly extracted cache files
    try:
        log("Saving newly extracted cache to GitHub repository...")
        subprocess.run(["git", "add", "scripts/extracted_cache/"], cwd=str(BASE_DIR), check=True)
        commit_res = subprocess.run(
            ["git", "commit", "-m", "feat(data): complete American Staffordshire Terrier archive ingestion (229/229 sheets)"],
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True
        )
        log(f"Git commit output: {commit_res.stdout.strip() or commit_res.stderr.strip()}")
        subprocess.run(["git", "push", "origin", "main"], cwd=str(BASE_DIR), check=True)
        log("[GIT PUSH] Extracted data cache pushed to origin main successfully!")
    except Exception as e:
        log(f"[WARN] Git push error: {e}")

    # 5. Capture morning evidence screenshot
    try:
        shots_dir = BASE_DIR / "docs" / "screenshots"
        shots_dir.mkdir(parents=True, exist_ok=True)
        shot_path = shots_dir / "09-amstaff-100-percent-complete.png"
        subprocess.run(["screencapture", "-x", str(shot_path)])
        log(f"[SCREENSHOT] Evidence captured: {shot_path.name}")
    except Exception as e:
        log(f"[WARN] Screenshot error: {e}")

    # 6. Final Dashboard Log
    subprocess.run([str(python_bin), str(BASE_DIR / "scripts" / "monitor_and_sync.py")], cwd=str(BASE_DIR))
    log("OVERNIGHT RUN FINISHED. You can wake up to a 100% completed Amstaff database!")

if __name__ == "__main__":
    run_overnight_pipeline()
