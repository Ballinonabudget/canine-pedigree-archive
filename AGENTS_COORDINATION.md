# Working Agreement: Claude + Antigravity (ChatGPT) on Canine Pedigree Archive

Two autonomous AI agents work on this project simultaneously. This document specifies ownership boundaries, shared database rules, and communication protocols.

Source of truth for UX/UI & Data Architecture: `docs/specs/CANINE_PEDIGREE_ARCHIVE_UX_SPEC.md`.  
Source of truth for Chronological Build Diary: `BUILD_LOG.md`.  
Source of truth for YouTube Script & Metrics: `docs/YOUTUBE_SCRIPT_NOTES.md`.  
Source of truth for Live Database Metrics: `docs/PEDIGREE_PROGRESS.md`.  

---

## 1. Where Each Agent Works

| Agent | Working Directory | Primary Git Branch | Core Ownership |
|---|---|---|---|
| **Antigravity / ChatGPT** | `~/Documents/Pedigree Database` (main checkout) | `main` | **Extraction & OCR pipelines**, **Batch Ingestion**, **Architecture Documentation**, **YouTube Script Tracking** |
| **Claude** | `~/Documents/Pedigree Database/.worktrees/claude-ux` (git worktree) | `claude/phase0-ux`, `claude/*` | **`web/` (Next.js 15 UI/UX)**, **`scripts/migrations/` (data cleaning & schema fixes)** |

A git worktree provides isolated checkouts on separate branches so file changes in one directory do not collide with the other. Work merges cleanly through commits, pushes, and GitHub pull requests.

---

## 2. Who Owns What

| Area | Owner | Rules & Protocol |
|---|---|---|
| **`web/` (Next.js 15 UI/UX)** | **Claude** | Antigravity: do NOT edit `web/` while Claude is active. Review via PRs or leave notes here. |
| **`scripts/migrations/`** | **Claude** | Numbered, re-runnable data migration and schema integrity scripts. |
| **`docs/specs/`** | Owner (Nitty) | Agents read-only. Changes only upon explicit request from Nitty. |
| **`docs/YOUTUBE_SCRIPT_NOTES.md`** | **Antigravity** | Maintains exact hours, financial audits, model selection lessons, and video copy blocks. Claude can read & cite. |
| **`docs/PEDIGREE_PROGRESS.md`** | **Both** | Live tracking of dogs, sheets, stubs, and breeds. Updated after every major milestone. |
| **`BUILD_LOG.md`** | **Both** | Chronological build diary. Append-only; tag each entry with your agent name. |
| **Extraction / OCR (`scripts/*.py`)** | **Antigravity** | Batch extraction and Tesseract OSD auto-rotation. (Note: legacy batch ingest paused until updated per spec §13). |

---

## 3. The Shared PostgreSQL Database

Git branches do **NOT** isolate PostgreSQL. Both agents connect to the local PostgreSQL 16 database: `canine_pedigree_archive`.

* **Phase 0 Status**: Claude completed Phase 0 data cleaning for the AmStaff collection (`docs/reports/PHASE0_REPORT.md`), resolving self-loops, cycles, canonicalizing registration numbers, and splitting titles.
* **Ingestion Moratorium**: No legacy batch ingest scripts (`process_all_*.py`, `ingest.py`) should be executed on AmStaff until updated to write Phase 0 canonical schemas (§13).
* **Schema Migrations**: Recorded in `schema_migrations`. Always check before touching tables.
* **Backups**: Database dumps live in `data/backups/` (git-ignored). Back up before modifying schema.

---

## 4. Merging & Synchronization

1. Each agent commits and pushes to its designated branch on GitHub (`origin/main` vs `origin/claude/*`).
2. Pull `main` into your branch before beginning a new major layer.
3. Open a pull request into `main` for Nitty to review and merge.
