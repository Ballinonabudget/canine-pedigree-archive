"""
Phase 0 · Step 2 — Canonicalize registration numbers and merge duplicate rows.

1. Canonical form: uppercase, keep only A–Z 0–9 /. A trailing "/NN" (1990s) moves to litter_code.
   A title glued to the reg ("W80097C.D.") is split off into titles; trailing OCR junk is dropped.
   The original text is kept in reg_raw.
2. Placeholder IDs are never merged. Stud book entries with a placeholder ID (page indexes like 45.1,
   000063, UNKNOWN_2, names, dates) get UNREG_<SHEET>_<ROW>. Parent stubs with a placeholder ID are
   left for step 4, which rebuilds them as named UNREG stubs.
3. Rows that share a canonical reg are merged with these winner rules:
   - full stud book entry beats a parent stub
   - between full entries: prefer M-D-YY birth dates, then parents that resolve to real dogs,
     then more filled fields
   - names unrelated AND sex disagrees  =>  OCR collision, NOT merged: the extra dog keeps
     <reg>/<suffix> or <reg>-X<n> and both are flagged reg_conflict. Parent links into a collided
     reg go to the dog whose sex matches (sire -> D, dam -> B).
   Losing rows' extra facts fill the winner's empty fields, their names go to aka_names, their
   owners/breeders move to the winner. The losing duplicate row is then removed (no dog is lost).
Every rename/merge is logged to phase0_changes (step '020'). Re-runnable: a second run is a no-op.

Usage: python scripts/migrations/020_step2_canonical_regs.py [--apply]
"""
import re
from collections import defaultdict

from psycopg2.extras import execute_values

from lib import ensure_audit_table, run_step

STEP = "020"
STD = re.compile(r"^([A-Z]{1,3}\d{3,}|\d{4,})(?:/(\d{1,3}))?$")
REG_TITLE = re.compile(r"^([A-Z]{1,3}\d{3,})(CDX|CD|UDT|UD|TD)$")
REG_JUNK = re.compile(r"^([A-Z]{1,3}\d{4,})[^0-9].*$")
TITLE_WORDS = re.compile(r"^((INT|AM|CAN|GR|ICH|DUAL|MEX)\s*)*(CH|CHAMPION)\.?\s+", re.I)
MDY = re.compile(r"^\d{1,2}-\d{1,2}-\d{2}$")


def canon(reg):
    return re.sub(r"[^A-Z0-9/]", "", (reg or "").upper())


def classify(reg):
    """-> (base, litter_code, extra_title) or None for placeholder IDs."""
    if reg.startswith("UNREG"):
        return None
    c = canon(reg)
    m = STD.match(c)
    if m:
        return m.group(1), m.group(2), None
    m = REG_TITLE.match(c)
    if m:
        return m.group(1), None, m.group(2)
    m = REG_JUNK.match(c.replace("/", "~"))
    if m:
        return m.group(1), None, None
    return None


def clean_name(n):
    n = TITLE_WORDS.sub("", (n or "").upper())
    return re.sub(r"[^A-Z0-9 ]", "", n).strip()


def related(cur, a, b):
    na, nb = clean_name(a), clean_name(b)
    if not na or not nb or na in nb or nb in na or na.startswith(("SIRE OF", "DAM OF")) or nb.startswith(("SIRE OF", "DAM OF")):
        return True
    cur.execute("select similarity(%s, %s)", (na, nb))
    return cur.fetchone()[0] >= 0.35


def sex_agrees(a, b):
    return a not in ("D", "B") or b not in ("D", "B") or a == b


MONTHS = {m: i for i, m in enumerate(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], 1)}


def parse_date(t):
    """-> (year, month, day|None) or None. Handles M-D-YY, M-YY, 'Month D, YYYY'."""
    t = (t or "").strip().upper()
    m = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{2})$", t)
    if m:
        return (1900 + int(m.group(3)), int(m.group(1)), int(m.group(2)))
    m = re.match(r"^(\d{1,2})-(\d{2})$", t)
    if m:
        return (1900 + int(m.group(2)), int(m.group(1)), None)
    m = re.match(r"^([A-Z]{3})[A-Z]*\.?\s+(\d{1,2}),?\s+(\d{4})$", t)
    if m and m.group(1) in MONTHS:
        return (int(m.group(3)), MONTHS[m.group(1)], int(m.group(2)))
    return None


def dates_agree(a, b):
    da, db = parse_date(a), parse_date(b)
    if not da or not db:
        return True
    return da[0] == db[0] and da[1] == db[1] and (da[2] is None or db[2] is None or abs(da[2] - db[2]) <= 3)


def same_dog(cur, w, d):
    """Merge rule. Names unrelated AND (sex disagrees, or both full entries with different birth dates) => collision."""
    if related(cur, w["name"], d["name"]):
        return True
    if not sex_agrees(w["sex"], d["sex"]):
        return False
    if not w["is_stub"] and not d["is_stub"]:
        # two complete-looking names that share nothing are two dogs; a clipped OCR name ("RINE") is not
        if min(len(clean_name(w["name"])), len(clean_name(d["name"]))) >= 8:
            return False
        return dates_agree(w["birth_date"], d["birth_date"])
    return True


def sheet_code(source_file):
    m = re.match(r"([A-Za-z]+)\D*?(\d+)", source_file or "")
    return (m.group(1).upper() + m.group(2)) if m else "X"


def body(cur, report):
    ensure_audit_table(cur)
    for col, typ in (("reg_raw", "varchar(64)"), ("litter_code", "varchar(8)"), ("aka_names", "text[] not null default '{}'"),
                     ("reg_conflict", "boolean not null default false")):
        cur.execute(f"alter table dogs add column if not exists {col} {typ}")
    cur.execute("update dogs set reg_raw = reg_number where reg_raw is null")

    cur.execute("""select reg_number, name, titles, sex, birth_date, color_code, breed, sire_reg, dam_reg, is_stub,
                          source_file, litter_code, aka_names, reg_conflict from dogs""")
    cols = [d[0] for d in cur.description]
    dogs = {r[0]: dict(zip(cols, r)) for r in cur.fetchall()}
    exists = set(dogs)

    def score(d):
        resolved = sum(1 for p in (d["sire_reg"], d["dam_reg"]) if p and p in exists)
        filled = sum(1 for k in ("titles", "birth_date", "color_code", "sire_reg", "dam_reg") if d[k])
        return (not d["is_stub"], bool(MDY.match(d["birth_date"] or "")), resolved, filled, d["reg_number"] == canon(d["reg_number"]))

    groups, new_key, extra_title, litter = defaultdict(list), {}, {}, {}
    placeholder_full, placeholder_stub = [], 0
    for reg, d in dogs.items():
        if d["reg_conflict"]:
            continue  # already settled as an OCR collision by an earlier run
        c = classify(reg)
        if c is None:
            if reg.startswith("UNREG"):
                continue
            if d["is_stub"]:
                placeholder_stub += 1
            else:
                placeholder_full.append(reg)
            continue
        base, lc, title = c
        groups[base].append(reg)
        if lc:
            litter[reg] = lc
        if title:
            extra_title[reg] = title

    # Placeholder stud book entries -> UNREG_<SHEET>_<ROW>
    used = set(dogs)
    for reg in sorted(placeholder_full):
        d = dogs[reg]
        cur.execute("""select row_idx from raw_entries where sheet = %s and reg_number = %s
                       order by similarity(upper(name), upper(%s)) desc limit 1""", (d["source_file"], reg, d["name"]))
        r = cur.fetchone()
        key = f"UNREG_{sheet_code(d['source_file'])}_{r[0] if r else 'X'}"
        n = 2
        while key in used:
            key = f"UNREG_{sheet_code(d['source_file'])}_{r[0] if r else 'X'}_{n}"
            n += 1
        used.add(key)
        new_key[reg] = key

    merges, conflicts, by_base_sex = [], [], {}
    conflict_examples, merge_examples = [], []
    for base, regs in groups.items():
        rows = sorted((dogs[r] for r in regs), key=score, reverse=True)
        clusters = []  # each: [winner, *losers]
        for d in rows:
            for cl in clusters:
                w = cl[0]
                if same_dog(cur, w, d):
                    cl.append(d)
                    break
            else:
                clusters.append([d])
        for i, cl in enumerate(clusters):
            w = cl[0]
            if i == 0:
                key = base
            else:
                lc = litter.get(w["reg_number"])
                key = f"{base}/{lc}" if lc and (f"{base}/{lc}" not in used or f"{base}/{lc}" == canon(w["reg_number"])) else f"{base}-X{i}"
            used.add(key)
            for d in cl:
                new_key[d["reg_number"]] = key
            if len(cl) > 1:
                merges.append((key, w["reg_number"], [d["reg_number"] for d in cl[1:]]))
                if len(merge_examples) < 3 and not all(x["is_stub"] for x in cl):
                    merge_examples.append((key, [(x["reg_number"], x["name"], "stub" if x["is_stub"] else "full", x["birth_date"]) for x in cl]))
            if len(clusters) > 1:
                by_base_sex[(base, w["sex"])] = key
        if len(clusters) > 1:
            conflicts.append(base)
            if len(conflict_examples) < 3:
                conflict_examples.append([(cl[0]["reg_number"], cl[0]["name"], cl[0]["sex"], new_key[cl[0]["reg_number"]]) for cl in clusters])

    renames = {o: n for o, n in new_key.items() if o != n}
    losers = {}
    for key, wreg, lregs in merges:
        for l in lregs:
            losers[l] = wreg

    report["placeholder stud book entries -> UNREG_ ids"] = len(placeholder_full)
    report["placeholder parent stubs left for step 4"] = placeholder_stub
    report["regs renamed to canonical form"] = sum(1 for o in renames if o not in losers)
    report["litter_code split off"] = len(litter)
    report["titles split off reg"] = len(extra_title)
    report["duplicate groups merged"] = len(merges)
    report["duplicate rows folded into a winner"] = len(losers)
    report["  of which full entries folded"] = sum(1 for l in losers if not dogs[l]["is_stub"])
    report["OCR collisions kept apart (reg_conflict)"] = len(conflicts)
    report["merge examples (key, rows)"] = merge_examples
    report["collision examples (reg, name, sex, new key)"] = conflict_examples
    risky = []
    for key, wreg, lregs in merges:
        for l in lregs:
            if not dogs[l]["is_stub"] and not dogs[wreg]["is_stub"]:
                cur.execute("select similarity(%s, %s)", (clean_name(dogs[wreg]["name"]), clean_name(dogs[l]["name"])))
                sim = cur.fetchone()[0]
                if sim < 0.5:
                    risky.append((key, dogs[wreg]["name"], dogs[wreg]["sex"], dogs[wreg]["birth_date"], dogs[l]["name"], dogs[l]["sex"], dogs[l]["birth_date"], round(sim, 2)))
    report["full+full merges with dissimilar names"] = len(risky)
    report["  examples"] = risky[:12]
    report["UNREG examples"] = [(r, dogs[r]["name"], new_key[r]) for r in sorted(placeholder_full)[:3]]

    if not renames:
        return

    # --- apply -------------------------------------------------------------------------------
    cur.execute("alter table dogs drop constraint if exists dogs_sire_reg_fkey")
    cur.execute("alter table dogs drop constraint if exists dogs_dam_reg_fkey")
    cur.execute("alter table dog_people drop constraint if exists dog_people_dog_reg_fkey")
    cur.execute("create temp table regmap (old text primary key, new text not null) on commit drop")
    execute_values(cur, "insert into regmap values %s", list(new_key.items()))

    # Winner absorbs losers' facts and names.
    for key, wreg, lregs in merges:
        w = dogs[wreg]
        aka = set(w["aka_names"] or [])
        for l in lregs:
            d = dogs[l]
            if d["name"] and clean_name(d["name"]) != clean_name(w["name"]) and not d["name"].upper().startswith(("SIRE OF", "DAM OF")):
                aka.add(d["name"])
            for f in ("titles", "birth_date", "color_code", "sire_reg", "dam_reg"):
                if not w[f] and d[f]:
                    w[f] = d[f]
            if w["sex"] not in ("D", "B") and d["sex"] in ("D", "B"):
                w["sex"] = d["sex"]
        cur.execute("""update dogs set titles=%s, birth_date=%s, color_code=%s, sire_reg=%s, dam_reg=%s, sex=%s, aka_names=%s
                       where reg_number=%s""",
                    (w["titles"], w["birth_date"], w["color_code"], w["sire_reg"], w["dam_reg"], w["sex"], sorted(aka), wreg))
        cur.execute("""insert into phase0_changes (step, tbl, key, col, old_value, new_value, reason)
                       select %s, 'dogs', %s, 'merged_row', reg_number, %s,
                              row_to_json(dogs)::text from dogs where reg_number = any(%s)""",
                    (STEP, key, wreg, lregs))

    # owners/breeders follow the dog
    cur.execute("""insert into dog_people (dog_reg, person_id, role)
                   select m.new, dp.person_id, dp.role from dog_people dp join regmap m on m.old = dp.dog_reg
                   on conflict do nothing""")
    cur.execute("delete from dog_people dp using regmap m where m.old = dp.dog_reg and m.old <> m.new")

    if losers:
        cur.execute("delete from dogs where reg_number = any(%s)", (list(losers),))
    for reg, title in extra_title.items():
        if reg not in losers:
            cur.execute("update dogs set titles = trim(both ' ' from coalesce(titles, '') || ' ' || %s) where reg_number = %s", (title, reg))
    for reg, lc in litter.items():
        if reg not in losers:
            cur.execute("update dogs set litter_code = %s where reg_number = %s", (lc, reg))
    cur.execute("""insert into phase0_changes (step, tbl, key, col, old_value, new_value, reason)
                   select %s, 'dogs', m.new, 'reg_number', m.old, m.new, 'canonical reg' from regmap m
                   join dogs d on d.reg_number = m.old where m.old <> m.new""", (STEP,))
    # two-phase rename so swaps inside a group never hit the primary key
    cur.execute("update dogs d set reg_number = '~' || m.old from regmap m where d.reg_number = m.old and m.old <> m.new")
    cur.execute("update dogs d set reg_number = m.new from regmap m where d.reg_number = '~' || m.old and m.old <> m.new")
    # conflicted rows
    cur.execute("update dogs set reg_conflict = true where reg_number = any(%s) or split_part(split_part(reg_number,'/',1),'-X',1) = any(%s)",
                (conflicts, conflicts))

    # parent links: follow the map; into a collided reg, pick the dog whose sex fits the side
    for side, sex in (("sire", "D"), ("dam", "B")):
        cur.execute(f"update dogs d set {side}_reg = m.new from regmap m where d.{side}_reg = m.old and m.old <> m.new")
        for (base, s), key in by_base_sex.items():
            if s == sex and key != base:
                cur.execute(f"update dogs set {side}_reg = %s where {side}_reg = %s", (key, base))

    cur.execute("alter table dogs add constraint dogs_sire_reg_fkey foreign key (sire_reg) references dogs(reg_number)")
    cur.execute("alter table dogs add constraint dogs_dam_reg_fkey foreign key (dam_reg) references dogs(reg_number)")
    cur.execute("alter table dog_people add constraint dog_people_dog_reg_fkey foreign key (dog_reg) references dogs(reg_number) on delete cascade")

    cur.execute("select count(*) from dogs")
    report["dog rows after"] = cur.fetchone()[0]
    cur.execute("select count(*) from dogs where sire_reg = reg_number or dam_reg = reg_number or sire_reg = dam_reg")
    report["self-loops / sire=dam created by merging (fixed by re-running step 1)"] = cur.fetchone()[0]


if __name__ == "__main__":
    run_step("020_step2_canonical_regs", body)
