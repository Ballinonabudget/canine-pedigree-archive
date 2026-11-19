"""
Phase 0 · Step 7 — People and kennels.

1. "X/OWNER" as breeder means the breeder also owns the dog: X becomes breeder AND owner.
2. The literal person "OWNER" means "same as the other column": as breeder -> the dog's owners are also
   its breeders; as owner -> its breeders are also its owners. Then "OWNER" is removed.
   OCR date fragments recorded as people ("11-84") are removed. (Only people rows/links; no dogs.)
3. Co-owners are split on & , AND, /, :, ;  with care for shared surnames:
   "D & J SERDY" -> D SERDY + J SERDY;  "H SHEALY/J MASTERS" -> H SHEALY + J MASTERS.
   Couples written with a title ("MR. & MRS. M. KIRBY") and pairs without any surname
   ("NAOMI & HAROLD") stay as one entry.
4. people.kind = 'kennel' when the name says KENNEL(S)/FARM(S)/ACRES, else 'person'.
   people.initials_only = true for names like "J SMITH": they are never auto-merged, and the person page
   can show "This name may refer to more than one person."
Logged to phase0_changes (step '070'). Re-runnable.

Usage: python scripts/migrations/070_step7_people.py [--apply]
"""
import re

from lib import ensure_audit_table, log_change, run_step

STEP = "070"
HONORIFIC = re.compile(r"^(MR|MRS|MS|MISS|DR|REV|CAPT|COL|MAJ|LT|GEN|SGT)\.?$")
DATE_FRAG = r"^[0-9 /.\-]+$"
KENNEL = r"\m(KENNELS?|FARMS?|ACRES|CATTERY)\M"


def tokens(s):
    return s.replace(".", ". ").split()


def has_surname(part):
    t = tokens(part)
    t = [x for x in t if not HONORIFIC.match(x.rstrip("."))]
    return len(t) >= 2 and not t[-1].endswith(".") and len(t[-1]) > 1


def split_name(name):
    """-> list of individual names (one element = no split)."""
    n = re.sub(r"\s+", " ", name.strip())
    parties = [p.strip() for p in re.split(r"\s*[/;:]\s*", n) if p.strip()]
    out = []
    for party in parties:
        parts = [p.strip(" ,") for p in re.split(r"\s*&\s*|\s+AND\s+", party) if p.strip(" ,")]
        if len(parts) == 1:
            out.append(parts[0])
            continue
        if all(HONORIFIC.match(t.rstrip(".")) for t in tokens(parts[0])):
            out.append(party)                       # MR. & MRS. M. KIRBY
            continue
        last = parts[-1]
        if not has_surname(last):
            out.append(party)                       # NAOMI & HAROLD
            continue
        surname = tokens(last)[-1]
        for p in parts[:-1]:
            out.append(p if has_surname(p) else f"{p} {surname}")
        out.append(last)
    return [re.sub(r"\s+", " ", o).strip() for o in out if o.strip()]


def body(cur, report):
    ensure_audit_table(cur)
    cur.execute("alter table people add column if not exists kind varchar(8) not null default 'person'")
    cur.execute("alter table people add column if not exists initials_only boolean not null default false")

    def person_id(name):
        cur.execute("insert into people (full_name) values (%s) on conflict (full_name) do update set full_name = excluded.full_name returning id", (name,))
        return cur.fetchone()[0]

    def link(dog, pid, role):
        cur.execute("insert into dog_people (dog_reg, person_id, role) values (%s,%s,%s) on conflict do nothing", (dog, pid, role))
        return cur.rowcount

    # 2. literal OWNER
    cur.execute("select id from people where full_name = 'OWNER'")
    r = cur.fetchone()
    copied = 0
    if r:
        owner_id = r[0]
        for role, other in (("B", "O"), ("O", "B")):
            cur.execute("""insert into dog_people (dog_reg, person_id, role)
                           select dp.dog_reg, x.person_id, %s from dog_people dp
                           join dog_people x on x.dog_reg = dp.dog_reg and x.role = %s and x.person_id <> %s
                           where dp.person_id = %s and dp.role = %s on conflict do nothing""", (role, other, owner_id, owner_id, role))
            copied += cur.rowcount
        cur.execute("select count(*) from dog_people where person_id = %s", (owner_id,))
        report["'OWNER' links resolved"] = cur.fetchone()[0]
        cur.execute("delete from dog_people where person_id = %s", (owner_id,))
        cur.execute("delete from people where id = %s", (owner_id,))
        log_change(cur, STEP, "people", str(owner_id), "*", "OWNER", None, "literal OWNER resolved and removed")
    else:
        report["'OWNER' links resolved"] = 0
    report["  links copied (breeder<->owner)"] = copied

    cur.execute(f"select id, full_name from people where full_name ~ %s", (DATE_FRAG,))
    frags = cur.fetchall()
    for pid, name in frags:
        cur.execute("delete from dog_people where person_id = %s", (pid,))
        cur.execute("delete from people where id = %s", (pid,))
        log_change(cur, STEP, "people", str(pid), "*", name, None, "OCR date fragment, not a person")
    report["date-fragment 'people' removed"] = len(frags)
    report["  examples"] = [f[1] for f in frags[:3]]

    # 1 + 3. /OWNER and co-owner splits
    cur.execute("select id, full_name from people where full_name ~ '(&| AND |/|:|;)' order by id")
    splits, owner_suffix, ex_split = 0, 0, []
    for pid, name in cur.fetchall():
        parts = re.split(r"\s*/\s*OWNER\s*$", name)
        also_owner = len(parts) > 1
        base = parts[0]
        names = split_name(base) if base else []
        if names == [name]:
            continue
        cur.execute("select dog_reg, role from dog_people where person_id = %s", (pid,))
        links = cur.fetchall()
        new_ids = [person_id(n) for n in names]
        for dog, role in links:
            for nid in new_ids:
                link(dog, nid, role)
                if also_owner and role == "B":
                    link(dog, nid, "O")
        cur.execute("delete from dog_people where person_id = %s and not (person_id = any(%s))", (pid, new_ids))
        if pid not in new_ids:
            cur.execute("delete from people where id = %s", (pid,))
        log_change(cur, STEP, "people", str(pid), "full_name", name, " | ".join(names), "split co-owners" + (" + /OWNER" if also_owner else ""))
        owner_suffix += also_owner
        splits += len(names) > 1
        if len(ex_split) < 4 and len(names) > 1:
            ex_split.append((name, names))
    report["names with /OWNER handled"] = owner_suffix
    report["co-owner entries split"] = splits
    report["  examples (before, after)"] = ex_split

    # 4. kind + initials_only
    cur.execute(f"update people set kind = 'kennel' where kind <> 'kennel' and full_name ~ %s", (KENNEL,))
    report["marked as kennel"] = cur.rowcount
    cur.execute(r"""update people set initials_only = true where not initials_only and kind = 'person'
                    and full_name ~ '^([A-Z]\.? ?){1,3} [A-Z''\-]{2,}$'""")
    report["marked initials-only (never auto-merged)"] = cur.rowcount
    cur.execute("delete from people p where not exists (select 1 from dog_people dp where dp.person_id = p.id)")
    report["people with no remaining dogs removed"] = cur.rowcount
    cur.execute("create index if not exists idx_dog_people_person on dog_people (person_id)")
    cur.execute("select count(*) from people")
    report["people now"] = cur.fetchone()[0]


if __name__ == "__main__":
    run_step("070_step7_people", body)
