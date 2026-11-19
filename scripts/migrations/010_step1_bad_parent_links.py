"""
Phase 0 · Step 1 — Fix self-loops and impossible parents.

Clears (sets to NULL) parent links that cannot be right. No dog rows are deleted.
  a) sire_reg / dam_reg equal to the dog's own reg (self-loop)
  b) placeholder parent regs: NULL, null, B, D, (B), (D), UNKNOWN*, 0000*
  c) sire_reg = dam_reg: keep the side whose recorded parent name (from the stud book row)
     matches the referenced dog's name; clear the other. If neither matches, clear both.
  d) cycles (A is an ancestor of itself): in each cycle, clear the link whose recorded parent
     name matches the referenced dog least. Repeat until no cycles remain.
Every cleared value is logged in phase0_changes (step '010'), so it can be reviewed or restored.
Re-runnable: a second run finds nothing to change.

Usage: python scripts/migrations/010_step1_bad_parent_links.py [--apply]
"""
from lib import ensure_audit_table, examples, log_change, run_step

STEP = "010"
PLACEHOLDER_RE = r"^(NULL|NONE|B|D|\(B\)|\(D\)|UNKNOWN.*|0{4,}.*)$"

# Recorded parent name for a dog's sire/dam, from the raw stud book row the dog came from.
RAW_PARENT_NAME = """
  (select r.{side}_name from raw_entries r
    where r.sheet = d.source_file
      and upper(regexp_replace(r.reg_number, '[^A-Za-z0-9/]', '', 'g')) = upper(regexp_replace(d.reg_number, '[^A-Za-z0-9/]', '', 'g'))
    order by similarity(upper(r.name), upper(d.name)) desc limit 1)
"""


def name_sim_sql(side):
    """similarity between the recorded {side} name and the name of the dog that {side}_reg points to."""
    return f"coalesce(similarity(upper({RAW_PARENT_NAME.format(side=side)}), upper(p.name)), 0)"


def clear(cur, reg, col, old, reason, counter, report):
    cur.execute(f"update dogs set {col} = null where reg_number = %s and {col} = %s", (reg, old))
    if cur.rowcount:
        log_change(cur, STEP, "dogs", reg, col, old, None, reason)
        report[counter] = report.get(counter, 0) + 1


def body(cur, report):
    ensure_audit_table(cur)
    report["a) self-loops cleared"] = 0
    report["b) placeholder parent regs cleared"] = 0
    report["c) sire=dam: one side cleared"] = 0
    report["c) sire=dam: both cleared"] = 0
    report["d) cycle links cleared"] = 0

    report["a) examples"] = examples(cur, "select reg_number, name, sire_reg, dam_reg from dogs where sire_reg = reg_number or dam_reg = reg_number order by reg_number")
    cur.execute("select reg_number, sire_reg, dam_reg from dogs where sire_reg = reg_number or dam_reg = reg_number")
    for reg, s, d in cur.fetchall():
        if s == reg:
            clear(cur, reg, "sire_reg", s, "self-loop", "a) self-loops cleared", report)
        if d == reg:
            clear(cur, reg, "dam_reg", d, "self-loop", "a) self-loops cleared", report)

    report["b) examples"] = examples(cur, "select reg_number, name, sire_reg, dam_reg from dogs where upper(sire_reg) ~ %s or upper(dam_reg) ~ %s order by reg_number", (PLACEHOLDER_RE, PLACEHOLDER_RE))
    for col in ("sire_reg", "dam_reg"):
        cur.execute(f"select reg_number, {col} from dogs where upper({col}) ~ %s", (PLACEHOLDER_RE,))
        for reg, old in cur.fetchall():
            clear(cur, reg, col, old, "placeholder parent reg", "b) placeholder parent regs cleared", report)

    cur.execute(f"""
        select d.reg_number, d.name, d.sire_reg, p.name,
               {RAW_PARENT_NAME.format(side='sire')}, {RAW_PARENT_NAME.format(side='dam')},
               {name_sim_sql('sire')}, {name_sim_sql('dam')}
        from dogs d join dogs p on p.reg_number = d.sire_reg
        where d.sire_reg = d.dam_reg order by d.reg_number""")
    rows = cur.fetchall()
    report["c) examples (dog, parent reg, parent name, recorded sire, recorded dam, sim sire, sim dam)"] = [
        (r[0], r[2], r[3], r[4], r[5], round(r[6], 2), round(r[7], 2)) for r in rows[:3]]
    for reg, _name, preg, _pname, _rs, _rd, ss, sd in rows:
        if max(ss, sd) >= 0.3 and ss != sd:
            col = "dam_reg" if ss > sd else "sire_reg"
            clear(cur, reg, col, preg, "sire = dam; other side matches recorded name", "c) sire=dam: one side cleared", report)
        else:
            clear(cur, reg, "sire_reg", preg, "sire = dam; neither side matches", "c) sire=dam: both cleared", report)
            clear(cur, reg, "dam_reg", preg, "sire = dam; neither side matches", "c) sire=dam: both cleared", report)
    # sire=dam rows with no parent row at all (dangling) — clear both
    cur.execute("select reg_number, sire_reg from dogs d where sire_reg = dam_reg")
    for reg, preg in cur.fetchall():
        clear(cur, reg, "sire_reg", preg, "sire = dam; parent not in DB", "c) sire=dam: both cleared", report)
        clear(cur, reg, "dam_reg", preg, "sire = dam; parent not in DB", "c) sire=dam: both cleared", report)

    cycle_examples = []
    for _ in range(50):
        cur.execute("""
            with recursive walk(start, cur, depth, path) as (
              select reg_number, reg_number, 0, array[reg_number::text] from dogs
              union all
              select w.start, p.reg_number, w.depth + 1, w.path || p.reg_number::text
              from walk w join dogs d on d.reg_number = w.cur
              join dogs p on p.reg_number in (d.sire_reg, d.dam_reg)
              where w.depth < 30 and not (p.reg_number::text = any(w.path[2:]))
            )
            select path from walk where depth > 0 and cur = start order by start limit 1""")
        row = cur.fetchone()
        if not row:
            break
        path = row[0]
        edges = []
        for child, parent in zip(path, path[1:]):
            for side in ("sire", "dam"):
                cur.execute(f"""select d.name, p.name, {RAW_PARENT_NAME.format(side=side)}, {name_sim_sql(side)}
                                from dogs d join dogs p on p.reg_number = d.{side}_reg
                                where d.reg_number = %s and d.{side}_reg = %s""", (child, parent))
                r = cur.fetchone()
                if r:
                    edges.append((r[3], child, side, parent, r[0], r[1], r[2]))
        sim, child, side, parent, cname, pname, recorded = min(edges)
        if len(cycle_examples) < 3:
            cycle_examples.append((" -> ".join(path), f"cleared {child}.{side}_reg={parent}",
                                   f"recorded {side} '{recorded}' vs '{pname}' (sim {sim:.2f})"))
        clear(cur, child, f"{side}_reg", parent, f"breaks cycle {' -> '.join(path)}", "d) cycle links cleared", report)
    report["d) examples"] = cycle_examples


if __name__ == "__main__":
    run_step("010_step1_bad_parent_links", body)
