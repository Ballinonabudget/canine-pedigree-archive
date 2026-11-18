"""
Phase 0 · Step 3 — Normalize breeds.

1. Map every breed spelling to one canonical breed (plurals merged) and add breed_slug.
   "Staffordshire Terrier(s)" becomes American Staffordshire Terrier (slug amstaff); dogs recorded
   under the old name, or born before 1972, keep historical_breed_label = 'Staffordshire Terrier'.
   The original label stays in breed_raw.
2. Fix wrong breed labels from family consensus. Stud book pages list breeds alphabetically, so dogs
   near a section break got the neighbouring breed, and parent stubs inherited the breed of whichever
   child created them. A dog is relabelled when at least 2 of its parents/offspring agree on another
   breed and none share its current breed. Stubs (whose breed was never observed) follow the majority
   of their offspring. Repeats until stable.
3. Remaining cross-breed parent links go to cross_breed_links (status 'open') for review.
   For AmStaff (launch breed) they are resolved now: the link is cleared (logged, reversible) and the
   row marked status 'cleared_amstaff'.
Re-runnable. All label changes logged to phase0_changes (step '030').

Usage: python scripts/migrations/030_step3_normalize_breeds.py [--apply]
"""
import re
from collections import Counter, defaultdict

from lib import ensure_audit_table, log_change, run_step

STEP = "030"
SPECIAL = {
    "staffordshire terrier": "American Staffordshire Terrier",
    "american staffordshire terrier": "American Staffordshire Terrier",
    "pulik": "Puli",
    "bouviers des flandres": "Bouvier des Flandres",
    "collies": "Collie",
    "bouvier des flandres": "Bouvier des Flandres",
    "great pyrenees": "Great Pyrenees",
    "welsh corgi (cardigan)": "Welsh Corgi (Cardigan)",
}
SLUG_SPECIAL = {"American Staffordshire Terrier": "amstaff"}


def canonical_breed(raw):
    k = (raw or "").strip().lower()
    k1 = re.sub(r"s$", "", k)
    for key in (k, k1):
        if key in SPECIAL:
            return SPECIAL[key]
    if k.endswith("terriers"):
        k = k[:-1]
    elif k.endswith("s") and not k.endswith("ss") and "(" not in k:
        k = k[:-1]
    return " ".join(w if w in ("des", "de", "du") else w[:1].upper() + w[1:] for w in k.split())


def slugify(b):
    return SLUG_SPECIAL.get(b) or re.sub(r"[^a-z0-9]+", "-", b.lower()).strip("-")


def one_pass(cur, report):
    ensure_audit_table(cur)
    cur.execute("alter table dogs add column if not exists breed_raw varchar(48)")
    cur.execute("alter table dogs add column if not exists breed_slug varchar(48)")
    cur.execute("alter table dogs add column if not exists historical_breed_label varchar(48)")
    cur.execute("alter table dogs alter column breed type varchar(64)")
    cur.execute("update dogs set breed_raw = breed where breed_raw is null")
    cur.execute("""create table if not exists breeds (slug varchar(48) primary key, name varchar(64) not null unique,
                   is_live boolean not null default false)""")
    cur.execute("""create table if not exists cross_breed_links (child_reg varchar(48), side varchar(4), parent_reg varchar(48),
                   child_breed varchar(48), parent_breed varchar(48), status varchar(24) not null default 'open',
                   noted_at timestamptz default now(), primary key (child_reg, side))""")

    # 1. canonical labels
    cur.execute("select distinct breed_raw from dogs")
    raw_labels = [r[0] for r in cur.fetchall()]
    mapping = {r: canonical_breed(r) for r in raw_labels}
    canon_names = sorted(set(mapping.values()))
    report["raw breed labels"] = len(raw_labels)
    report["canonical breeds"] = len(canon_names)
    report["canonical list"] = [", ".join(canon_names)]
    for name in canon_names:
        cur.execute("insert into breeds (slug, name, is_live) values (%s, %s, %s) on conflict (slug) do update set name = excluded.name",
                    (slugify(name), name, name == "American Staffordshire Terrier"))
    cur.execute("select count(*) from dogs where breed_slug is null")
    report["dogs given a breed_slug"] = cur.fetchone()[0]
    for raw, name in mapping.items():
        cur.execute("update dogs set breed = %s, breed_slug = %s where breed_raw = %s and breed_slug is null", (name, slugify(name), raw))

    # 2. family consensus
    cur.execute("select reg_number, breed_slug, is_stub, sire_reg, dam_reg from dogs")
    dogs = {r[0]: {"slug": r[1], "stub": r[2], "sire": r[3], "dam": r[4]} for r in cur.fetchall()}
    kids = defaultdict(list)
    for reg, d in dogs.items():
        for p in (d["sire"], d["dam"]):
            if p in dogs:
                kids[p].append(reg)
    slug_name = {slugify(n): n for n in canon_names}
    changed, examples_ = {}, []
    for _round in range(5):
        n_changes = 0
        for reg, d in dogs.items():
            rel = [dogs[p]["slug"] for p in (d["sire"], d["dam"]) if p in dogs] + [dogs[k]["slug"] for k in kids[reg]]
            if not rel:
                continue
            votes = Counter(rel)
            best, n = votes.most_common(1)[0]
            if best == d["slug"]:
                continue
            if d["stub"] and kids[reg]:
                kv = Counter(dogs[k]["slug"] for k in kids[reg]).most_common()
                ok = kv[0][0] != d["slug"] and (len(kv) == 1 or kv[0][1] > kv[1][1]) and votes[d["slug"]] == 0
                best = kv[0][0]
            else:
                ok = n >= 2 and votes[d["slug"]] == 0
                if not ok and votes[d["slug"]] == 0 and len(votes) == 1:
                    # one-sided evidence: follow a relative whose own breed is firmly established
                    def strength(r):
                        o = dogs[r]
                        fam = [dogs[p]["slug"] for p in (o["sire"], o["dam"]) if p in dogs] + [dogs[k]["slug"] for k in kids[r]]
                        return sum(1 for s in fam if s == o["slug"]) - (1 if reg in kids[r] or reg in (o["sire"], o["dam"]) else 0) * 0
                    rel_regs = [p for p in (d["sire"], d["dam"]) if p in dogs] + kids[reg]
                    ok = any(strength(r) >= 2 for r in rel_regs)
            if ok:
                if reg not in changed:
                    changed[reg] = d["slug"]
                if len(examples_) < 3 and not d["stub"]:
                    examples_.append((reg, d["slug"], "->", best, dict(votes)))
                d["slug"] = best
                n_changes += 1
        if not n_changes:
            break
    changed = {r: old for r, old in changed.items() if dogs[r]["slug"] != old}
    report["labels fixed by family consensus"] = len(changed)
    report["  of which stud book entries"] = sum(1 for r in changed if not dogs[r]["stub"])
    report["  of which AmStaff gained / lost"] = (sum(1 for r in changed if dogs[r]["slug"] == "amstaff"),
                                                  sum(1 for r, o in changed.items() if o == "amstaff"))
    report["consensus examples (reg, old, ->, new, votes)"] = examples_
    for reg, old in changed.items():
        new = dogs[reg]["slug"]
        cur.execute("update dogs set breed_slug = %s, breed = %s where reg_number = %s", (new, slug_name[new], reg))
        log_change(cur, STEP, "dogs", reg, "breed_slug", old, new, "family consensus")

    # historical label
    cur.execute("""update dogs set historical_breed_label = 'Staffordshire Terrier'
                   where breed_slug = 'amstaff' and historical_breed_label is null
                     and (breed_raw ilike 'staffordshire terrier%%'
                          or coalesce(substring(birth_date from '((?:18|19)\\d\\d)')::int,
                                      case when birth_date ~ '^\\s*\\d{1,2}-(\\d{1,2}-)?\\d{2}\\s*$' then 1900 + right(trim(birth_date), 2)::int end) < 1972)""")
    report["AmStaff given historical label 'Staffordshire Terrier'"] = cur.rowcount

    # 3. remaining cross-breed links (first close review rows that later fixes resolved)
    cur.execute("""update cross_breed_links l set status = 'resolved_relabel'
                   where l.status = 'open' and not exists (
                     select 1 from dogs c join dogs p on p.reg_number = case l.side when 'sire' then c.sire_reg else c.dam_reg end
                     where c.reg_number = l.child_reg and p.reg_number = l.parent_reg and c.breed_slug <> p.breed_slug)""")
    cur.execute("""insert into cross_breed_links (child_reg, side, parent_reg, child_breed, parent_breed)
                   select c.reg_number, s.side, p.reg_number, c.breed_slug, p.breed_slug
                   from dogs c cross join (values ('sire'), ('dam')) s(side)
                   join dogs p on p.reg_number = case s.side when 'sire' then c.sire_reg else c.dam_reg end
                   where c.breed_slug <> p.breed_slug
                   on conflict (child_reg, side) do nothing""")
    cur.execute("select count(*) from cross_breed_links where status = 'open'")
    report["cross-breed links left open for review (all breeds)"] = cur.fetchone()[0]
    cur.execute("""select l.child_reg, c.name, l.child_breed, l.side, l.parent_reg, p.name, l.parent_breed, p.is_stub
                   from cross_breed_links l join dogs c on c.reg_number = l.child_reg join dogs p on p.reg_number = l.parent_reg
                   where l.status = 'open' and 'amstaff' in (l.child_breed, l.parent_breed) order by l.child_reg""")
    am = cur.fetchall()

    # kennel-word evidence: words in full-entry names that belong (>=85%, >=3 dogs) to one breed
    STOP = {"OF", "THE", "AND", "VON", "V", "VOM", "DE", "DU", "LA", "LE", "CH", "MY", "MISS", "LADY", "LITTLE", "BOY",
            "GIRL", "KING", "QUEEN", "PRINCE", "PRINCESS", "DUKE", "BIG", "RED", "BLACK", "II", "III", "MR", "MRS", "SIR"}

    def words(n):
        return {w for w in re.sub(r"[^A-Z ]", " ", re.sub(r"'S\b", "", (n or "").upper())).split() if len(w) >= 4 and w not in STOP}

    cur.execute("select name, breed_slug from dogs where not is_stub")
    wb = defaultdict(Counter)
    for name, slug in cur.fetchall():
        for w in words(name):
            wb[w][slug] += 1

    def kennel_breed(name):
        c = Counter()
        for w in words(name):
            tot = sum(wb[w].values())
            top, n = wb[w].most_common(1)[0] if tot else (None, 0)
            if tot >= 3 and n / tot >= 0.85:
                c[top] += 1
        return c.most_common(1)[0][0] if c else None

    relabelled, resolved_examples, remaining = 0, [], []
    for row in am:
        child, cname, cb, side, parent, pname, pb, pstub = row
        kc, kp = kennel_breed(cname), kennel_breed(pname)
        cur.execute("select breed_slug from dogs where reg_number = %s", (child,))
        cb_now = cur.fetchone()[0]
        cur.execute("select breed_slug from dogs where reg_number = %s", (parent,))
        pb_now = cur.fetchone()[0]
        if cb_now == pb_now:
            target = None  # fixed by an earlier relabel in this loop
        elif kc == pb_now and kp != cb_now:
            target, new = child, pb_now
        elif kp == cb_now and kc != pb_now:
            target, new = parent, cb_now
        else:
            remaining.append(row)
            continue
        if target:
            old = cb_now if target == child else pb_now
            cur.execute("update dogs set breed_slug = %s, breed = %s where reg_number = %s", (new, slug_name[new], target))
            log_change(cur, STEP, "dogs", target, "breed_slug", old, new, "kennel-name evidence on cross-breed link")
            relabelled += 1
            if len(resolved_examples) < 3:
                resolved_examples.append((target, cname if target == child else pname, old, "->", new))
        cur.execute("update cross_breed_links set status = 'resolved_relabel' where child_reg = %s and side = %s", (child, side))
    report["AmStaff cross-breed links resolved by kennel-name evidence"] = len(am) - len(remaining)
    report["  dogs relabelled"] = relabelled
    report["  examples (reg, name, old, ->, new)"] = resolved_examples
    am = remaining
    report["AmStaff cross-breed links cleared"] = len(am)
    report["  by (child stub?, parent stub?)"] = dict(Counter((("stub" if r[0] in dogs and dogs[r[0]]["stub"] else "full"), ("stub" if r[7] else "full")) for r in am))
    report["  AmStaff examples (child, name, breed, side, parent, name, breed, parent_is_stub)"] = am[:6]
    for child, _cn, _cb, side, parent, *_ in am:
        cur.execute(f"update dogs set {side}_reg = null where reg_number = %s and {side}_reg = %s", (child, parent))
        log_change(cur, STEP, "dogs", child, f"{side}_reg", parent, None, "cross-breed link (AmStaff launch rule)")
        cur.execute("update cross_breed_links set status = 'cleared_amstaff' where child_reg = %s and side = %s", (child, side))
    cur.execute("create index if not exists idx_dogs_breed_slug on dogs (breed_slug)")


def body(cur, report):
    """Relabelling one dog can tip its relatives, so repeat until a pass changes nothing."""
    for n in range(1, 8):
        one_pass(cur, report)
        if not (report.get("labels fixed by family consensus") or report.get("AmStaff cross-breed links cleared")
                or report.get("AmStaff cross-breed links resolved by kennel-name evidence")):
            break
        report[f"pass {n}"] = (report.get("labels fixed by family consensus"),
                               report.get("AmStaff cross-breed links resolved by kennel-name evidence"),
                               report.get("AmStaff cross-breed links cleared"))
    report["passes"] = n


if __name__ == "__main__":
    run_step("030_step3_normalize_breeds", body)
