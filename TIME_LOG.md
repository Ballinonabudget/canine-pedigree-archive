# Time log — 20-hour build cap

Every work session by any agent (Claude, Antigravity) adds one row **before its last commit**, then updates the running total. If the next piece of work would push the total past 20 hours, stop and ask Nitty first.

**What counts toward the cap:** active hours = Nitty's hands-on time (prompting, reviewing, testing) + agent working time. Idle time, sleep and unattended overnight runs do not count. Machine-only batch runs are noted but not counted.

**How to measure:** use timestamps, not guesses. Agent time = the sum of gaps between consecutive transcript or log entries that are under 10 minutes apart. Human time = Nitty's turns (reading, typing, checking). Mark a figure `est.` when it isn't measured.

## Running total

| | Hours |
|---|---|
| Nitty hands-on | 2.3 (est.) |
| Agent working time | 9.2 |
| **Total against the 20 h cap** | **11.5** |
| **Remaining** | **8.5** |

## Sessions

| # | Date (EST) | Agent | Work | Nitty h | Agent h | Source of the numbers |
|---|---|---|---|---|---|---|
| 1 | Nov 14 18:58 – Nov 16 06:30 | Antigravity | Layers 1–9: audit, OCR pipeline, ingest, first web app, all AmStaff sheets | 2.0 (upper bound of 1.6–2.0) | 8.7 | `docs/YOUTUBE_SCRIPT_NOTES.md` §2 |
| 2 | Nov 16 – Nov 19 00:15 | Antigravity | Layer 10: Rottweiler and Boxer batches, doc sync | not logged | not logged | Antigravity to fill in |
| 3 | Nov 18 18:38 – 19:04 | Claude | Phase 0 steps 0–8 and 10, report | 0.2 (est.) | 0.45 | Claude session transcript timestamps |
| 4 | Nov 19 00:00 – 00:35 | Claude | Repo check (Antigravity, time cap, YouTube docs), this log | 0.1 (est.) | 0.1 | Claude session transcript timestamps |

Not counted: about 4 hours of the unattended 3 AM quota watcher (Nov 16), and the 25.8 hours of downtime in session 1.

## Open item

Row 2 is missing. Antigravity should add its Layer 10 hours (Nov 16–19); until then the total above is a lower bound.
