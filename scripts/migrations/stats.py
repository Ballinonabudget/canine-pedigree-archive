"""
Phase 0 depth + error stats. Read-only. Re-run after every migration step.

Usage:  python scripts/migrations/stats.py [--json out.json]

Reports for AmStaff (incl. historical "Staffordshire Terrier") and for the whole DB:
  - dog counts (full stud book entries vs parent stubs)
  - self-loops, sire == dam, placeholder parent regs, cycles
  - cross-breed parent links, "born before parent" pairs, bad sex codes
  - pedigree depth / completeness
  - Phase 0 exit-criteria checklist (spec §3)
Works before and after the schema changes: new columns are used if present.
"""
import json
import sys

from lib import connect, has_column

AMSTAFF_RAW = (
    "American Staffordshire Terrier", "American Staffordshire Terriers",
    "Staffordshire Terrier", "Staffordshire Terriers",
)

PLACEHOLDER_RE = r"^(NULL|NONE|B|D|\(B\)|\(D\)|UNKNOWN.*|0{4,}.*)$"

# Breed label normalisation used only for comparison before step 3 adds breed_slug.
TEMP_FUNCS = r"""
create or replace function pg_temp.norm_breed(b text) returns text language sql immutable as $$
  select case
    when b ilike '%staffordshire terrier%' and b not ilike 'bull%' then 'amstaff'
    else regexp_replace(regexp_replace(lower(b), '(ies)$', 'y'), '(s)$', '')
  end $$;
create or replace function pg_temp.parse_year(d text) returns int language sql immutable as $$
  select case
    when d ~ '(18|19|20)\d\d' then substring(d from '((?:18|19|20)\d\d)')::int
    when d ~ '^\s*\d{1,2}-\d{1,2}-\d{2}\s*$' then 1900 + right(trim(d), 2)::int
    else null end $$;
"""


def year_sql(conn, alias):
    if has_column(conn, "dogs", "birth_year"):
        return f"{alias}.birth_year"
    return f"pg_temp.parse_year({alias}.birth_date)"


def gather(conn):
    cur = conn.cursor()
    cur.execute(TEMP_FUNCS)
    slug = has_column(conn, "dogs", "breed_slug")

    def bk(a):  # comparable breed key for alias a
        return f"{a}.breed_slug" if slug else f"pg_temp.norm_breed({a}.breed)"

    def amstaff(a="dogs"):
        return f"{a}.breed_slug = 'amstaff'" if slug else f"{a}.breed in {AMSTAFF_RAW!r}"

    amstaff_pred = amstaff()
    out = {}

    def one(sql, args=None):
        cur.execute(sql, args)
        return cur.fetchone()[0]

    for scope, P in (("amstaff", amstaff), ("all", lambda a="dogs": "true")):
        pred = P()
        s = {}
        s["dogs"] = one(f"select count(*) from dogs where {pred}")
        s["full_entries"] = one(f"select count(*) from dogs where {pred} and not is_stub")
        s["parent_stubs"] = one(f"select count(*) from dogs where {pred} and is_stub")
        s["self_loops"] = one(f"select count(*) from dogs where {pred} and (sire_reg = reg_number or dam_reg = reg_number)")
        s["sire_equals_dam"] = one(f"select count(*) from dogs where {pred} and sire_reg = dam_reg")
        s["placeholder_parent_refs"] = one(
            f"select count(*) from dogs where {pred} and (upper(sire_reg) ~ %s or upper(dam_reg) ~ %s)",
            (PLACEHOLDER_RE, PLACEHOLDER_RE))
        s["placeholder_dog_regs"] = one(f"select count(*) from dogs where {pred} and upper(reg_number) ~ %s", (PLACEHOLDER_RE,))
        s["bad_sex_codes"] = one(f"select count(*) from dogs where {pred} and sex not in ('D','B','U')")
        s["cross_breed_parent_links"] = one(f"""
            select count(*) from dogs c join dogs p on p.reg_number in (c.sire_reg, c.dam_reg)
            where {P('c')} and {bk('c')} is distinct from {bk('p')}""")
        s["born_before_parent"] = one(f"""
            select count(*) from dogs c join dogs p on p.reg_number in (c.sire_reg, c.dam_reg)
            where {P('c')} and {year_sql(conn, 'c')} < {year_sql(conn, 'p')}""")
        s["cycles"] = one(f"""
            with recursive walk(start, cur, depth, path) as (
              select reg_number, reg_number, 0, array[reg_number::text] from dogs where {pred}
              union all
              select w.start, p.reg_number, w.depth + 1, w.path || p.reg_number::text
              from walk w join dogs d on d.reg_number = w.cur
              join dogs p on p.reg_number in (d.sire_reg, d.dam_reg)
              where w.depth < 30 and not (p.reg_number::text = any(w.path[2:]))
                and p.reg_number <> d.reg_number
            )
            select count(distinct start) from walk where depth > 0 and cur = start""")
        # depth: for full entries, how many generations back are fully / partly known
        cur.execute(f"""
            with recursive anc(root, reg, gen) as (
              select reg_number, reg_number, 0 from dogs where {pred} and not is_stub
              union
              select a.root, p.reg_number, a.gen + 1
              from anc a join dogs d on d.reg_number = a.reg
              join dogs p on p.reg_number in (d.sire_reg, d.dam_reg) and p.reg_number <> d.reg_number
              where a.gen < 5
            ), per as (
              select root, max(gen) maxgen, count(*) filter (where gen between 1 and 5) known5
              from anc group by root
            )
            select round(avg(maxgen)::numeric, 2),
                   round(100.0 * avg(known5) / 62, 1),
                   count(*) filter (where maxgen = 0),
                   count(*) filter (where maxgen >= 3),
                   count(*) filter (where maxgen >= 5)
            from per""")
        r = cur.fetchone()
        s["depth_avg_max_gen_(cap5)"] = float(r[0] or 0)
        s["depth_pct_known_in_5_gens"] = float(r[1] or 0)
        s["depth_no_parents_known"] = r[2]
        s["depth_reaches_gen3"] = r[3]
        s["depth_reaches_gen5"] = r[4]
        out[scope] = s

    a = out["amstaff"]
    has_slug = has_column(conn, "dogs", "breed_slug")
    has_issue = has_column(conn, "dogs", "stud_book_issue")
    missing_slug = one(f"select count(*) from dogs where {amstaff_pred} and breed_slug is null") if has_slug else a["dogs"]
    missing_issue = one(f"select count(*) from dogs where {amstaff_pred} and not is_stub and stud_book_issue is null") if has_issue else a["full_entries"]
    out["exit_criteria_amstaff"] = {
        "zero self-loops": a["self_loops"] == 0,
        "zero cycles": a["cycles"] == 0,
        "zero cross-breed parent links": a["cross_breed_parent_links"] == 0,
        "under 10 born-before-parent pairs": a["born_before_parent"] < 10,
        f"every dog has breed_slug (missing {missing_slug})": missing_slug == 0,
        f"every stud book entry has stud_book_issue (missing {missing_issue})": missing_issue == 0,
    }
    return out


def render(stats):
    keys = list(stats["amstaff"].keys())
    w = max(map(len, keys))
    lines = [f"{'metric':<{w}}  {'amstaff':>9}  {'all':>9}"]
    for k in keys:
        lines.append(f"{k:<{w}}  {stats['amstaff'][k]:>9}  {stats['all'][k]:>9}")
    lines.append("")
    lines.append("Phase 0 exit criteria (AmStaff):")
    for k, ok in stats["exit_criteria_amstaff"].items():
        lines.append(f"  [{'x' if ok else ' '}] {k}")
    return "\n".join(lines)


if __name__ == "__main__":
    with connect() as conn:
        st = gather(conn)
        conn.rollback()
    print(render(st))
    if "--json" in sys.argv:
        json.dump(st, open(sys.argv[sys.argv.index("--json") + 1], "w"), indent=2)
