"""
Phase 0 · Step 6 — Structured dates and sex fixes.

Dates: adds birth_year, birth_month, birth_day, date_precision ('full' | 'month' | 'year') parsed from the
recorded birth_date text (kept as is). Formats: M-D-YY, M-D-YYYY, "Month D, YYYY", "Mon. D, YYYY",
"Month YYYY", YYYY. A bare "M-YY" is the stud book publication month, not a birth date (spec §3 step 6):
it moves to stud_book_pub_date (YYYY-MM) and the birth fields stay empty.
Sex: codes other than D/B/U (OCR noise like 8, N, O) are fixed from, in order: the same dog's other stud
book rows, how offspring list it (sire -> D, dam -> B), otherwise 'U'.
Logged to phase0_changes (step '060'). Re-runnable.

Usage: python scripts/migrations/060_step6_dates_and_sex.py [--apply]
"""
import re

from psycopg2.extras import execute_values

from lib import ensure_audit_table, run_step

STEP = "060"
MONTHS = {m: i for i, m in enumerate(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], 1)}


def yy(s):
    y = int(s)
    return y if y >= 100 else 1900 + y


def parse(t):
    """-> (year, month, day, precision, pub_date)"""
    t = (t or "").strip().upper().replace("SEPT", "SEP")
    if not t:
        return (None,) * 5
    m = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$", t)
    if m and 1 <= int(m.group(1)) <= 12 and 1 <= int(m.group(2)) <= 31:
        return yy(m.group(3)), int(m.group(1)), int(m.group(2)), "full", None
    m = re.match(r"^(\d{1,2})[-/](\d{2})$", t)
    if m and 1 <= int(m.group(1)) <= 12:
        return None, None, None, None, f"{yy(m.group(2))}-{int(m.group(1)):02d}"
    m = re.match(r"^([A-Z]{3})[A-Z]*\.?\s+(\d{1,2}),?\s+(\d{4})$", t)
    if m and m.group(1) in MONTHS:
        return int(m.group(3)), MONTHS[m.group(1)], int(m.group(2)), "full", None
    m = re.match(r"^([A-Z]{3})[A-Z]*\.?,?\s+(\d{4})$", t)
    if m and m.group(1) in MONTHS:
        return int(m.group(2)), MONTHS[m.group(1)], None, "month", None
    m = re.match(r"^((?:18|19|20)\d\d)$", t)
    if m:
        return int(m.group(1)), None, None, "year", None
    return (None,) * 5


def body(cur, report):
    ensure_audit_table(cur)
    for col, typ in (("birth_year", "smallint"), ("birth_month", "smallint"), ("birth_day", "smallint"),
                     ("date_precision", "varchar(8)"), ("stud_book_pub_date", "varchar(7)")):
        cur.execute(f"alter table dogs add column if not exists {col} {typ}")
    cur.execute("select reg_number, birth_date, birth_year, birth_month, birth_day, date_precision, stud_book_pub_date from dogs")
    rows, unparsed, counts, ex = [], [], {"full": 0, "month": 0, "year": 0, "pub": 0}, {}
    for reg, bd, *current in cur.fetchall():
        if current[3] == "disputed":
            continue  # set by the born-before-parent check below on an earlier run
        p = parse(bd)
        if bd and p == (None,) * 5:
            unparsed.append((reg, bd))
        if p[3]:
            counts[p[3]] += 1
            ex.setdefault(p[3], (reg, bd, p[:4]))
        if p[4]:
            counts["pub"] += 1
            ex.setdefault("pub", (reg, bd, "stud_book_pub_date=" + p[4]))
        if list(p) != current:
            rows.append((reg, *p))
    report["birth dates: full / month / year precision"] = f"{counts['full']} / {counts['month']} / {counts['year']}"
    report["M-YY publication dates moved to stud_book_pub_date"] = counts["pub"]
    report["date text not understood (left as text only)"] = len(unparsed)
    report["examples"] = [ex[k] for k in ("full", "year", "pub") if k in ex]
    report["unparsed examples"] = unparsed[:3]
    report["dogs with date fields changed"] = len(rows)
    if rows:
        cur.execute("create temp table dp (reg text primary key, y smallint, m smallint, d smallint, p text, pub text) on commit drop")
        execute_values(cur, "insert into dp values %s", rows)
        cur.execute("""update dogs set birth_year = dp.y, birth_month = dp.m, birth_day = dp.d, date_precision = dp.p,
                       stud_book_pub_date = dp.pub from dp where dp.reg = dogs.reg_number""")

    # sex
    cur.execute("""
        with bad as (select reg_number, sex, name from dogs where sex not in ('D','B','U')),
        raw_sex as (
          select b.reg_number, max(upper(left(r.sex,1))) filter (where upper(left(r.sex,1)) in ('D','B')) s,
                 count(distinct upper(left(r.sex,1))) filter (where upper(left(r.sex,1)) in ('D','B')) n
          from bad b join raw_entries r on upper(regexp_replace(r.reg_number,'[^A-Za-z0-9/]','','g')) = split_part(b.reg_number,'-X',1)
          group by 1),
        role as (
          select b.reg_number, bool_or(c.sire_reg = b.reg_number) as sire, bool_or(c.dam_reg = b.reg_number) as dam
          from bad b join dogs c on b.reg_number in (c.sire_reg, c.dam_reg) group by 1)
        select b.reg_number, b.sex, b.name,
               case when rs.n = 1 then rs.s
                    when ro.sire and not ro.dam then 'D'
                    when ro.dam and not ro.sire then 'B'
                    else 'U' end,
               case when rs.n = 1 then 'other stud book row'
                    when ro.sire is distinct from ro.dam and (ro.sire or ro.dam) then 'listed as sire/dam'
                    else 'unknown' end
        from bad b left join raw_sex rs using (reg_number) left join role ro using (reg_number)""")
    fixes = cur.fetchall()
    from collections import Counter
    report["bad sex codes fixed"] = len(fixes)
    report["  by source"] = dict(Counter(f[4] for f in fixes))
    report["  examples (reg, old, name, new, source)"] = fixes[:3]
    for reg, old, _n, new, why in fixes:
        cur.execute("update dogs set sex = %s where reg_number = %s", (new, reg))
        cur.execute("insert into phase0_changes (step, tbl, key, col, old_value, new_value, reason) values (%s,'dogs',%s,'sex',%s,%s,%s)",
                    (STEP, reg, old, new, why))

    # born before parent
    pairs_sql = """select c.reg_number, s.side, p.reg_number, p.sex from dogs c cross join (values ('sire'), ('dam')) s(side)
                   join dogs p on p.reg_number = case s.side when 'sire' then c.sire_reg else c.dam_reg end
                   where c.birth_year < p.birth_year"""
    cur.execute(pairs_sql)
    report["born-before-parent pairs before fix"] = cur.rowcount
    # a) parent date contradicted by 2+ offspring -> the parent's date is the wrong value
    cur.execute(f"""select parent, count(*) from ({pairs_sql}) x(child, side, parent, psex) group by parent having count(*) >= 2""")
    disputed = cur.fetchall()
    for parent, n in disputed:
        cur.execute("""update dogs set birth_year = null, birth_month = null, birth_day = null, date_precision = 'disputed'
                       where reg_number = %s returning birth_date""", (parent,))
        bd = cur.fetchone()[0]
        cur.execute("insert into phase0_changes (step, tbl, key, col, old_value, new_value, reason) values (%s,'dogs',%s,'birth_year',%s,null,%s)",
                    (STEP, parent, bd, f"date contradicted by {n} offspring born earlier"))
    report["a) parent birth dates marked disputed (2+ offspring born earlier)"] = len(disputed)
    # b) parent sex contradicts the side it is listed on -> the link is wrong
    cur.execute(pairs_sql)
    wrong = [(c, s, p) for c, s, p, sx in cur.fetchall() if (s == "sire" and sx == "B") or (s == "dam" and sx == "D")]
    for child, side, parent in wrong:
        cur.execute(f"update dogs set {side}_reg = null where reg_number = %s", (child,))
        cur.execute("insert into phase0_changes (step, tbl, key, col, old_value, new_value, reason) values (%s,'dogs',%s,%s,%s,null,%s)",
                    (STEP, child, f"{side}_reg", parent, "born before parent and parent sex contradicts role"))
    report["b) links cleared (born before parent + parent sex contradicts sire/dam role)"] = len(wrong)
    cur.execute(pairs_sql)
    report["born-before-parent pairs left (one date or link wrong, can't tell which)"] = cur.rowcount


if __name__ == "__main__":
    run_step("060_step6_dates_and_sex", body)
