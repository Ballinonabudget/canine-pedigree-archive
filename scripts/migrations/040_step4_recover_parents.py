"""
Phase 0 · Step 4 — Recover dropped parents.

a) Ingest the 1987 AmStaff Yearbook dogs (Astaff peds 188–204) that collided on reg "UNKNOWN":
   each becomes a stud book entry UNREG_<SHEET>_<ROW> with its breeders/owners.
b) Parent stubs whose ID is a placeholder (left by step 2: 'null', '10-94', a name) are re-keyed to the
   shared form UNREG:<BREED_SLUG>:<NORMALIZED_NAME> (merged if that key already exists).
c) For every stud book row whose sire/dam link is empty, use the recorded parent name:
   - a registration number written inside the name ("Lord Kirk A732446") -> link to that dog,
     creating a parent stub if the reg is new;
   - otherwise create/reuse a shared stub UNREG:<BREED_SLUG>:<NORMALIZED_NAME>, so siblings
     share one parent node.
   Links that steps 1/3 deliberately cleared are not re-added. A recovered link is skipped (and counted)
   if it would point at the dog itself, a dog of another breed, or create a cycle.
Logged to phase0_changes (step '040'). Re-runnable.

Usage: python scripts/migrations/040_step4_recover_parents.py [--apply]
"""
import importlib.util
import os
import re

from lib import ensure_audit_table, log_change, run_step

STEP = "040"
_spec = importlib.util.spec_from_file_location("s2", os.path.join(os.path.dirname(__file__), "020_step2_canonical_regs.py"))
s2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s2)

REG_IN_NAME = re.compile(r"\b([A-Z]{1,3})[- ]?(\d{1,3}(?:,\d{3})+|\d{4,})(?:/(\d{1,3}))?\b", re.I)
TITLE_TOKENS = re.compile(r"\b(INT|AM|CAN|GR|ICH|DUAL|CH|CHAMPION|C\.?D\.?X?|U\.?D\.?T?|T\.?D\.?)\b\.?", re.I)
JUNK_NAMES = re.compile(r"^(UNKNOWN|UNREGISTERED|UNREG|NONE|NULL|N/?A|NOT (GIVEN|LISTED)|-+|\?+)$", re.I)
YEARBOOK = re.compile(r"^Astaff peds (18[89]|19\d|20[0-4])\.", re.I)


def norm_name(n):
    n = TITLE_TOKENS.sub(" ", (n or "").upper())
    n = re.sub(r"\([^)]*\)", " ", n)          # (England), (Ger.)
    n = re.sub(r"[^A-Z0-9 ]", "", n.replace("-", " "))
    return re.sub(r"\s+", " ", n).strip()


def display_name(n):
    return re.sub(r"\s+", " ", (n or "").strip())[:180]


def body(cur, report):
    ensure_audit_table(cur)
    cur.execute("select reg_number, name, breed_slug, breed, is_stub, sire_reg, dam_reg, sex from dogs")
    dogs = {r[0]: dict(zip(("reg", "name", "slug", "breed", "stub", "sire", "dam", "sex"), r)) for r in cur.fetchall()}
    bases = {}
    for reg in dogs:
        c = s2.classify(reg.split("-X")[0]) if not reg.startswith("UNREG") else None
        if c:
            bases.setdefault(c[0], []).append(reg)
    cur.execute("select key, col from phase0_changes where step in ('010','030') and new_value is null and col in ('sire_reg','dam_reg')")
    cleared = set(cur.fetchall())
    breed_name = {}
    cur.execute("select slug, name from breeds")
    breed_name.update(cur.fetchall())

    def add_dog(reg, name, slug, sex, stub, source, reason, **extra):
        cur.execute("""insert into dogs (reg_number, name, sex, breed, breed_slug, breed_raw, is_stub, source_file, reg_raw,
                                         birth_date, color_code, titles)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict (reg_number) do nothing""",
                    (reg, display_name(name), sex, breed_name[slug], slug, extra.get("breed_raw"), stub, source, extra.get("reg_raw"),
                     extra.get("birth_date"), extra.get("color_code"), extra.get("titles")))
        if cur.rowcount:
            dogs[reg] = {"reg": reg, "name": display_name(name), "slug": slug, "breed": breed_name[slug], "stub": stub,
                         "sire": None, "dam": None, "sex": sex}
            log_change(cur, STEP, "dogs", reg, "*", None, name, reason)
            return True
        return False

    # a) yearbook dogs
    cur.execute("""select sheet, sheet_seq, row_idx, name, titles, sex, birth_date, color_code, sire_name, dam_name, breeders, owners
                   from raw_entries where sheet ~* '^Astaff peds (18[89]|19[0-9]|20[0-4])\\.' order by sheet_seq, row_idx""")
    yb_new, yb_ex = 0, []
    for sheet, seq, row, name, titles, sex, bd, color, sn, dn, breeders, owners in cur.fetchall():
        key = f"UNREG_ASTAFF{seq}_{row}"
        if key in dogs or not name:
            continue
        sx = (sex or "U")[:1].upper()
        if add_dog(key, name, "amstaff", sx if sx in "DB" else "U", False, sheet, "1987 yearbook dog (collided on UNKNOWN)",
                   birth_date=bd, color_code=color, titles=titles, breed_raw="American Staffordshire Terrier", reg_raw="UNKNOWN"):
            yb_new += 1
            if len(yb_ex) < 3:
                yb_ex.append((key, name, sn, dn))
            for role, people in (("B", breeders or []), ("O", owners or [])):
                for p in people:
                    p = p.strip().upper()
                    if len(p) < 2:
                        continue
                    cur.execute("insert into people (full_name) values (%s) on conflict (full_name) do update set full_name = excluded.full_name returning id", (p,))
                    cur.execute("insert into dog_people (dog_reg, person_id, role) values (%s,%s,%s) on conflict do nothing", (key, cur.fetchone()[0], role))
    report["a) 1987 yearbook dogs ingested"] = yb_new
    report["a) examples (key, name, sire, dam)"] = yb_ex

    # b) placeholder parent stubs -> UNREG:<slug>:<NAME>
    rekey, rk_ex = 0, []
    for reg, d in list(dogs.items()):
        if not d["stub"] or reg.startswith("UNREG") or s2.classify(reg.split("-X")[0]):
            continue
        nn = norm_name(d["name"])
        if not nn:
            continue
        key = f"UNREG:{d['slug'].upper()}:{nn}"[:48]
        if key == reg:
            continue
        if key not in dogs:
            add_dog(key, d["name"], d["slug"], d["sex"], True, None, f"re-key of placeholder stub {reg}", reg_raw=reg)
        for side in ("sire", "dam"):
            cur.execute(f"update dogs set {side}_reg = %s where {side}_reg = %s returning reg_number", (key, reg))
            for (child,) in cur.fetchall():
                dogs[child][side] = key
                log_change(cur, STEP, "dogs", child, f"{side}_reg", reg, key, "placeholder stub re-keyed")
        cur.execute("update dog_people set dog_reg = %s where dog_reg = %s and not exists (select 1 from dog_people x where x.dog_reg = %s and x.person_id = dog_people.person_id and x.role = dog_people.role)", (key, reg, key))
        cur.execute("delete from dog_people where dog_reg = %s", (reg,))
        cur.execute("insert into phase0_changes (step, tbl, key, col, old_value, new_value, reason) select %s,'dogs',%s,'merged_row',reg_number,%s,row_to_json(dogs)::text from dogs where reg_number=%s", (STEP, key, key, reg))
        cur.execute("delete from dogs where reg_number = %s", (reg,))
        del dogs[reg]
        rekey += 1
        if len(rk_ex) < 3:
            rk_ex.append((reg, d["name"], key))
    report["b) placeholder stubs re-keyed to UNREG:<BREED>:<NAME>"] = rekey
    report["b) examples"] = rk_ex

    # c) recover parents from recorded names
    def ancestors(reg, limit=40):
        seen, stack = set(), [reg]
        while stack and len(seen) < 5000:
            r = stack.pop()
            d = dogs.get(r)
            if not d:
                continue
            for p in (d["sire"], d["dam"]):
                if p and p not in seen:
                    seen.add(p)
                    stack.append(p)
        return seen

    def dog_for_raw(sheet, seq, row, reg, name):
        c = s2.classify(reg or "") if reg else None
        if c:
            cands = bases.get(c[0], [])
        else:
            cands = [k for k in (f"UNREG_{s2.sheet_code(sheet)}_{row}", f"UNREG_ASTAFF{seq}_{row}") if k in dogs]
        cands = [k for k in cands if k in dogs and not dogs[k]["stub"]] or [k for k in cands if k in dogs]
        if len(cands) <= 1:
            return cands[0] if cands else None
        cur.execute("select k, similarity(upper(n), upper(%s)) s from unnest(%s::text[], %s::text[]) u(k, n) order by s desc limit 1",
                    (name, cands, [dogs[k]["name"] for k in cands]))
        return cur.fetchone()[0]

    stats = {"reg found in name": 0, "named UNREG stub": 0, "stubs created": 0,
             "skipped: cleared earlier": 0, "skipped: other breed": 0, "skipped: self/cycle": 0}
    ex_reg, ex_unreg = [], []
    cur.execute("""select sheet, sheet_seq, row_idx, reg_number, name, sire_name, sire_reg, dam_name, dam_reg from raw_entries
                   where (coalesce(sire_reg,'') = '' and coalesce(sire_name,'') <> '')
                      or (coalesce(dam_reg,'') = '' and coalesce(dam_name,'') <> '') order by id""")
    for sheet, seq, row, reg, name, sname, sreg, dname, dreg in cur.fetchall():
        child = dog_for_raw(sheet, seq, row, reg, name)
        if not child:
            continue
        for side, pname, preg, sex in (("sire", sname, sreg, "D"), ("dam", dname, dreg, "B")):
            if (preg or "").strip() or not (pname or "").strip() or dogs[child][side]:
                continue
            if (child, f"{side}_reg") in cleared:
                stats["skipped: cleared earlier"] += 1
                continue
            slug = dogs[child]["slug"]
            m = REG_IN_NAME.search(pname)
            c = s2.classify(m.group(0)) if m else None
            if c:
                target = c[0]
                clean = display_name(REG_IN_NAME.sub("", pname).strip(" ,;()"))
                if target not in dogs:
                    alts = [k for k in bases.get(target, []) if dogs.get(k, {}).get("sex") == sex]
                    target = alts[0] if alts else target
                if target not in dogs:
                    if add_dog(target, clean or f"{side.upper()} OF {child}", slug, sex, True, sheet, "parent reg found in name", reg_raw=m.group(0)):
                        stats["stubs created"] += 1
                        bases.setdefault(target, []).append(target)
                kind = "reg found in name"
            else:
                nn = norm_name(pname)
                if not nn or JUNK_NAMES.match(nn) or len(nn) < 3:
                    continue
                target = f"UNREG:{slug.upper()}:{nn}"[:48]
                if target not in dogs and add_dog(target, pname, slug, sex, True, sheet, "unregistered named parent"):
                    stats["stubs created"] += 1
                kind = "named UNREG stub"
            if target == child or child in ancestors(target):
                stats["skipped: self/cycle"] += 1
                continue
            if dogs[target]["slug"] != slug:
                stats["skipped: other breed"] += 1
                continue
            cur.execute(f"update dogs set {side}_reg = %s where reg_number = %s and {side}_reg is null", (target, child))
            if cur.rowcount:
                dogs[child][side] = target
                log_change(cur, STEP, "dogs", child, f"{side}_reg", None, target, kind)
                stats[kind] += 1
                exl = ex_reg if kind == "reg found in name" else ex_unreg
                if len(exl) < 3:
                    exl.append((child, dogs[child]["name"], side, pname, target))
    for k, v in stats.items():
        report[f"c) {k}"] = v
    report["c) examples: reg found in name"] = ex_reg
    report["c) examples: shared UNREG stubs"] = ex_unreg
    cur.execute("select count(*), count(*) filter (where breed_slug='amstaff') from dogs where reg_number like 'UNREG:%'")
    report["shared UNREG stubs now (all / amstaff)"] = cur.fetchone()


if __name__ == "__main__":
    run_step("040_step4_recover_parents", body)
