"""
scripts/ingest.py - High-speed relational upsert engine for dogs, people, and pedigree links.
Handles parent stubbing to resolve multi-generation foreign key dependencies without errors.
"""

import os
import psycopg2
from psycopg2.extras import execute_values
from typing import List, Optional
from dotenv import load_dotenv
from models import DogRecord, HistoricalArticleRecord

load_dotenv(".env.local")
load_dotenv(".env")

DEFAULT_DB_URL = "postgresql://daplug@localhost:5432/canine_pedigree_archive"

def get_db_connection(db_url: Optional[str] = None):
    url = db_url or os.getenv("DATABASE_URL") or DEFAULT_DB_URL
    return psycopg2.connect(url)

def clean_reg(reg: Optional[str]) -> Optional[str]:
    if not reg:
        return None
    cleaned = reg.strip().replace(" ", "").replace("*", "")
    return cleaned if len(cleaned) >= 3 else None

def ingest_dog_record(cursor, dog: DogRecord, source_file: str):
    pup_reg = clean_reg(dog.reg_number)
    if not pup_reg:
        return

    sire_reg = clean_reg(dog.sire_reg)
    dam_reg = clean_reg(dog.dam_reg)

    # 1. Parent Stub Upsert: Sire
    if sire_reg:
        sire_name = dog.sire_name.strip() if dog.sire_name else f"SIRE OF {pup_reg}"
        cursor.execute(
            """
            INSERT INTO dogs (reg_number, name, sex, breed, is_stub, source_file)
            VALUES (%s, %s, 'D', %s, TRUE, %s)
            ON CONFLICT (reg_number) DO NOTHING
            """,
            (sire_reg, sire_name, dog.breed, source_file)
        )

    # 2. Parent Stub Upsert: Dam
    if dam_reg:
        dam_name = dog.dam_name.strip() if dog.dam_name else f"DAM OF {pup_reg}"
        cursor.execute(
            """
            INSERT INTO dogs (reg_number, name, sex, breed, is_stub, source_file)
            VALUES (%s, %s, 'B', %s, TRUE, %s)
            ON CONFLICT (reg_number) DO NOTHING
            """,
            (dam_reg, dam_name, dog.breed, source_file)
        )

    # 3. Pup Ingestion: Upsert full record (is_stub = FALSE)
    cursor.execute(
        """
        INSERT INTO dogs (
            reg_number, name, titles, sex, birth_date, color_code,
            breed, sire_reg, dam_reg, is_stub, source_file
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE, %s)
        ON CONFLICT (reg_number) DO UPDATE SET
            name = EXCLUDED.name,
            titles = COALESCE(EXCLUDED.titles, dogs.titles),
            sex = CASE WHEN EXCLUDED.sex != 'U' THEN EXCLUDED.sex ELSE dogs.sex END,
            birth_date = COALESCE(EXCLUDED.birth_date, dogs.birth_date),
            color_code = COALESCE(EXCLUDED.color_code, dogs.color_code),
            breed = EXCLUDED.breed,
            sire_reg = COALESCE(EXCLUDED.sire_reg, dogs.sire_reg),
            dam_reg = COALESCE(EXCLUDED.dam_reg, dogs.dam_reg),
            is_stub = FALSE,
            source_file = EXCLUDED.source_file
        """,
        (
            pup_reg, dog.name.strip(), dog.titles, dog.sex, dog.birth_date,
            dog.color_code, dog.breed, sire_reg, dam_reg, source_file
        )
    )

    # 4. Ingest Breeders and Owners
    for breeder_name in dog.breeders:
        b_name = breeder_name.strip().upper()
        if len(b_name) < 2: continue
        cursor.execute(
            "INSERT INTO people (full_name) VALUES (%s) ON CONFLICT (full_name) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id",
            (b_name,)
        )
        person_id = cursor.fetchone()[0]
        cursor.execute(
            "INSERT INTO dog_people (dog_reg, person_id, role) VALUES (%s, %s, 'B') ON CONFLICT DO NOTHING",
            (pup_reg, person_id)
        )

    for owner_name in dog.owners:
        o_name = owner_name.strip().upper()
        if len(o_name) < 2: continue
        cursor.execute(
            "INSERT INTO people (full_name) VALUES (%s) ON CONFLICT (full_name) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id",
            (o_name,)
        )
        person_id = cursor.fetchone()[0]
        cursor.execute(
            "INSERT INTO dog_people (dog_reg, person_id, role) VALUES (%s, %s, 'O') ON CONFLICT DO NOTHING",
            (pup_reg, person_id)
        )

def ingest_batch_dogs(dogs: List[DogRecord], source_file: str, db_url: Optional[str] = None):
    conn = get_db_connection(db_url)
    try:
        with conn.cursor() as cur:
            for dog in dogs:
                ingest_dog_record(cur, dog, source_file)
        conn.commit()
    finally:
        conn.close()

def ingest_article(article: HistoricalArticleRecord, db_url: Optional[str] = None) -> int:
    conn = get_db_connection(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO historical_articles (title, breed, publication_era, summary_rewrite, mentioned_dogs, source_image_url)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    article.title.strip(),
                    article.breed.strip(),
                    article.publication_era,
                    article.summary_rewrite,
                    article.mentioned_dogs,
                    article.source_image_url
                )
            )
            article_id = cur.fetchone()[0]
        conn.commit()
        return article_id
    finally:
        conn.close()
