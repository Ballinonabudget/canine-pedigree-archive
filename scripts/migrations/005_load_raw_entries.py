"""
Phase 0 · prep — Load every extracted stud book row into raw_entries (lossless staging).

The original ingest dropped information (sire/dam names when a reg existed, date headers, row order,
rows that collided on the same reg). Later steps use raw_entries as evidence. This step does not touch
dogs/people. Re-runnable: rebuilds raw_entries from scripts/extracted_cache/*.json each time.

Usage: python scripts/migrations/005_load_raw_entries.py [--apply]
"""
import glob
import json
import os
import re

from psycopg2.extras import execute_values

from lib import run_step

CACHE = os.path.join(os.path.dirname(__file__), "..", "extracted_cache")


def sheet_sort_key(name):
    m = re.match(r"(.*?)(\d+)\D*$", name)
    return (m.group(1), int(m.group(2))) if m else (name, 0)


def body(cur, report):
    cur.execute("""create table if not exists raw_entries (
        id serial primary key, sheet text not null, sheet_seq int, row_idx int not null,
        page_breed text, date_header text, reg_number text, name text, titles text, sex text,
        birth_date text, color_code text, breed text, sire_name text, sire_reg text,
        dam_name text, dam_reg text, breeders text[], owners text[],
        unique (sheet, row_idx))""")
    cur.execute("truncate raw_entries restart identity")
    files = sorted(glob.glob(os.path.join(CACHE, "*.json")), key=lambda f: sheet_sort_key(os.path.basename(f)))
    rows, sheets_by_prefix = [], {}
    for f in files:
        sheet = os.path.basename(f)[:-len(".json")]
        prefix, num = sheet_sort_key(sheet.replace(".JPG", "").replace(".jpg", ""))
        data = json.load(open(f))
        if not isinstance(data, dict):
            continue
        for i, d in enumerate(data.get("dogs") or []):
            rows.append((sheet, num, i, data.get("breed"), data.get("date_header"), d.get("reg_number"), d.get("name"),
                         d.get("titles"), d.get("sex"), d.get("birth_date"), d.get("color_code"), d.get("breed"),
                         d.get("sire_name"), d.get("sire_reg"), d.get("dam_name"), d.get("dam_reg"),
                         d.get("breeders") or [], d.get("owners") or []))
    execute_values(cur, """insert into raw_entries (sheet, sheet_seq, row_idx, page_breed, date_header, reg_number, name,
        titles, sex, birth_date, color_code, breed, sire_name, sire_reg, dam_name, dam_reg, breeders, owners) values %s""",
                   rows, page_size=2000)
    cur.execute("create index if not exists idx_raw_entries_reg on raw_entries (upper(regexp_replace(reg_number, '[^A-Za-z0-9/]', '', 'g')))")
    report["json files"] = len(files)
    report["rows loaded"] = len(rows)
    cur.execute("select count(distinct sheet) filter (where date_header is not null), count(distinct sheet) from raw_entries")
    report["sheets with date_header / sheets with rows"] = "%s / %s" % cur.fetchone()


if __name__ == "__main__":
    run_step("005_load_raw_entries", body)
