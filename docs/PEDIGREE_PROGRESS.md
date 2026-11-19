# Canine Pedigree Archive: Database & Processing Progress Tracker

**Updated:** November 19, 2026  
**Primary Database:** PostgreSQL 16 (`canine_pedigree_archive`) on Apple Silicon M1  
**Total Ingested Stud Book Sheets:** 510 sheets  

---

## 1. Global Database Health & Metrics

| Metric | Current Count | Notes |
|---|---|---|
| **Total Dog Entities** | **43,888** | Active in `dogs` table |
| **Fully Ingested Puppies** | **19,018** | Includes verified birth date, sex, color, breeders, and owners |
| **Auto-Stitched Parent Stubs**| **24,870** | Sires and dams synthesized to link multi-generation pedigrees |
| **Historical People** | **30,634** | Distinct breeders, owners, and kennels in `people` |
| **Verified Dog-Person Links** | **52,371** | Role-attributed links in `dog_people` ('B'=Breeder, 'O'=Owner) |
| **Total Archival Sheets Ingested**| **510** | Scanned AKC Stud Book sheets (1930s–1980s) |
| **Historical Periodicals** | **2** | Ingested magazine write-ups & foundation letters |

---

## 2. Breed Breakdown (Top Collections)

Multi-breed historical AKC stud books group multiple breeds per issue. Here is the active breakdown across the database:

| Breed | Total Dogs | Ingested Sheets | Status / Notes |
|---|---|---|---|
| **Boxer** | **24,821** | 265 sheets | Batch complete (1980s AKC monthly issues) |
| **Rottweiler** | **6,500** | 58 sheets | 1950s AKC Stud Book issues complete |
| **American Staffordshire Terrier** | **3,445** | 229 sheets | **100% Complete Archive** (Phase 0 Cleaned by Claude) |
| **Welsh Terrier** | **2,311** | Multi-breed | Extracted from Terrier Group section |
| **Collie** | **1,498** | Multi-breed | Extracted from Working Group section |
| **Scottish Terrier** | **670** | Multi-breed | Extracted from Terrier Group section |
| **Sealyham Terrier** | **617** | Multi-breed | Extracted from Terrier Group section |
| **Australian Terrier** | **549** | Multi-breed | Extracted from Terrier Group section |
| **Skye Terrier** | **492** | Multi-breed | Extracted from Terrier Group section |
| **Airedale Terrier** | **464** | Multi-breed | Extracted from Terrier Group section |
| **Bull Terrier** | **427** | Multi-breed | Extracted from Terrier Group section |
| **Cairn Terrier** | **218** | Multi-breed | Extracted from Terrier Group section |
| **Great Dane** | **214** | Multi-breed | Extracted from Working Group section |
| **Border Terrier** | **180** | Multi-breed | Extracted from Terrier Group section |
| **Bedlington Terrier** | **172** | Multi-breed | Extracted from Terrier Group section |
| **Samoyed** | **140** | Multi-breed | Extracted from Working Group section |
| **West Highland White Terrier** | **169** | Multi-breed | Extracted from Terrier Group section |
| **Other Breeds (20+ breeds)** | **500+** | Multi-breed | Puli, Bullmastiff, Briard, Great Pyrenees, etc. |

---

## 3. Data Integrity & Claude Phase 0 Audit Status

Claude completed Phase 0 data cleaning for the primary target breed (American Staffordshire Terrier) on branch `claude/phase0-ux` (see `docs/reports/PHASE0_REPORT.md`).

### Phase 0 Exit Criteria (AmStaff — All Met)
* **Self-loops (Dog = Sire or Dam):** 12 → **0**
* **Graph Cycles (Infinite pedigree loops):** 6 → **0**
* **Cross-breed parent links:** 89 → **0**
* **Born-before-parent pairs:** 9 → **1** (target was < 10)
* **Dogs with standardized `breed_slug`:** 0 → **all 3,445**
* **Stud book entries with `stud_book_issue`:** 0 → **all 1,965**
* **Sire = Dam errors:** 15 → **0**
* **Corrupted sex codes:** 53 → **0**
* **Placeholder registration IDs:** 9 → **0**

*(Note: AmStaff row count adjusted from 3,708 to 3,445 due to deduplication of overlapping scans and moving mislabeled dogs to their real breeds, offset by 108 historic STCA yearbook dogs).*

---

## 4. UI/UX Implementation Roadmap (Claude Phase 1+)

As documented in `docs/specs/CANINE_PEDIGREE_ARCHIVE_UX_SPEC.md` §18, Claude is executing the Next.js 15 UI overhaul:

1. **App Skeleton & Routes:** `/`, `/search`, `/amstaff`, `/amstaff/dog/[reg]`, `/people/[id]`, light/dark mode.
2. **Pedigree Tree Engine:** Interactive left-to-right 2–9 generation chart, unknown ancestor completeness line, auto-recentering.
3. **Instant Search:** Debounced autocomplete, GIN trigram matching across dog names, AKC registration numbers, and breeders/owners.
4. **Breeder & Dog Profiles:** Dynamic lineage attribution, historical narrative bios, whelp dates, titles, and offspring litters.
5. **Virtual Test Mating & Wright's COI %:** Real-time 8-generation path calculation between any chosen Sire and Dam.
