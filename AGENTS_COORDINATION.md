# Working agreement: Claude + ChatGPT on this repo

Two AI agents work on this project at the same time. This file says who owns what so they don't overwrite each other.
Source of truth for the build: `docs/specs/CANINE_PEDIGREE_ARCHIVE_UX_SPEC.md`.

## Where each agent works

| Agent | Folder | Git branch |
|---|---|---|
| ChatGPT | `~/Documents/Pedigree Database` (main checkout) | `main` (or its own `chatgpt/*` branches) |
| Claude | `~/Documents/Pedigree Database/.worktrees/claude-ux` (git worktree) | `claude/phase0-ux`, later `claude/*` |

A git worktree is a second checkout of the same repo on its own branch. Files edited in one folder do not change in the other. Work comes together only through commits, pushes and pull requests on GitHub.

## Who owns what

| Area | Owner | Notes |
|---|---|---|
| `web/` (Next.js UI/UX) | **Claude** | ChatGPT: don't edit; open an issue or leave a note in this file. |
| `scripts/migrations/` (Phase 0 cleanup) | **Claude** | Numbered, re-runnable. |
| `docs/specs/` | Owner (Nitty) | Agents read; changes only when Nitty asks. |
| Extraction / OCR / new scans (`scripts/*.py`, `scripts/extracted_cache/`) | ChatGPT | See spec §13 before ingesting more scans. |
| `BUILD_LOG.md` | Both | Append only, add your agent name to each entry. |

## The shared database

Branches do not isolate PostgreSQL. Both agents talk to the same `canine_pedigree_archive` database.

- **While Phase 0 is in progress, only Claude writes to `canine_pedigree_archive`.** No ingest runs (`process_all_*.py`, `overnight_auto_runner.py`, `ingest.py`) until Phase 0 is finished for AmStaff, because the old ingest code would re-add the problems Phase 0 removes.
- Every applied migration is recorded in the `schema_migrations` table (`select * from schema_migrations order by id;`). Check it before touching the schema.
- Experiments go in a scratch database (`createdb canine_pedigree_archive_scratch_<agent>`), never in the main one.
- Backups live in `data/backups/` (git-ignored). Make one before any write.

## Merging

- Each agent pushes its own branch and opens a pull request into `main`. Nitty merges.
- Pull `main` into your branch before starting a new piece of work.
