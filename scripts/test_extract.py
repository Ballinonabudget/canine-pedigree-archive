"""
scripts/test_extract.py - Test extraction validator on 3 Stud Book sheets + 2 Historical Articles.
Auto-rotates scans upright, extracts structured JSON using Gemini 2.5 Flash,
and ingests into PostgreSQL with parent stubbing.
"""

import os
import sys
import json
from dotenv import load_dotenv
from PIL import Image

# Load environment
load_dotenv(".env.local")
load_dotenv(".env")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("[ERROR] GEMINI_API_KEY is not set in .env.local!")
    print("Please run:")
    print("  echo 'GEMINI_API_KEY=\"your_key_here\"' > \".env.local\"")
    print("  echo 'DATABASE_URL=\"postgresql://daplug@localhost:5432/canine_pedigree_archive\"' >> \".env.local\"")
    sys.exit(1)

from google import genai
from google.genai import types
from preprocess import preprocess_image
from models import StudBookPage, HistoricalArticleRecord
from ingest import ingest_batch_dogs, ingest_article, get_db_connection

client = genai.Client(api_key=api_key)

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

HISTORICAL_ARTICLE_PROMPT = """
You are an expert canine historian and technical journalist.
Read this historical periodical page / magazine article / archival letter.
Synthesize a comprehensive, non-copyright-infringing journalistic summary that captures:
1. Title or Headline of the article
2. Publication era or date
3. Key kennels, foundation dogs, and breeders mentioned
4. Important historical facts (e.g., first registrations, physical conformation, show wins, historical lineages)
Extract all dog names or registration numbers mentioned into the mentioned_dogs array.
"""

def extract_stud_book_page(image_path: str) -> StudBookPage:
    print(f"\n[1/3 Preprocessing] {os.path.basename(image_path)}...")
    upright_im, rot = preprocess_image(image_path, max_dim=2200)
    print(f"      Applied auto-rotation: {rot}° | Size: {upright_im.size}")

    print(f"[2/3 Gemini 2.5 Flash Extraction] Calling API...")
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
    print(f"[3/3 Success] Extracted {len(page_record.dogs)} dogs (Breed: {page_record.breed})")
    return page_record

def extract_article(image_path: str) -> HistoricalArticleRecord:
    print(f"\n[1/3 Preprocessing Article] {os.path.basename(image_path)}...")
    upright_im, rot = preprocess_image(image_path, max_dim=2200)
    print(f"      Applied auto-rotation: {rot}° | Size: {upright_im.size}")

    print(f"[2/3 Gemini 2.5 Flash Extraction] Calling API...")
    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=[upright_im, HISTORICAL_ARTICLE_PROMPT],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=HistoricalArticleRecord.model_json_schema(),
            temperature=0.2
        )
    )
    data = json.loads(response.text)
    data["source_image_url"] = os.path.basename(image_path)
    article_record = HistoricalArticleRecord.model_validate(data)
    print(f"[3/3 Success] Article: '{article_record.title}' (Mentioned dogs: {len(article_record.mentioned_dogs)})")
    return article_record

def run_test():
    stud_book_samples = [
        "/Volumes/Sam Tsung/Dog Ped stuff/American Staffordshire Terrier/Astaff peds 1.JPG",
        "/Volumes/Sam Tsung/Dog Ped stuff/American Staffordshire Terrier/Astaff peds 10.JPG",
        "/Volumes/Sam Tsung/Dog Ped stuff/American Staffordshire Terrier/Astaff peds 100.JPG"
    ]

    article_samples = [
        "/Volumes/Sam Tsung/Dog Ped stuff/Pedigrees/Amstaff pedigrees/PTDC0416.JPG", # 1936 AKC Letter
        "/Volumes/Sam Tsung/Dog Ped stuff/Pedigrees/Amstaff pedigrees/PTDC0700.JPG"  # White Rock Jet Bomber
    ]

    print("=" * 70)
    print("PHASE 4: TEST EXTRACTION VALIDATOR (3 Stud Book Sheets + 2 Articles)")
    print("=" * 70)

    # 1. Stud Book Extractions & Database Ingestion
    total_dogs = 0
    for sheet_path in stud_book_samples:
        if not os.path.exists(sheet_path):
            print(f"[SKIP] Missing: {sheet_path}")
            continue
        page = extract_stud_book_page(sheet_path)
        ingest_batch_dogs(page.dogs, source_file=os.path.basename(sheet_path))
        total_dogs += len(page.dogs)

    # 2. Historical Article Extractions & Database Ingestion
    for art_path in article_samples:
        if not os.path.exists(art_path):
            print(f"[SKIP] Missing: {art_path}")
            continue
        art = extract_article(art_path)
        art_id = ingest_article(art)
        print(f"      Ingested article ID: {art_id}")

    # 3. Database Verification & Stats
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM dogs;")
            db_dog_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM dogs WHERE is_stub = FALSE;")
            db_pup_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM dogs WHERE is_stub = TRUE;")
            db_stub_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM people;")
            db_people_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM dog_people;")
            db_dp_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM historical_articles;")
            db_art_count = cur.fetchone()[0]

            print("\n" + "=" * 70)
            print("POSTGRESQL INGESTION AUDIT VERIFICATION")
            print("=" * 70)
            print(f"  Total Dogs in Database:       {db_dog_count}")
            print(f"    - Full Pup Rows (Ingested): {db_pup_count}")
            print(f"    - Auto-Stitched Parent Stubs: {db_stub_count}")
            print(f"  Total People (Breeders/Owners): {db_people_count}")
            print(f"  Total Dog-People Relationships: {db_dp_count}")
            print(f"  Historical Articles Ingested:  {db_art_count}")

            # Sample Multi-Generation Pedigree Tree from DB
            cur.execute("""
                SELECT d.reg_number, d.name, s.name as sire, m.name as dam
                FROM dogs d
                LEFT JOIN dogs s ON d.sire_reg = s.reg_number
                LEFT JOIN dogs m ON d.dam_reg = m.reg_number
                WHERE d.is_stub = FALSE AND d.sire_reg IS NOT NULL
                LIMIT 5;
            """)
            rows = cur.fetchall()
            print("\nSample Stitched Pedigree Links:")
            for r in rows:
                print(f"  [{r[0]}] {r[1]}")
                print(f"       ├── Sire: {r[2]}")
                print(f"       └── Dam:  {r[3]}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_test()
