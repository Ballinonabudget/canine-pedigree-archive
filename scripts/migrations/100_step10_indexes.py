"""
Phase 0 · Step 10 — Indexes for the UI queries.

  dog_people(person_id)            person pages            (created in step 7, ensured here)
  trigram on aka_names             forgiving name search   (via an IMMUTABLE wrapper so it can be indexed)
  dogs(breed_slug), dogs(birth_year), dogs(breed_slug, birth_year)   breed home, browse by decade
Re-runnable (IF NOT EXISTS).

Usage: python scripts/migrations/100_step10_indexes.py [--apply]
"""
from lib import run_step


def body(cur, report):
    cur.execute("""create or replace function aka_text(text[]) returns text language sql immutable parallel safe
                   as $$ select array_to_string($1, ' ') $$""")
    idx = {
        "idx_dog_people_person": "create index if not exists idx_dog_people_person on dog_people (person_id)",
        "idx_dogs_aka_names_trgm": "create index if not exists idx_dogs_aka_names_trgm on dogs using gin (aka_text(aka_names) gin_trgm_ops)",
        "idx_dogs_breed_slug": "create index if not exists idx_dogs_breed_slug on dogs (breed_slug)",
        "idx_dogs_birth_year": "create index if not exists idx_dogs_birth_year on dogs (birth_year)",
        "idx_dogs_breed_year": "create index if not exists idx_dogs_breed_year on dogs (breed_slug, birth_year)",
    }
    cur.execute("select indexname from pg_indexes where schemaname = 'public'")
    have = {r[0] for r in cur.fetchall()}
    for name, sql in idx.items():
        cur.execute(sql)
    report["indexes created"] = [n for n in idx if n not in have]
    report["already present"] = [n for n in idx if n in have]
    cur.execute("analyze dogs; analyze dog_people; analyze people")


if __name__ == "__main__":
    run_step("100_step10_indexes", body)
