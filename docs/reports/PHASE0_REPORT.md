# Phase 0 report — AmStaff (2026-11-18, Claude)

Spec: `docs/specs/CANINE_PEDIGREE_ARCHIVE_UX_SPEC.md` §3. Branch: `claude/phase0-ux`.

## Backups (git-ignored, `data/backups/` in the main checkout)

| File | Size | Restore test |
|---|---|---|
| `canine_pedigree_archive_20261118_184004_before-phase0.dump` (pg_dump -Fc) | 1.4 MB | OK, row counts match |
| `canine_pedigree_archive_20261118_184004_before-phase0.sql` (pg_dump -Fp) | 4.8 MB | — |
| `canine_pedigree_archive_20261118_190311_after-phase0.dump` | 3.8 MB | OK, row counts match |
| `canine_pedigree_archive_20261118_190311_after-phase0.sql` | 16 MB | — |

Stats snapshots after each step: `data/backups/stats_*.json`.

## Exit criteria (AmStaff) — all met

| Metric (AmStaff) | Before | After |
|---|---|---|
| Self-loops | 12 | **0** |
| Cycles | 6 | **0** |
| Cross-breed parent links | 89 | **0** |
| Born-before-parent pairs (target < 10) | 9 | **1** |
| Dogs with breed_slug | 0 | **all 3,445** |
| Stud book entries with stud_book_issue | 0 | **all 1,965** |
| Sire = dam | 15 | 0 |
| Corrupted sex codes | 53 | 0 |
| Placeholder registration IDs | 9 | 0 |

Whole database: self-loops 295 → 0, cycles 10 → 0, sire = dam 164 → 0, bad sex codes 172 → 0, cross-breed links 396 → 113 (left open for review, non-AmStaff), born-before-parent 72 → 25.

AmStaff rows went 3,708 → 3,445. That's because duplicate scans were merged and dogs mislabelled as AmStaff were moved to their real breed, offset by the 108 yearbook dogs added. No real dog was deleted. Every merged row is saved as JSON in `phase0_changes`.

## What each step did (`scripts/migrations/`, all re-runnable, dry run by default)

| Step | Script | Result |
|---|---|---|
| 0 | `000_backup_and_verify.sh` | Two dumps + scratch restore check |
| prep | `005_load_raw_entries.py` | 21,853 extracted rows in `raw_entries` (lossless evidence) |
| 1 | `010_step1_bad_parent_links.py` | Cleared self-loops, placeholders, sire = dam, broke 5 cycles at the weakest name match |
| 2 | `020_step2_canonical_regs.py` | Canonical regs; 558 `/NN` → `litter_code`; 355 placeholder IDs → `UNREG_<SHEET>_<ROW>`; 1,253 duplicate groups merged; 71 OCR collisions kept apart (`reg_conflict`) |
| 3 | `030_step3_normalize_breeds.py` | 58 labels → 36 breeds; `breed_slug`; Staffordshire → amstaff with `historical_breed_label` (1,085 dogs); labels fixed by family + kennel-name evidence |
| 4 | `040_step4_recover_parents.py` | 108 yearbook dogs ingested; 198 parents from regs hidden in names; 1,508 links to shared `UNREG:<BREED>:<NAME>` stubs |
| 5 | `050_step5_names.py` | Display names (original kept in `name_raw`), `aka_names`, titles and `country` split out |
| 6 | `060_step6_dates_and_sex.py` | `birth_year/month/day/date_precision`; 920 M-YY dates → `stud_book_pub_date`; 170 sex codes fixed |
| 7 | `070_step7_people.py` | OWNER resolved, 5,044 co-owner splits, `kind`, `initials_only` |
| 8 | `080_step8_provenance.py` | `stud_book_issue` + source for every entry |
| 10 | `100_step10_indexes.py` | aka trigram, birth_year, breed + year, person indexes |

## What I couldn't fix (or chose not to guess)

1. **Step 9 not done.** Re-extracting `Astaff peds 39, 42, 54` needs Gemini API calls and the fixed prompt from §13. I haven't sent anything to Gemini without your OK. These sheets are behind many of the name conflicts below.
2. **Stud book issue is approximate for many AmStaff entries.** Header 549, own publication date 164, interpolated from neighbouring sheets 1,011, estimated "c. YYYY" 241. The UI should show the estimated ones as approximate.
3. **Pedigrees are shallow.** Only 178 AmStaff stud book entries reach 3 generations and 44 reach 5. On average about 4% of a 5-generation tree is known. This is a gap in the source material, not a cleanup bug. The "records end here" and completeness design in §8 will carry the experience.
4. **Review queues** (tables, status `open`):
   - `name_conflicts`: 1,890 dogs where another row with the same reg has an unrelated name (mostly row-shifted sheets)
   - `cross_breed_links`: 113 non-AmStaff cross-breed links
   - `reg_conflict`: 98 AmStaff dogs flagged as OCR collisions
   - 3 AmStaff birth dates marked `disputed`
5. **1 AmStaff born-before-parent pair remains** (Kate's Mufasa, sire of Azteca's Mufasa). One of the dates or the link is wrong and the data can't tell which.
6. **The old ingest scripts are now out of step with the schema.** `scripts/ingest.py` and the batch runners would write un-normalized regs and breeds. Don't run them until they're updated per §13.

## Proposed order for the UI work (§18)

1. App skeleton: real routes (`/`, `/search`, `/amstaff`, `/amstaff/dog/[reg]`, `/people/[id]`), light/dark tokens, page titles/descriptions, remove the hardcoded home dog.
2. Data layer: one recursive pedigree query with cycle protection; the search query (reg detection, trigram over name + aka + people).
3. Dog profile header + pedigree chart (2–9 generations, completeness line, unknown / "records end here", re-centre + breadcrumbs, common ancestors).
4. Search: instant dropdown (clickable people), full results page with filters and chips.
5. Profile tabs: offspring, siblings & litter, descendants, details.
6. Person / kennel pages (with the initials-only note).
7. Breed home: coverage chart, browse by decade, foundation dogs, influential sires/dams, notable kennels.
8. About + coverage pages.
9. Test mating / COI tool under `/tools` with the completeness rule.
10. Print / PDF, mobile pass, sitemap.
11. Google sign-in + favorites (needs OAuth credentials from you).
12. VPS deploy with nightly backups.
