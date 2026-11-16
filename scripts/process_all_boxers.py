#!/usr/bin/env python3
"""
scripts/process_all_boxers.py - Multi-Breed Verifying Batch Processor for Boxer Archive.

Features:
- Sequential Multi-Breed State Machine: tracks breed transitions across page boundaries.
- Header Detection: identifies BORDER TERRIERS, BOXERS, BULLMASTIFFS, etc.
- Auto-Rotation: fixes 90° CCW/CW rotated scans before inference using Tesseract OSD.
- Natural Number Ordering: Boxer peds 1 -> 567 in chronological order.
- Local JSON caching: in scripts/extracted_cache/
- Pacing: 2.5s delay to maintain 0 rate limits / 429s.
- Idempotent upsert with parent stubbing in PostgreSQL.
"""

import os
import sys
import json
import time
import re
import argparse
from typing import List, Set, Tuple
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env.local"))
load_dotenv(os.path.join(BASE_DIR, ".env"))

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("[ERROR] GEMINI_API_KEY missing in .env.local")
    sys.exit(1)

from google import genai
from google.genai import types
from google.genai import errors
from preprocess import preprocess_image
from models import StudBookPage, DogRecord
from ingest import ingest_batch_dogs, get_db_connection

client = genai.Client(api_key=api_key)

BOXER_DIR = os.path.expanduser("~/Library/CloudStorage/Box-Box/Pedigrees.co/Boxers")
CACHE_DIR = os.path.join(BASE_DIR, "scripts/extracted_cache")

MULTI_BREED_PROMPT = """
You are an expert canine archivist and data extraction specialist.
Analyze this scanned American Kennel Club (AKC) Stud Book sheet.

CRITICAL MULTI-BREED RULES:
1. Centered all-caps headers indicate breed sections (e.g., 'BERNESE MOUNTAIN DOGS', 'BORDER TERRIERS', 'BOXERS', 'BULLMASTIFFS', 'BULL TERRIERS', 'CAIRN TERRIERS').
2. Dogs belong to the breed header immediately above them.
3. If dogs appear at the very top of the page BEFORE any new breed header, mark their breed as the continuing breed from the previous page (default to '{prev_breed}').
4. Standardize breed names: 'Boxer', 'Bullmastiff', 'Border Terrier', 'Bull Terrier', 'Cairn Terrier', etc.

Table Extraction Fields:
- reg_number: official AKC code (e.g. WF048156, WG473912, W12345).
- name: full registered name.
- sex: 'D' for Dog/Male, 'B' for Bitch/Female.
- birth_date: M-D-YY if present.
- color_code: color string (e.g. 'FN & WH', 'BRDL', 'BRDL & WH').
- breed: standardized breed for THIS dog.
- sire_name, sire_reg, dam_name, dam_reg.
- breeders, owners: separate lists.
"""

def natural_key(string_):
    return [int(s) if s.isdigit() else s.lower() for s in re.split(r'(\d+)', string_)]

def get_already_ingested_files() -> Set[str]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT source_file FROM dogs WHERE source_file IS NOT NULL;")
            rows = cur.fetchall()
            return {r[0] for r in rows if r[0]}
    finally:
        conn.close()

def process_sheet(file_path: str, prev_breed: str = "Boxer", max_retries: int = 5) -> Tuple[StudBookPage, str]:
    base_name = os.path.basename(file_path)
    cache_path = os.path.join(CACHE_DIR, f"{base_name}.json")

    # If cached on disk, return it
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            page_record = StudBookPage.model_validate(data)
            last_breed = page_record.dogs[-1].breed if page_record.dogs else page_record.breed
            return page_record, last_breed

    # Preprocess & Auto-rotate
    upright_im, rot = preprocess_image(file_path, max_dim=2200)

    prompt = MULTI_BREED_PROMPT.format(prev_breed=prev_breed)

    delay = 2.0
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=[upright_im, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=StudBookPage.model_json_schema(),
                    temperature=0.1
                )
            )
            data = json.loads(response.text)
            page_record = StudBookPage.model_validate(data)

            # Save to disk cache
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

            last_breed = page_record.dogs[-1].breed if page_record.dogs else page_record.breed
            return page_record, last_breed

        except errors.ClientError as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                print(f"\n[RATE LIMIT] Backing off {delay:.1f}s on {base_name}...")
                time.sleep(delay)
                delay *= 2.0
            else:
                raise e
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(delay)
            delay *= 1.5

    raise RuntimeError(f"Failed to process {base_name} after {max_retries} attempts")

def run_boxer_batch(limit: int = None):
    os.makedirs(CACHE_DIR, exist_ok=True)

    if not os.path.exists(BOXER_DIR):
        print(f"[ERROR] Boxer directory not found: {BOXER_DIR}")
        return

    all_files = [f for f in os.listdir(BOXER_DIR) if not f.startswith('.') and f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    all_files.sort(key=natural_key)

    candidates = [os.path.join(BOXER_DIR, f) for f in all_files]

    already_done = get_already_ingested_files()
    unprocessed = [f for f in candidates if os.path.basename(f) not in already_done]
    already_count = len(candidates) - len(unprocessed)

    to_process = unprocessed[:limit] if (limit and limit > 0) else unprocessed

    print("=" * 75)
    print("BOXER MULTI-BREED VERIFIED INGESTION PIPELINE")
    print("=" * 75)
    print(f"Total Sheets in Archive:        {len(candidates)}")
    print(f"Already Ingested:               {already_count} sheets (Skipping)")
    print(f"Sheets to Process in this Run:  {len(to_process)} sheets")
    print("=" * 75)

    current_breed = "Boxer"
    total_dogs_run = 0
    breed_counts = {}
    start_time = time.time()

    for idx, fpath in enumerate(to_process, 1):
        bname = os.path.basename(fpath)
        print(f"[{idx}/{len(to_process)}] Processing {bname} (Incoming Breed: {current_breed})...", end=" ", flush=True)

        try:
            page, next_breed = process_sheet(fpath, prev_breed=current_breed)
            current_breed = next_breed

            if page.dogs:
                ingest_batch_dogs(page.dogs, source_file=bname)
                total_dogs_run += len(page.dogs)
                for d in page.dogs:
                    breed_counts[d.breed] = breed_counts.get(d.breed, 0) + 1

                print(f"DONE (+{len(page.dogs)} dogs | Carryover: {current_breed})")
            else:
                print(f"DONE (0 dogs, Divider/Preface | Carryover: {current_breed})")

            # Polite 2.5s pace pause to prevent 429s
            time.sleep(2.5)

        except Exception as e:
            print(f"FAILED -> {e}")

    elapsed = time.time() - start_time
    print("\n" + "=" * 75)
    print("BOXER BATCH EXECUTION REPORT")
    print("=" * 75)
    print(f"Elapsed Time:         {elapsed:.1f}s ({elapsed/60:.2f} mins)")
    print(f"Dogs Added in Run:    {total_dogs_run}")
    print("Breed Breakdown in this run:")
    for b, c in sorted(breed_counts.items(), key=lambda x: -x[1]):
        print(f"  • {b}: {c:,} dogs")

    # Audit Database
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM dogs;")
            print(f"\nGRAND TOTAL DOGS IN DATABASE: {cur.fetchone()[0]:,}")
            cur.execute("SELECT breed, count(*) FROM dogs GROUP BY breed ORDER BY count(*) DESC LIMIT 15;")
            print("Top Breeds in Database:")
            for row in cur.fetchall():
                print(f"  • {row[0]}: {row[1]:,} dogs")
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process Boxer Stud Book archive")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of sheets to process in this run")
    args = parser.parse_args()
    run_boxer_batch(limit=args.limit)
