"""Shared helpers for Phase 0 migrations: DB connection, migration bookkeeping, dry-run wrapper."""
import os
import sys
from contextlib import contextmanager

import psycopg2

DB_URL = os.getenv("DATABASE_URL", "postgresql://daplug@localhost:5432/canine_pedigree_archive")


def connect(url=None):
    return psycopg2.connect(url or DB_URL)


def has_column(conn, table, column):
    with conn.cursor() as c:
        c.execute("select 1 from information_schema.columns where table_schema='public' and table_name=%s and column_name=%s",
                  (table, column))
        return c.fetchone() is not None


def ensure_migrations_table(cur):
    cur.execute("""create table if not exists schema_migrations (
        id serial primary key, step text not null, applied_at timestamptz not null default now(),
        applied_by text not null default 'claude', summary jsonb)""")


def run_step(step_name, body):
    """Run body(cur, report) inside one transaction.

    --dry-run (default): everything executes, results are printed, then ROLLBACK.
    --apply: same, then COMMIT and record in schema_migrations.
    body must be idempotent: running it twice leaves the DB unchanged the second time.
    """
    apply = "--apply" in sys.argv
    report = {}
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute("set lock_timeout = '10s'")
        ensure_migrations_table(cur)
        body(cur, report)
        mode = "APPLY" if apply else "DRY RUN (rolled back)"
        print(f"\n== {step_name} — {mode} ==")
        for k, v in report.items():
            if isinstance(v, list):
                print(f"{k}:")
                for row in v:
                    print(f"    {row}")
            else:
                print(f"{k}: {v}")
        if apply:
            import json
            cur.execute("insert into schema_migrations (step, summary) values (%s, %s)",
                        (step_name, json.dumps({k: v for k, v in report.items() if not isinstance(v, list)}, default=str)))
            conn.commit()
        else:
            conn.rollback()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return report


def examples(cur, sql, args=None, n=3):
    cur.execute(sql + f" limit {n}", args)
    return [tuple(r) for r in cur.fetchall()]


def ensure_audit_table(cur):
    """Every value a migration changes is logged here so any step can be reviewed or reversed."""
    cur.execute("""create table if not exists phase0_changes (
        id bigserial primary key, step text not null, at timestamptz not null default now(),
        tbl text not null, key text not null, col text not null, old_value text, new_value text, reason text)""")


def log_change(cur, step, tbl, key, col, old, new, reason):
    cur.execute("insert into phase0_changes (step, tbl, key, col, old_value, new_value, reason) values (%s,%s,%s,%s,%s,%s,%s)",
                (step, tbl, key, col, None if old is None else str(old), None if new is None else str(new), reason))
