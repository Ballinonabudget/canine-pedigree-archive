# CLAUDE.md: Canine Pedigree Archive — Agent Briefing & Coordination

This file provides project context, progress tracking, YouTube script metrics, and working agreements for Claude (working in `.worktrees/claude-ux` on `claude/*` branches) and Antigravity (working on `main` / `antigravity/*` branches).

---

## 1. Project Mission & YouTube Case Study Context
* **Project**: 0-to-100 Canine Pedigree & Historical Archive Platform.
* **Goal**: Build an institutional-grade canine pedigree explorer, 8-generation Wright's Inbreeding Coefficient (COI %) engine, virtual mating simulator, and historical archive platform from 14,000+ vintage AKC Stud Book scans.
* **Format**: Filmed end-to-end for a YouTube AI engineering case study showing how autonomous agents collaborate to build complex full-stack data products on Apple Silicon ($0 local compute) while keeping API costs near zero.

---

## 2. Agent Coordination & Ownership Agreement

| Agent | Active Directory | Git Branch | Core Ownership Area |
|---|---|---|---|
| **Claude** | `.worktrees/claude-ux` | `claude/phase0-ux`, `claude/*` | **`web/` (Next.js 15 UI/UX)**, **`scripts/migrations/` (data cleaning)** |
| **Antigravity** | `~/Documents/Pedigree Database` | `main`, `antigravity/*` | **Extraction & OCR pipelines**, **Batch Ingest**, **Architecture Documentation**, **YouTube Script Tracking** |

### Shared Database Rules
* Both agents share the local PostgreSQL 16 database: `canine_pedigree_archive`.
* **Claude Phase 0 Migration**: Claude completed Phase 0 cleaning for AmStaff (`docs/reports/PHASE0_REPORT.md`), fixing self-loops, cycles, canonicalizing registration IDs, and normalizing dates.
* **Ingest Moratorium**: No legacy batch ingest scripts (`process_all_*.py`) should be run until updated to match Phase 0 canonical registration and breed schemas (see `docs/specs/CANINE_PEDIGREE_ARCHIVE_UX_SPEC.md` §13).

---

## 3. Live Pedigree Database Progress (Current State)

```
================================================================================
CANINE PEDIGREE DATABASE: LIVE METRICS (PostgreSQL 16)
================================================================================
• Total Dogs in Database:         43,888 dogs
  - Full Ingested Pups:           19,018 records (with DOB, sex, color, breeders, owners)
  - Auto-Stitched Parent Stubs:   24,870 records (multi-generation recursive links)
• Normalized Breeders & Owners:   30,634 distinct individuals / kennels
• Verified Role Relationships:    52,371 links in dog_people ('B'=Breeder, 'O'=Owner)
• Total Stud Book Sheets Ingested:510 sheets (scanned 1930s–1980s AKC sheets)
• Top Breed Breakdown:
  - Boxer:                        24,821 dogs (265 sheets)
  - Rottweiler:                    6,500 dogs (58 sheets)
  - American Staffordshire Terr.:  3,445 dogs (204 sheets; 100% complete archive)
  - Welsh Terrier:                 2,311 dogs
  - Collie:                        1,498 dogs
  - Scottish Terrier:                670 dogs
  - Sealyham Terrier:                617 dogs
  - Australian Terrier:              549 dogs
  - Skye Terrier:                    492 dogs
  - Airedale Terrier:                464 dogs
  - Bull Terrier:                    427 dogs
================================================================================
```

---

## 4. YouTube Script Notes: Time & Financial Audit

Claude, please preserve these exact metrics when updating docs or coordinating with Nitty (the user) for the YouTube video script:

### A. The Real Time Audit
* **Total Calendar Span**: **36.5 Hours** (Saturday 6:58 PM EST to Monday 6:30 AM EST).
* **Human Hands-On Prompting**: **1.6 to 2.0 Hours Total** (average user turn: **3.9 minutes**; 17 fast feedback turns, 3 deeper evaluation turns).
* **AI Machine Execution**: **8.7 Hours** (Tesseract OSD auto-rotation, vision LLM inference, PostgreSQL GIN indexing, Turbopack compilation).
* **Downtime / Sleep / Background Watcher**: **25.8 Hours** (meals, overnight sleep, 3 AM EST autonomous quota monitor).

### B. The API Budget & Financial Audit (The Big Lesson)
* **Initial 118 Sheets Spend**: **$6.02** on Google Cloud.
  * *The Trap*: Defaulted to `gemini-3.8-flash` which activated "Thinking Tokens" at $3.75/1M output tokens (generating 1.3M tokens).
  * *The Billing Trap*: Adding a credit card or spend limit disabled Google AI Studio's unconditional ~1,500 req/day Free Tier.
* **The Pivot to Cheap Model**: Switched to `gemini-3.5-flash-lite` ($0.075/1M input, $0.30/1M output).
* **Cost to Finish Remaining 111 AmStaff Sheets**: **$0.05 (Under 5 CENTS total!)**.
* **Total API Money Spent**: **~$6.07** out of $15.00 spend cap (**$8.93 remaining**).
* **Local Compute Costs**: **$0.00** (Local PostgreSQL 16 + Tesseract OSD + Turbopack on M1 Mac).

---

## 5. Key Documentation Files
* [BUILD_LOG.md](file:///Users/daplug/Documents/Pedigree%20Database/BUILD_LOG.md): Full chronological build diary from Layer 1 through Layer 10.
* [docs/YOUTUBE_SCRIPT_NOTES.md](file:///Users/daplug/Documents/Pedigree%20Database/docs/YOUTUBE_SCRIPT_NOTES.md): Full copy block for YouTube voiceover, talking points, and hooks.
* [docs/PEDIGREE_PROGRESS.md](file:///Users/daplug/Documents/Pedigree%20Database/docs/PEDIGREE_PROGRESS.md): Detailed database and breed progress tracker.
* [docs/specs/CANINE_PEDIGREE_ARCHIVE_UX_SPEC.md](file:///Users/daplug/Documents/Pedigree%20Database/docs/specs/CANINE_PEDIGREE_ARCHIVE_UX_SPEC.md): Master product and UX design spec.
* [docs/reports/PHASE0_REPORT.md](file:///Users/daplug/Documents/Pedigree%20Database/docs/reports/PHASE0_REPORT.md): Claude's Phase 0 AmStaff data cleaning results and exit criteria.
* [TIME_LOG.md](file:///Users/daplug/Documents/Pedigree%20Database/TIME_LOG.md): Hours per session against the 20-hour build cap. Add a row before each session's last commit.
* [AGENTS_COORDINATION.md](file:///Users/daplug/Documents/Pedigree%20Database/AGENTS_COORDINATION.md): Rules of engagement between Claude and Antigravity.
