"""
scripts/process_all_amstaff.py - Robust Batch Processor for all 229 Amstaff Stud Book Sheets.
Features:
- Idempotent: checks database for already-ingested files and resumes safely.
- Auto-rotation: fixes sideways/upside-down scans before inference.
- Local JSON caching: saves every page extraction in scripts/extracted_cache/ to prevent re-calls.
- Rate-limiting & exponential backoff: handles 429s automatically.
- Live progress reporting & final audit metrics.
"""

import os
import sys
import json
import time
from typing import List, Set
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("[ERROR] GEMINI_API_KEY missing in .env.local")
    sys.exit(1)

from google import genai
from google.genai import types
from google.genai import errors
from preprocess import preprocess_image
from models import StudBookPage
from ingest import ingest_batch_dogs, get_db_connection

client = genai.Client(api_key=api_key)

TARGET_DIR = "/Users/daplug/Library/CloudStorage/Box-Box/Pedigrees.co/American Staffordshire Terrier"
CACHE_DIR = "/Users/daplug/Documents/Pedigree Database/scripts/extracted_cache"

STUD_BOOK_PROMPT = """
You are an expert canine archivist and data extraction specialist.
Analyze this scanned American Kennel Club (AKC) Stud Book sheet.
Extract every dog entry listed on this page under the relevant breed section (or all dogs on the page if all same breed).

Table structure rules:
- Reg Number: The official registration code (e.g. RA486186, R888957, W377099). Strip out trailing dates or hyphens that belong to birth date.
- Sex: 'D' for Dog/Male, 'B' for Bitch/Female.
- Breed: Standardized (e.g., 'American Staffordshire Terrier').
- Sire / Dam: Extract sire name and registration code, and dam name and registration code.
- Breeder / Owner: Note that in AKC sheets, Breeders and Owners are listed in the rightmost column, often separated by a slash '/' (e.g. 'J ALBRITTEN / OWNER' or 'BREEDER / OWNER'). Separate them accurately into their respective arrays.
"""

def get_already_ingested_files() -> Set[str]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT source_file FROM dogs WHERE source_file IS NOT NULL;")
            rows = cur.fetchall()
            return {r[0] for r in rows if r[0]}
    finally:
        conn.close()

def process_page(file_path: str, max_retries: int = 5) -> StudBookPage:
    base_name = os.path.basename(file_path)
    cache_path = os.path.join(CACHE_DIR, f"{base_name}.json")

    # If already cached locally, load from disk
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return StudBookPage.model_validate(data)

    # Preprocess image
    upright_im, rot = preprocess_image(file_path, max_dim=2200)

    # Call Gemini with retry / backoff
    delay = 2.0
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=[upright_im, STUD_BOOK_PROMPT],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=StudBookPage.model_json_schema(),
                    temperature=0.1
                )
            )
            data = json.loads(response.text)
            page_record = StudBookPage.model_validate(data)

            # Save to local cache
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

            return page_record
        except errors.ClientError as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                print(f"\n[RATE LIMIT] Rate limited on {base_name}. Backing off {delay:.1f}s (Attempt {attempt+1}/{max_retries})...")
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

def run_batch():
    os.makedirs(CACHE_DIR, exist_ok=True)
    all_files = sorted([
        os.path.join(TARGET_DIR, f) 
        for f in os.listdir(TARGET_DIR) 
        if not f.startswith(".") and f.lower().endswith((".jpg", ".jpeg", ".png"))
    ])

    already_done = get_already_ingested_files()
    to_process = [f for f in all_files if os.path.basename(f) not in already_done]

    total_target = len(all_files)
    total_remaining = len(to_process)

    print("=" * 75)
    print("AMERICAN STAFFORDSHIRE TERRIER FULL BATCH INGESTION PIPELINE")
    print("=" * 75)
    print(f"Target Directory:      {TARGET_DIR}")
    print(f"Total Pages in Breed:  {total_target} sheets")
    print(f"Already Ingested:      {len(already_done)} sheets (Skipping)")
    print(f"Sheets to Ingest:      {total_remaining} sheets")
    print("=" * 75)

    success_count = 0
    error_count = 0
    errors_log = []
    total_dogs_batch = 0

    start_time = time.time()

    for idx, fpath in enumerate(to_process, 1):
        bname = os.path.basename(fpath)
        progress = f"[{idx}/{total_remaining}]"
        print(f"{progress} Processing {bname}...", end=" ", flush=True)

        try:
            page = process_page(fpath)
            ingest_batch_dogs(page.dogs, source_file=bname)
            success_count += 1
            total_dogs_batch += len(page.dogs)
            print(f"DONE (+{len(page.dogs)} dogs)")
            # Small pace pause to keep comfortably within rate limits
            time.sleep(1.0)
        except Exception as e:
            error_count += 1
            err_msg = f"{bname}: {str(e)}"
            errors_log.append(err_msg)
            print(f"FAILED -> {e}")

    elapsed = time.time() - start_time

    # Final Database Audit
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM dogs;")
            total_db_dogs = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM dogs WHERE is_stub = FALSE;")
            full_pups = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM dogs WHERE is_stub = TRUE;")
            stubs = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM people;")
            total_people = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM dog_people;")
            total_dp = cur.fetchone()[0]
    finally:
        conn.close()

    print("\n" + "=" * 75)
    print("BATCH INGESTION COMPLETE REPORT")
    print("=" * 75)
    print(f"Time Elapsed:              {elapsed:.1f} seconds ({elapsed/60:.2f} minutes)")
    print(f"Successfully Processed:    {success_count} sheets")
    print(f"Failed Sheets:             {error_count} sheets")
    print(f"Dogs Extracted in Run:     {total_dogs_batch} records")
    print("-" * 75)
    print(f"TOTAL RELATIONAL DATABASE STATUS:")
    print(f"  • Total Dogs in Database:         {total_db_dogs:,}")
    print(f"    - Full Ingested Pups:           {full_pups:,}")
    print(f"    - Auto-Created Parent Stubs:    {stubs:,}")
    print(f"  • Normalized Breeders & Owners:   {total_people:,}")
    print(f"  • Verified Dog-People Links:      {total_dp:,}")
    print("=" * 75)

    if errors_log:
        print("\nERRORS ENCOUNTERED:")
        for err in errors_log[:10]:
            print(f"  [-] {err}")
        if len(errors_log) > 10:
            print(f"  ... and {len(errors_log) - 10} more.")

if __name__ == "__main__":
    run_batch()
