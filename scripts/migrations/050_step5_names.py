"""
Phase 0 · Step 5 — One display name per dog; other spellings in aka_names; titles and country split out.

For each dog, candidate names are: its current name and aka_names, the names on its own stud book rows,
and the names its offspring's rows recorded for it as sire/dam.
Each candidate is cleaned: titles (CH, GR CH, INT CH, CD, CDX, UD...) move to `titles`,
"(England)"/"(Ger.)" move to `country`, a "(B)"/"(D)" sex marker fills `sex` if that is unknown.
Display name: drop junk and clipped names (e.g. "RINE" when "BENZEDRINE" exists) -> prefer the dog's own
stud book entry -> otherwise the most common spelling. Every other spelling goes to aka_names (searchable).
Also cleans `titles` values that were really sex markers ("B", "(D)").
Logged to phase0_changes (step '050'). Re-runnable.

Usage: python scripts/migrations/050_step5_names.py [--apply]
"""
import importlib.util
import os
import re
from difflib import SequenceMatcher
from collections import Counter, defaultdict

from psycopg2.extras import execute_values

from lib import ensure_audit_table, run_step

STEP = "050"
_spec = importlib.util.spec_from_file_location("s2", os.path.join(os.path.dirname(__file__), "020_step2_canonical_regs.py"))
s2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s2)

COUNTRIES = {
    "ENGLAND": "England", "ENG": "England", "UK": "England", "UNITED KINGDOM": "England", "GB": "England",
    "GERMANY": "Germany", "GER": "Germany", "GERMNY": "Germany", "CANADA": "Canada", "CAN": "Canada",
    "ITALY": "Italy", "FRANCE": "France", "AUSTRIA": "Austria", "SWITZ": "Switzerland", "SWITZERLAND": "Switzerland",
    "DENMARK": "Denmark", "AUS": "Australia", "AUSTRAL": "Australia", "AUSTRL": "Australia", "AUSTRALIA": "Australia",
    "BELG": "Belgium", "BELGIUM": "Belgium", "HOLLAND": "Netherlands", "NETHERLANDS": "Netherlands", "IRELAND": "Ireland",
    "SCOTLAND": "Scotland", "BER": "Bermuda", "BERMUDA": "Bermuda", "MEXICO": "Mexico", "MEX": "Mexico",
    "SWEDEN": "Sweden", "NORWAY": "Norway", "FINLAND": "Finland", "CZECH": "Czechoslovakia", "JAPAN": "Japan",
    "SOUTH AFRICA": "South Africa", "NEW ZEALAND": "New Zealand", "NZ": "New Zealand", "CUBA": "Cuba", "BRAZIL": "Brazil",
}
PREFIX_TITLE = re.compile(r"^\s*((?:(?:INT|AM|CAN|MEX|GR|DUAL|BER|ENG|U-?CD)\.?\s*)*(?:CH|ICH|CCH|CHAMPION)\.?,?)\s+", re.I)
SUFFIX_TITLE = re.compile(r"[\s,]+(C\.?\s?D\.?\s?X\.?|C\.?\s?D\.?|U\.?\s?D\.?\s?T\.?|U\.?\s?D\.?|T\.?\s?D\.?|R\.?O\.?M\.?)\s*$", re.I)
SEX_MARK = re.compile(r"\s*\(([BD])\)\s*$", re.I)
PAREN = re.compile(r"\s*\(([^)]{2,20})\)\s*$")
TITLE_ORDER = ["INT CH", "AM CH", "CAN CH", "GR CH", "CH", "CD", "CDX", "UD", "UDT", "TD", "ROM"]


def norm_title(t):
    t = re.sub(r"[.,]", "", t.upper())
    t = re.sub(r"\s+", " ", t).strip()
    t = {"ICH": "INT CH", "CCH": "CAN CH", "CHAMPION": "CH", "C D": "CD", "C D X": "CDX", "U D": "UD", "U D T": "UDT", "T D": "TD"}.get(t, t)
    return t.replace("C D X", "CDX").replace("C D", "CD")


def parse(name):
    """-> (core name, set(titles), country|None, sex|None)"""
    n = (name or "").strip()
    titles, country, sex = set(), None, None
    for _ in range(4):
        m = SEX_MARK.search(n)
        if m:
            sex, n = m.group(1).upper(), n[:m.start()]
            continue
        m = PAREN.search(n)
        if m and re.sub(r"[.\s]+$", "", m.group(1)).upper() in COUNTRIES:
            country, n = COUNTRIES[re.sub(r"[.\s]+$", "", m.group(1)).upper()], n[:m.start()]
            continue
        m = SUFFIX_TITLE.search(n)
        if m:
            titles.add(norm_title(m.group(1)))
            n = n[:m.start()]
            continue
        m = PREFIX_TITLE.match(n)
        if m:
            titles.add(norm_title(m.group(1)))
            n = n[m.end():]
            continue
        break
    return re.sub(r"\s+", " ", n).strip(" ,;"), titles, country, sex


def key(n):
    return re.sub(r"[^A-Z0-9]", "", (n or "").upper())


def junk(core):
    k = key(core)
    return len(k) < 3 or not re.search(r"[A-Z]", k) or k.startswith(("SIREOF", "DAMOF")) or k in ("UNKNOWN", "UNREGISTERED", "NULL")


def related(a, b):
    ka, kb = key(a), key(b)
    if not ka or not kb:
        return False
    short, long_ = sorted((ka, kb), key=len)
    if len(short) >= 5 and short in long_:
        return True
    return SequenceMatcher(None, ka, kb).ratio() >= 0.75


def body(cur, report):
    ensure_audit_table(cur)
    cur.execute("alter table dogs add column if not exists country varchar(32)")
    cur.execute("alter table dogs alter column titles type varchar(120)")
    # Stable inputs: the name before step 5 ever ran, and spellings from rows merged into this dog.
    cur.execute("alter table dogs add column if not exists name_raw varchar(180)")
    cur.execute("""update dogs d set name_raw = coalesce((select c.old_value from phase0_changes c where c.step = %s and c.col = 'name'
                   and c.key = d.reg_number order by c.id limit 1), d.name) where name_raw is null""", (STEP,))
    cur.execute("""select new_value, array_agg(distinct reason::json->>'name') from phase0_changes
                   where step in ('020', '040') and col = 'merged_row' group by new_value""")
    merged_names = dict(cur.fetchall())
    cur.execute("select reg_number, name_raw, aka_names, titles, sex, is_stub, country, name from dogs")
    dogs = {r[0]: dict(zip(("reg", "name", "aka", "titles", "sex", "stub", "country", "current"), r)) for r in cur.fetchall()}
    cur.execute("select reg_number, aka_names from dogs")
    for reg, a in cur.fetchall():
        dogs[reg]["cur_aka"] = a or []
    for reg, d in dogs.items():
        d["aka"] = [n for n in merged_names.get(reg, []) if n]
    bases = defaultdict(list)
    for reg in dogs:
        c = s2.classify(reg.split("-X")[0]) if not reg.startswith("UNREG") else None
        if c:
            bases[c[0]].append(reg)

    own = defaultdict(list)       # names from the dog's own stud book rows
    as_parent = defaultdict(list)  # names offspring rows recorded for it
    cur.execute("select r.sheet, r.reg_number, r.name, r.sire_name, r.dam_name from raw_entries r")
    raw = cur.fetchall()
    cur.execute("select reg_number, sire_reg, dam_reg from dogs")
    links = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
    for sheet, reg, name, sn, dn in raw:
        c = s2.classify(reg or "") if reg else None
        cands = bases.get(c[0], []) if c else []
        if not cands:
            continue
        if len(cands) > 1:
            kn = key(parse(name)[0])
            cands = sorted(cands, key=lambda k: -len(set(key(parse(dogs[k]["name"])[0])) & set(kn)))
        d = cands[0]
        own[d].append(name)
        s, m = links.get(d, (None, None))
        if s and sn:
            as_parent[s].append(sn)
        if m and dn:
            as_parent[m].append(dn)

    updates, ex_rename, ex_title, ex_country = [], [], [], []
    n_rename = n_titles = n_country = n_sex = n_aka = 0
    conflicts = []
    for reg, d in dogs.items():
        anchor = parse(d["name"])[0]
        extra = own.get(reg, []) + as_parent.get(reg, [])
        unrelated = [c for c in extra if c and not junk(parse(c)[0]) and not related(parse(c)[0], anchor)]
        if unrelated:
            conflicts.append((reg, d["name"], sorted(set(unrelated))[:5]))
        cands = [d["name"]] + list(d["aka"] or []) + [c for c in extra if c and c not in unrelated]
        parsed = [(c, *parse(c)) for c in cands if c]
        titles = set()
        for t in re.split(r"[,\s]+(?=(?:CH|CD|CDX|UD|UDT|TD|INT|GR|AM|CAN)\b)", d["titles"] or ""):
            t = norm_title(t.strip("() "))
            if t and t not in ("B", "D", "U"):
                titles.add(t)
        country, sex_hint = d["country"], None
        good = []
        for orig, core, tt, ctry, sx in parsed:
            titles |= tt
            country = country or ctry
            sex_hint = sex_hint or sx
            if not junk(core):
                good.append(core)
        if not good:
            good = [parse(d["name"])[0] or d["name"]]
        keys = {key(g) for g in good}
        clipped = {k for k in keys if any(k != o and k in o and len(o) - len(k) >= 2 for o in keys)}
        usable = [g for g in good if key(g) not in clipped] or good
        own_names = [parse(n)[0] for n in own.get(reg, []) if related(parse(n)[0], anchor)] if not d["stub"] else []
        own_ok = [g for g in own_names if not junk(g) and key(g) not in clipped]
        if own_ok:
            pick_key = Counter(key(g) for g in own_ok).most_common(1)[0][0]
        else:
            pick_key = max(Counter(key(g) for g in usable).items(), key=lambda kv: (kv[1], len(kv[0])))[0]
        renderings = [g for g in (own_ok + usable) if key(g) == pick_key]
        display = Counter(renderings).most_common(1)[0][0][:180]
        aka = sorted({g for g in good if key(g) != key(display)})
        t_str = " ".join(t for t in TITLE_ORDER if t in titles) + "".join(f" {t}" for t in sorted(titles - set(TITLE_ORDER)))
        t_str = t_str.strip() or None
        sex = d["sex"] if d["sex"] in ("D", "B") else (sex_hint or d["sex"])
        cur_aka = sorted(d["cur_aka"]) if "cur_aka" in d else None
        if (display, aka, t_str, country, sex) != (d["current"], cur_aka, d["titles"], d["country"], d["sex"]):
            updates.append((reg, display, aka, t_str, country, sex))
            if display != d["current"]:
                n_rename += 1
                if len(ex_rename) < 3 and key(display) != key(parse(d["name"])[0]):
                    ex_rename.append((reg, d["name"], "->", display, aka[:3]))
            if t_str != d["titles"]:
                n_titles += 1
                if len(ex_title) < 3 and titles and not d["titles"]:
                    ex_title.append((reg, d["name"], t_str))
            if country != d["country"]:
                n_country += 1
                if len(ex_country) < 3:
                    ex_country.append((reg, d["name"], country))
            n_sex += sex != d["sex"]
            n_aka += aka != cur_aka

    report["dogs updated"] = len(updates)
    report["display name changed"] = n_rename
    report["titles set/cleaned"] = n_titles
    report["country set"] = n_country
    report["sex filled from (B)/(D) marker"] = n_sex
    report["aka_names changed"] = n_aka
    report["examples: chosen display name (reg, old, ->, new, aka)"] = ex_rename
    report["examples: titles moved out of name"] = ex_title
    report["examples: country"] = ex_country
    cur.execute("""create table if not exists name_conflicts (reg_number varchar(48) primary key, kept_name text,
                   unrelated_names text[], status varchar(16) not null default 'open')""")
    cur.execute("delete from name_conflicts where status = 'open'")
    execute_values(cur, "insert into name_conflicts (reg_number, kept_name, unrelated_names) values %s on conflict (reg_number) do nothing",
                   conflicts or [("__none__", None, [])])
    cur.execute("delete from name_conflicts where reg_number = '__none__'")
    report["dogs with unrelated names on colliding rows (-> name_conflicts)"] = len(conflicts)
    report["examples: name conflicts (reg, kept, unrelated)"] = conflicts[:3]
    if updates:
        cur.execute("create temp table nm (reg text primary key, name text, aka text[], titles text, country text, sex char(1)) on commit drop")
        execute_values(cur, "insert into nm values %s", updates)
        cur.execute("""insert into phase0_changes (step, tbl, key, col, old_value, new_value, reason)
                       select %s, 'dogs', d.reg_number, 'name', d.name, nm.name, 'display name (name_raw kept)' from dogs d join nm on nm.reg = d.reg_number
                       where d.name is distinct from nm.name""", (STEP,))
        cur.execute("""update dogs d set name = nm.name, aka_names = nm.aka, titles = nm.titles, country = nm.country, sex = nm.sex
                       from nm where nm.reg = d.reg_number""")


if __name__ == "__main__":
    run_step("050_step5_names", body)
