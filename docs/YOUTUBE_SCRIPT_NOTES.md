# YouTube AI Case Study: Complete Script Notes & Video Breakdown

**Project:** 0-to-100 Canine Pedigree & Historical Archive Platform  
**Target Video Concept:** How autonomous AI agents built an institutional-grade database & web application on an Apple Silicon M1 Mac for under $7 in API costs.

---

## 1. Quick Stats for Screen & B-Roll Overlays

```
┌─────────────────────────────────────────────────────────────┐
│ 🎬 CASE STUDY HERO NUMBERS                                  │
├─────────────────────────────────────────────────────────────┤
│ • Total Dogs Ingested:          43,888 Dogs                 │
│ • Full Puppy Records:           19,018 Pups (DOB/Color/etc) │
│ • Parent Stubs Stitched:        24,870 Auto-Created Stubs   │
│ • Historical Breeders/Owners:   30,634 People Normalized    │
│ • Verified Dog-People Links:    52,371 Relationships        │
│ • Archival Stud Book Sheets:    510 Dense Historical Pages  │
│ • Breeds Active:                36+ Breeds (Boxer, Rottie,  │
│                                 Amstaff, Welsh, Collie)     │
│ • Total Out-of-Pocket Cost:     $6.07 API Spend (of $15 cap)│
│ • Local Compute & Hosting Cost: $0.00 (Native Apple M1)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. The Real Time Audit: Prompting vs. Machine Execution

When presenting this build to an audience, clarity on real working hours vs. idle time is critical.

| Category | Time Measured | Description | Video Script Framing |
|---|---|---|---|
| **Total Calendar Span (Layers 1–9)** | **33.9 Hours** | From Saturday 6:58 PM EST to Monday 4:51 AM EST | *"A full weekend build, but I wasn't glued to my chair."* |
| **Human Hands-On Prompting** | **~2.0 Hours (est.)** | Total time drafting 23 prompts, reviewing agent outputs, and testing localhost | *"I spent ~2 hours actively typing instructions and reviewing work."* |
| **Active AI Working Time** | **2.7 Hours** | Measured by consecutive transcript gaps <10m (`06944c8d` steps 0–712 + `fbf7a28b`) | *"The AI spent 2.7 hours of active coding, OCR, SQL migrations, and UI generation."* |
| **Unattended Batch & Watcher Runs** | **~7.7 Hours** | 118-sheet AmStaff batch (~4.4 h) + 3 AM overnight quota watcher (~3.3 h) — not counted against active cap | *"Nearly 8 hours of hands-free batch processing while the Mac worked alone."* |
| **Downtime / Sleep / Breaks** | **~21.5 Hours** | Overnight sleep cycles, meals, and idle gaps >10m | *"Over 21 hours was completely hands-free while I slept and lived my life."* |

---

## 3. The Financial Audit & Golden Model Selection Lessons

### The Trap: Flagship Models + Thinking Bloat ($6.02 on 118 Sheets)
* **What Happened:** When our initial test on deprecated endpoints prompted a migration, the script switched to `gemini-3.8-flash`.
* **The Hidden Trap:** `gemini-3.8-flash` turned on dynamic "Thinking Tokens" by default, billed at **$3.75 per 1 million output tokens**. Across 118 dense tables, it generated ~1.3 million tokens, pushing usage to **$6.02**.
* **The Billing Trap:** Setting a budget alert or spending limit in Google Cloud required attaching a credit card, which immediately disabled the unconditional 1,500 req/day Google AI Studio Free Tier!
* **The Reporting Lag:** Google Cloud billing updates on a 15–45 minute delay. The balance jumped from $5.18 to $6.02 because of delayed billing settlement, not new calls.

### The Fix: Gemini 3.5 Flash-Lite (Under 5 Cents for 111 Sheets!)
* **The Solution:** We told the agent to audit the model catalog and pricing before executing. We switched to **`gemini-3.5-flash-lite`** ($0.075 / 1M input, $0.30 / 1M output) with zero thinking bloat.
* **The Result:** The entire remaining 111 Amstaff sheets finished for **$0.05 (approx 5 CENTS total)**!
* **Total Project API Spend:** **$6.07** of our $15.00 limit ($8.93 remaining).

---

## 4. Architectural Talking Points: 5 Engineering Triumphs

1. **The Orientation Trap (Tesseract OSD on M1):**
   * *Problem:* Over 85% of scanned 1950s–1970s stud book pages were scanned sideways (90° CW/CCW) or upside down (180°). Feeding sideways dense tables into an LLM causes severe OCR hallucination.
   * *Solution:* We avoided naive aspect-ratio rotating and used local Tesseract OSD (`image_to_osd()`) on Apple Silicon. In milliseconds, it detects text baseline slant and flips pages upright before the LLM ever sees them.

2. **Zero-Conflict Parent Stubbing:**
   * *Problem:* Sires and dams appear in puppy rows decades before their own birth records are indexed. Naive relational databases throw foreign key constraint crashes.
   * *Solution:* Our ingest engine inserts puppies as full records (`is_stub=FALSE`), while automatically synthesizing lightweight ancestor stubs (`is_stub=TRUE`). When the parent's actual birth sheet is indexed years later, it cleanly updates without collisions.

3. **Multi-Generation Family Tree Graph & Wright's COI %:**
   * *Problem:* Calculating inbreeding coefficients (Wright's COI) across 8 generations on live web requests is computationally expensive.
   * *Solution:* Recursive PostgreSQL Common Table Expressions (CTEs) combined with GIN trigram indexes search and traverse deep ancestor paths in 3 milliseconds.

4. **Multi-Agent Coordination (Claude + Antigravity):**
   * *Problem:* Multiple AI agents editing the same code repository causes merge conflicts and overwrites.
   * *Solution:* We isolated Claude in a dedicated git worktree (`.worktrees/claude-ux`) on branch `claude/phase0-ux` to own the Next.js UI/UX and data cleaning, while Antigravity operates on `main` to own batch ingestion, OCR pipelines, and build documentation.

5. **Local Compute vs. Cloud Spend:**
   * *Problem:* Cloud database instances and OCR SaaS subscriptions cost hundreds of dollars monthly.
   * *Solution:* We used pre-installed local PostgreSQL 16, ImageMagick, Tesseract, and Next.js Turbopack on the developer's M1 Mac. Total hosting and database cost: **$0.00**.

---

## 5. Ready-to-Read YouTube Script Voiceover

> *"If you look at the timestamps on our Git commits, ~34 hours elapsed between my first prompt on Saturday evening and completing the AmStaff archive on Monday morning.*
>
> *Here is the honest truth about real AI development: I was NOT coding for 34 hours. I spent roughly two hours actively typing instructions, testing screens, and steering the agents.*
>
> *The AI agent spent 2.7 hours of active coding and verification—writing database schemas, fixing upside-down image scans with Tesseract, and generating UI components—plus ~7.7 hours of unattended batch and quota-watcher runs. The remaining ~21.5 hours? That was me sleeping and living my life.*
>
> *And if you're building with AI APIs, remember this million-dollar lesson:*
> *We accidentally spent $6.02 on our first 118 pages because the agent defaulted to a flagship model with 'thinking reasoning' turned on. Once we caught it, audited the pricing catalog, and switched to Gemini 3.5 Flash-Lite, we extracted the next 111 pages for less than five cents!*
>
> *Always inspect your model tiers, cache everything locally to disk, and use local Apple Silicon compute for image processing so you never pay twice."*
