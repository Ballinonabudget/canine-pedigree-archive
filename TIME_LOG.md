# Time log — 20-hour build cap

Every work session by any agent (Claude, Antigravity) adds one row **before its last commit**, then updates the running total. If the next piece of work would push the total past 20 hours, stop and ask Nitty first.

**What counts toward the cap:** active hours = Nitty's hands-on time (prompting, reviewing, testing) + agent working time. Idle time, sleep and unattended overnight runs do not count. Machine-only batch runs are noted but not counted.

**How to measure:** use timestamps, not guesses. Agent time = the sum of gaps between consecutive transcript or log entries that are under 10 minutes apart. Human time = Nitty's turns (reading, typing, checking). Mark a figure `est.` when it isn't measured.

## Running total

| | Hours |
|---|---|
| Nitty hands-on | 3.1 (est.) |
| Agent working time | 4.25 |
| **Total against the 20 h cap** | **7.35** |
| **Remaining** | **12.65** |

## Sessions

| # | Date (EST) | Agent | Work | Nitty h | Agent h | Source of the numbers |
|---|---|---|---|---|---|---|
| 1 | Nov 14 18:58 – Nov 16 04:51 | Antigravity | Layers 1–9: audit, OCR pipeline, ingest, first web app, all AmStaff sheets, tracker setup | 2.0 (est.) | 2.7 | Transcripts `06944c8d` (steps 0–712), `fbf7a28b` |
| 2 | Nov 16 04:47 – Nov 19 00:19 | Antigravity | Layer 10: Multi-breed verification, Rottweiler & Boxer batches, UX audit, doc sync | 0.8 (est.) | 1.0 | Transcripts `06944c8d` (steps 713–926), `f3107e30`, `2d19f27e` |
| 3 | Nov 18 18:38 – 19:04 | Claude | Phase 0 steps 0–8 and 10, report | 0.2 (est.) | 0.45 | Claude session transcript timestamps |
| 4 | Nov 19 00:00 – 00:35 | Claude | Repo check (Antigravity, time cap, YouTube docs), this log | 0.1 (est.) | 0.1 | Claude session transcript timestamps |

Not counted: unattended machine batch runs and overnight watchers — ~4.4 h 118-sheet AmStaff batch + ~3.3 h 3 AM quota watcher (Nov 15–16), ~0.4 h Rottweiler 58-sheet batch + ~7.35 h Boxer 559-sheet `caffeinate` batch (Nov 16), plus sleep/idle gaps > 10 min.
