"""
Phase 0 · Step 8 — Source provenance: which AKC Stud Book issue each entry came from.

Builds stud_book_sheets (one row per scanned sheet) and sets dogs.stud_book_issue (e.g. "August 1981")
plus dogs.stud_book_issue_source, in this order of preference:
  header        the sheet's own date_header, if it reads "Month YYYY", "Month D, YYYY" or "YYYY" AND fits the
                births on that page (issue year >= page's median birth year and <= median + 6)
  interpolated  nearest sheet in the same series (by number) with a usable header, if it fits the births
  pub_date      the row's own "M-YY" stud book publication date (moved there in step 6)
  estimated     "c. YYYY" = latest birth year on the sheet + 1 (shown as approximate)
Fragments like "MAY 13", "September 39" (page numbers) and "JAN. thru JULY" (cumulative index) are not issues.
The public page shows the issue, never the image filename. Re-runnable.

Usage: python scripts/migrations/080_step8_provenance.py [--apply]
"""
import re
import statistics
from collections import Counter, defaultdict

from psycopg2.extras import execute_values

from lib import run_step

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
MIDX = {m[:3].upper(): i for i, m in enumerate(MONTHS, 1)}


def parse_header(h):
    t = (h or "").strip().upper()
    if not t or "THRU" in t:
        return None
    m = re.match(r"^([A-Z]{3})[A-Z]*\.?,?\s+(?:\d{1,2},?\s+)?((?:19|20)\d\d)$", t)
    if m and m.group(1) in MIDX:
        return int(m.group(2)), MIDX[m.group(1)]
    m = re.match(r"^((?:19|20)\d\d)$", t)
    if m:
        return int(m.group(1)), None
    return None


def label(y, m):
    return f"{MONTHS[m - 1]} {y}" if m else str(y)


def fits(issue, years):
    if not years:
        return True
    med = statistics.median(years)
    return med <= issue[0] <= med + 6


def body(cur, report):
    cur.execute("""create table if not exists stud_book_sheets (sheet text primary key, series text, seq int, header_raw text,
                   issue_year smallint, issue_month smallint, issue_label text, source varchar(12))""")
    cur.execute("alter table dogs add column if not exists stud_book_issue varchar(32)")
    cur.execute("alter table dogs add column if not exists stud_book_issue_source varchar(12)")
    cur.execute("select distinct sheet, sheet_seq, date_header from raw_entries")
    sheets = {}
    for sheet, seq, hdr in cur.fetchall():
        series = re.split(r"[ \d]", sheet, maxsplit=1)[0]
        sheets[sheet] = {"series": series, "seq": seq or 0, "hdr": hdr}
    cur.execute("select source_file, birth_year from dogs where birth_year is not null and not is_stub")
    births = defaultdict(list)
    for sf, y in cur.fetchall():
        births[sf].append(y)

    rejected = []
    for s, d in sheets.items():
        p = parse_header(d["hdr"])
        if p and not fits(p, births.get(s)):
            rejected.append((s, d["hdr"], f"page births median {statistics.median(births[s])}"))
            p = None
        d["issue"], d["source"] = (p, "header") if p else (None, None)
    by_series = defaultdict(list)
    for s, d in sheets.items():
        by_series[d["series"]].append((d["seq"], s))
    for series, lst in by_series.items():
        lst.sort()
        for i, (seq, s) in enumerate(lst):
            d = sheets[s]
            if d["issue"]:
                continue
            for dist in range(1, 6):
                cands = [lst[j][1] for j in (i - dist, i + dist) if 0 <= j < len(lst)]
                ok = [sheets[c]["issue"] for c in cands if sheets[c]["source"] == "header" and fits(sheets[c]["issue"], births.get(s))]
                if ok:
                    d["issue"], d["source"] = ok[0], "interpolated"
                    break
    rows = [(s, d["series"], d["seq"], d["hdr"], *(d["issue"] or (None, None)),
             label(*d["issue"]) if d["issue"] else None, d["source"]) for s, d in sheets.items()]
    cur.execute("truncate stud_book_sheets")
    execute_values(cur, "insert into stud_book_sheets values %s", rows)
    c = Counter(d["source"] for d in sheets.values())
    report["sheets: header / interpolated / none"] = f"{c['header']} / {c['interpolated']} / {c[None]}"
    report["headers rejected (don't fit page births)"] = len(rejected)
    report["  examples"] = rejected[:3]

    # one rule, in priority order: own sheet header > own row's publication date > interpolated > estimated
    cur.execute("""
        with mx as (select source_file, max(birth_year) y from dogs where not is_stub group by 1),
        pick as (
          select d.reg_number,
            case when s.source = 'header' then s.issue_label
                 when d.stud_book_pub_date is not null then to_char(to_date(d.stud_book_pub_date, 'YYYY-MM'), 'FMMonth YYYY')
                 when s.source = 'interpolated' then s.issue_label
                 when mx.y is not null then 'c. ' || (mx.y + 1) end as issue,
            case when s.source = 'header' then 'header'
                 when d.stud_book_pub_date is not null then 'pub_date'
                 when s.source = 'interpolated' then 'interpolated'
                 when mx.y is not null then 'estimated' end as src
          from dogs d left join stud_book_sheets s on s.sheet = d.source_file left join mx on mx.source_file = d.source_file
          where not d.is_stub)
        update dogs d set stud_book_issue = pick.issue, stud_book_issue_source = pick.src from pick
        where pick.reg_number = d.reg_number
          and (d.stud_book_issue, d.stud_book_issue_source) is distinct from (pick.issue, pick.src)""")
    report["entries whose issue was set/changed"] = cur.rowcount
    cur.execute("""select stud_book_issue_source, count(*) from dogs where not is_stub and breed_slug = 'amstaff' group by 1 order by 2 desc""")
    report["AmStaff entries by source"] = dict((k or "none", v) for k, v in cur.fetchall())
    cur.execute("""select reg_number, name, source_file, stud_book_issue, stud_book_issue_source from dogs
                   where breed_slug = 'amstaff' and not is_stub and stud_book_issue is not null order by random() limit 3""")
    report["examples"] = cur.fetchall()
    cur.execute("select reg_number, name, source_file, birth_date from dogs where breed_slug='amstaff' and not is_stub and stud_book_issue is null limit 5")
    report["AmStaff entries still without issue"] = cur.fetchall()


if __name__ == "__main__":
    run_step("080_step8_provenance", body)
