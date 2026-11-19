#!/usr/bin/env bash
# Phase 0 · Step 0 — Back up canine_pedigree_archive and prove the backup restores.
#
# Usage: scripts/migrations/000_backup_and_verify.sh [label]
#   label is optional, added to the file name (e.g. "before-step1").
#
# Writes two dumps to $BACKUP_DIR (default: <main checkout>/data/backups, git-ignored):
#   canine_pedigree_archive_<timestamp>[_label].dump  (custom format, pg_dump -Fc)
#   canine_pedigree_archive_<timestamp>[_label].sql   (plain SQL,     pg_dump -Fp)
# Then restores the .dump into a throwaway database and compares row counts per table.
# Safe to re-run: every run makes new timestamped files and drops only its own scratch DB.
set -euo pipefail

DB="${DB:-canine_pedigree_archive}"
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --path-format=absolute --git-common-dir)/.."
BACKUP_DIR="${BACKUP_DIR:-$(cd "$REPO_ROOT" && pwd)/data/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
LABEL="${1:+_$1}"
BASE="$BACKUP_DIR/${DB}_${STAMP}${LABEL}"
SCRATCH="${DB}_restore_check"

mkdir -p "$BACKUP_DIR"
pg_dump -Fc -d "$DB" -f "$BASE.dump"
pg_dump -Fp -d "$DB" -f "$BASE.sql"

dropdb --if-exists "$SCRATCH"
createdb "$SCRATCH"
pg_restore --no-owner -d "$SCRATCH" "$BASE.dump"

count_sql="select string_agg(t || '=' || n, ' ' order by t) from (
  select table_name t, (xpath('/row/c/text()', query_to_xml('select count(*) c from public.'||quote_ident(table_name), false, true, '')))[1]::text n
  from information_schema.tables where table_schema='public' and table_type='BASE TABLE') s;"
orig="$(psql -d "$DB" -Atc "$count_sql")"
rest="$(psql -d "$SCRATCH" -Atc "$count_sql")"
dropdb "$SCRATCH"

echo "backup (custom): $BASE.dump  $(du -h "$BASE.dump" | cut -f1)"
echo "backup (plain):  $BASE.sql  $(du -h "$BASE.sql" | cut -f1)"
echo "source rows:   $orig"
echo "restored rows: $rest"
if [[ "$orig" != "$rest" ]]; then echo "RESTORE CHECK FAILED"; exit 1; fi
echo "RESTORE CHECK OK"
