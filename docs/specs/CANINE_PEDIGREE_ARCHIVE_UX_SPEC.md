# CANINE PEDIGREE ARCHIVE — UX SPEC + BUILD PLAN
Hand-off doc for Claude Code · Written 2026-11-18 · Owner: Nitty

Repo: github.com/Ballinonabudget/canine-pedigree-archive (local: ~/Documents/Pedigree Database)
Current app: Next.js 15 + React 19 + TypeScript + Tailwind v4, PostgreSQL 16 (`canine_pedigree_archive`)

Read this whole doc before changing anything. Phase 0 (backup + data cleanup) comes before any UI work.

---

## 1. What this site is

A free, fast, minimal archive for tracing a dog's lineage back through the AKC stud books (1920s onward).

- **Audience, in order:** historians and breed researchers first, then owners tracing their own dog's ancestry, then breeders.
- **Benchmark:** PedigreeOnline.com. We beat it by being faster, cleaner, and giving away everything they charge for (9-generation pedigrees, COI, test matings) for free.
- **Data:** extracted from AKC Stud Book scans collected around 2008. Modern data (post-2012) does not exist. The site must be honest about that.
- **Tone:** a research library, not a social app. Quiet, confident, readable.

## 2. Locked decisions

| # | Decision | What it means for the build |
|---|---|---|
| 1 | **One database, all breeds share it.** No separate databases per breed. | Keep `canine_pedigree_archive`. Breed is a clean, normalized label on each dog. Cross-breed search is one query. |
| 2 | **Names are shown in full to everyone.** No masking. | Remove all "first name + last initial" plans. No privacy filtering layer needed. Registration numbers are also public. |
| 3 | **Launch with American Staffordshire Terrier first.** | AmStaff (including pre-1972 "Staffordshire Terrier") is the only breed visible at launch. Other breeds stay in the database but hidden until cleaned. |
| 4 | **Test mating / COI stays, as an optional tool.** | Not a main tab on every dog. Lives under a "Tools" area and as a small link on the dog page. Must show pedigree completeness next to any COI number. |
| 5 | **Google sign-in, optional.** | Nobody needs an account to see anything. Accounts are only for favorites, saved searches, and (later) submissions. |
| 6 | **No photos at launch.** | No empty photo boxes or silhouettes. Layout must look complete without images. |
| 7 | **Staffordshire Terrier = American Staffordshire Terrier.** | Same breed (AKC renamed it in 1972). Store as one breed, keep `historical_breed_label = 'Staffordshire Terrier'` on pre-1972 dogs and show it on their page. |

## 3. Phase 0 — Backup and data cleanup (BEFORE any UI work)

Do these in order. Each step: dry run first, report counts, then apply. Re-run the depth and error stats after each step.

0. **Backup.** `pg_dump -Fc` and `pg_dump -Fp` into `data/backups/` with a timestamp. Commit nothing from `data/` to git. Confirm restore works.
1. **Fix self-loops and impossible parents.** Null out `sire_reg`/`dam_reg` where they equal the dog's own reg, where sire = dam, or where the value is a placeholder (`NULL`, `null`, `B`, `D`, `(D)`, `(B)`, `UNKNOWN*`, `00000*`).
2. **Canonicalize registration numbers.** Uppercase, strip everything except A–Z, 0–9 and `/`. Split the 1990s `/01` suffix into its own `litter_code` column. Merge duplicate rows using the agent's winner rules:
   - Never merge placeholder IDs; give them `UNREG_<sheet>_<row>` IDs.
   - A full stud book entry beats a parent stub.
   - If a stub and a full row share a reg but the names are unrelated AND sex disagrees, do NOT merge — treat it as an OCR collision.
   - Between two full entries, prefer `M-D-YY` dates and parent regs that resolve to real dogs.
3. **Normalize breeds.** Merge plurals into 35 canonical breeds. Merge Staffordshire Terrier into American Staffordshire Terrier with the historical label. Add a `breed_slug` column (e.g. `amstaff`). Flag the 377 cross-breed parent links for review; for AmStaff, fix them before launch.
4. **Recover dropped parents.**
   - Pull the 338 registration numbers hidden inside `sire_name`/`dam_name` strings.
   - Create shared stub nodes for the remaining unregistered parents with key `UNREG:<BREED_SLUG>:<NORMALIZED_NAME>` so siblings link to the same parent.
   - Ingest the ~109 AmStaff 1987 Yearbook dogs (`Astaff peds 188–204`) that collided on `UNKNOWN`.
5. **Names.** Pick one display name per dog (filter junk/clipped names → strip titles/countries → prefer own full entry → else majority spelling). Keep every other spelling in `aka_names TEXT[]` and include it in search. Move titles (`CH`, `GR CH`, `CD`, `CDX`, `UD`) out of the name into `titles`. Move `(England)` etc. into a `country` column.
6. **Dates.** Add `birth_year`, `birth_month`, `birth_day`, and `date_precision` (full / month / year). Move `M-YY` stud book publication dates out of `birth_date` into `stud_book_pub_date`. Fix the 172 corrupted `sex` values.
7. **People.** Strip `/OWNER` (meaning breeder is also owner — copy into owners). Delete the literal `OWNER` person and OCR date fragments (`11-84`). Split co-owners on `&`, `AND`, `/`, `:`, `;`. Store kennels in a `kind` column (`person` / `kennel`). Do NOT auto-merge initials-only names (e.g. `J SMITH`) across breeds or decades.
8. **Source provenance.** Add `stud_book_issue` (e.g. "August 1981") from the JSON `date_header`, interpolating missing ones from neighbouring sheets. The public page shows the issue, never the image filename.
9. **Re-extract AmStaff row-shifted sheets** (`Astaff peds 39, 42, 54`) with the fixed prompt (see section 13). Boxer and Rottweiler row-shifted sheets wait until those breeds launch.
10. **Add indexes:** `dog_people(person_id)`, trigram on `aka_names`, B-tree on `breed_slug`, `birth_year`.

**Exit criteria for Phase 0 (AmStaff):** zero self-loops, zero cycles, zero cross-breed parent links, under 10 "born before parent" pairs, every AmStaff dog has a breed slug and stud book issue.

## 4. Site structure and URLs

Every page has a real URL. Today the app is one page that swaps state; that must change so pages can be bookmarked, shared and found on Google.

| URL | Page |
|---|---|
| `/` | Home: search |
| `/search?q=…&breed=…` | Full search results |
| `/amstaff` | Breed home (coverage, browse, notable dogs) |
| `/amstaff/dog/R75131` | Dog profile (default tab: pedigree) |
| `/amstaff/dog/R75131?gens=6` | Pedigree at a chosen depth |
| `/amstaff/dog/R75131/offspring` · `/siblings` · `/descendants` | Profile tabs |
| `/amstaff/litter/<sire>-<dam>-<date>` | Litter page |
| `/people/<id>-<slug>` | Person or kennel page (all breeds) |
| `/amstaff/browse/1940s` | Browse by decade |
| `/tools/test-mating` | Test mating / COI tool |
| `/about` · `/about/coverage` | What the data is, where it came from, what's missing |
| `/account` | Favorites and saved searches (signed in) |

Every page gets a proper title and description (e.g. "X-Pert Bluffer (R75131) · American Staffordshire Terrier · 1950 · Pedigree"). Replace the "Create Next App" boilerplate.

## 5. Home page

- Almost empty: site name, one-line purpose, one large search box, breed chips under it.
- At launch the only live breed is AmStaff, so the chip row shows "American Staffordshire Terrier" plus greyed "More breeds coming".
- Below the fold, three quiet entry points: **Browse by decade**, **Foundation dogs**, **About the archive**.
- No default dog loaded on the home page (today it loads RA486186, which is wrong).

## 6. Search — the most important feature

**One box searches everything.** No "choose what you're searching for" step.

**Detects what was typed:**
- Looks like a registration number (`R75131`, `R-75,131`, `RA486186`, `A-394,412`) → normalize punctuation and jump straight to that dog if there's an exact match.
- Otherwise search dog names, also-recorded-as spellings, people and kennels at once.

**Forgiving matching:**
- Ignore case, punctuation, hyphens, apostrophes, and titles ("Ch. Robin Hill Secret Weapon" found by "robin hill secret").
- Typo tolerance via trigram similarity.
- Kennel prefix search: "X-Pert" returns all X-Pert dogs.
- Matches on an alternate spelling show "matched: *also recorded as …*".

**Instant dropdown (as you type, after 2 characters):**
- Grouped: **Dogs** (up to 8), **People & kennels** (up to 5).
- Each dog row: name, titles, sex, birth year, breed, reg number. One line, no clutter.
- Each person row: name, kennel/person, number of dogs, years active (e.g. "1946–1958"). **Clicking it opens the person page** (today this click does nothing — fix).
- Keyboard: arrows to move, Enter to open, Esc to close. "/" focuses the search box anywhere on the site.

**Full results page (Enter):**
- Same groups, longer lists, paginated.
- Filters in a collapsible side panel (or a sheet on mobile): breed, sex, birth decade/year range, has titles, record type (stud book entry vs. parent reference vs. unregistered/import).
- Relationship filters: sired by, out of, bred by, owned by, descendant of.
- Active filters shown as removable chips.
- Sort: best match (default), oldest first, newest first, name A–Z.
- Empty state: suggest a looser search and explain coverage gaps ("Our AmStaff records are thin for 1954–1966").

## 7. Dog profile

**Header (always visible):**
- Name (large), titles as small badges, also-recorded-as spellings in small text.
- One line of facts: sex · born (with precision: "Sept 8, 1950" / "Apr 1978" / "1946") · color · breed (with "registered as Staffordshire Terrier" if pre-1972).
- Registration number with a copy button.
- Sire and dam as links.
- Breeder(s) and owner(s) in full, each a link to their person page.
- Source line: "AKC Stud Book, August 1981". Record type badge: **Stud book entry**, **Parent reference only**, or **Unregistered / import**.
- Favorite (heart) and Share buttons.

**Tabs:** Pedigree (default) · Offspring · Siblings & litter · Descendants · Details.

**Short biography:** keep it factual and short. Drop filler like "unites key foundation lineages". Never show image filenames. Fix the bug that prints the granddam's reg instead of the dam's.

**Parent-reference pages (stubs):** clearly say "This dog is known only as a parent in the records we have." Show what we do know (offspring, first stud book appearance) instead of empty fields.

## 8. Pedigree chart — the centerpiece

- **Depth selector:** 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 generations. Default 4. Remember the user's last choice.
- Built from **one recursive query with cycle protection** (replace the one-query-per-ancestor code).
- Layout: classic left-to-right bracket. Sire's line on top, dam's line below, with a subtle tint difference. Generations 5–9 switch to compact one-line cards (name · reg).
- **Every ancestor is clickable** and re-centers the chart on that dog (updates the URL). Hover/tap shows a small card: name, titles, born, reg, offspring count.
- **Breadcrumb trail** of dogs you've clicked through, so you can walk back.
- **Common ancestors toggle:** highlights any dog that appears more than once, each in its own color, with a small legend listing them and how many times each appears.
- **Missing ancestors:**
  - Named but unregistered (imports, early dogs): show the name with a small "Unregistered / import" tag.
  - Totally unknown: a quiet, light "Unknown" slot. Never use the phrase "Not Ingested".
  - When a whole branch is unknown beyond a point, collapse it to one "Records end here" note instead of rows of empty boxes.
- **Completeness line** under the chart: "38 of 62 ancestors known (61%)".
- **Print / export:** clean printable pedigree (PDF) with site name, date, and the dog's source line.
- **Mobile:** horizontal scroll with pinch-zoom, or a vertical "walk up the tree" view (tap sire/dam to go up one level). Must be usable one-handed at a dog show.

## 9. Other profile tabs

- **Offspring:** table of every recorded puppy — name, sex, born, other parent, link to litter. Grouped by litter, newest first, with totals ("42 offspring in 9 litters").
- **Siblings & litter:** littermates (same sire, dam, and birth date) first, then full siblings, then half siblings by sire and by dam.
- **Descendants:** downward tree/list up to 5 generations with counts per generation. Useful for "how influential was this dog".
- **Details:** all raw fields, every source issue the dog appears in, every spelling recorded, and a "Report an error" link.

## 10. Person and kennel pages

- Name in full, kind (person or kennel), years active (from their dogs' birth dates).
- Two lists: **Dogs bred** and **Dogs owned**, grouped by breed, then sorted by year. Each list is filterable and sortable.
- Small summary: total dogs, first and last year, most-used sires and dams in their breeding.
- If the same name might be multiple people (initials-only names across decades), show a gentle note: "This name may refer to more than one person."
- Co-owners link to each other.

## 11. Breed home and history features (AmStaff at launch)

- **Coverage panel:** a simple bar chart of dogs per year, so gaps (1954–1966, 1981–1983, 1990–1993) are visible and honest. One line: "Records from AKC Stud Books, 1928–1999. Coverage is uneven; see gaps."
- **Browse by decade:** list of dogs born in that decade, filterable.
- **Foundation dogs:** earliest dogs in the archive.
- **Most influential sires and dams:** ranked by recorded offspring and by descendants.
- **Notable kennels:** kennels with the most dogs bred, with active years.
- **Chronicles:** the historical articles (today 2) live here as "Breed history", linked both ways with dog pages. Rewritten summaries only — never publish scans of copyrighted magazines or books.

## 12. Tools — Test mating and COI (optional)

- Lives at `/tools/test-mating`, plus a small "Test a mating with this dog" link on dog pages. Not a main tab.
- Pick a sire and dam (same search box behavior). Shows the hypothetical puppy's pedigree, common ancestors, and COI.
- **Every COI number shows depth and completeness:** "5-gen COI: 6.25% (based on 42% known ancestors)". If completeness beyond the parents is under 25%, show "Not enough data" instead of a number.
- The dog's own COI appears only in the Details tab with the same caveat.

## 13. Before ingesting any more scans (other breeds)

Apply the extraction and ingest fixes from the audit (Q64): row-shift prevention in the prompt and a row-shift guard in ingest; separate whelp dates from stud book publication dates; reg normalization and `/01` split at ingest; never drop unregistered named parents; breed lookup map plus reg-prefix check (R = Terrier, W = Working); split breeders/owners at ingest. Then process: the 59 cached JSONs, remaining Boxer sheets, Samsung 1989–1991 and 2010–2012, Ped Books (includes 1960 — fills the big AmStaff gap).

Each new breed launches only when it passes the Phase 0 exit criteria.

## 14. Accounts (Google sign-in via Auth.js)

- Signed out: everything readable.
- Signed in: favorites, saved searches (with "notify me when new records are added" later), pedigree depth preference.
- Separate tables for users, favorites, saved searches. Keep them apart from the stud book tables.
- Later: user submissions (dogs, photos, corrections) go to a moderation queue and are always labeled **Community submitted**, never mixed with stud book records.

## 15. Visual direction

- Minimal and modern. Generous white space, one typeface family for UI plus a monospace for reg numbers, one accent color.
- Light mode default with a dark mode toggle (today's app is dark-only slate/emerald — revisit).
- No decorative badges or hashtags (drop the auto "bloodline tags" like #Ruffian unless they're real kennel prefixes).
- Data density on demand: summaries first, details behind tabs and expanders.
- Fast: search results under 200 ms, dog page under 1 second on a phone.
- Accessible: keyboard navigation everywhere, readable contrast, sire/dam distinction not by color alone.

## 16. Known bugs to fix during the rebuild

- Person rows in search dropdown don't click.
- `bio.ts` prints the granddam's reg in place of the dam's.
- Bio shows image filenames ("Astaff peds 181.JPG") as the source.
- Pedigree is hardcoded to 4 generations and makes one query per ancestor.
- No URLs per dog; page title is "Create Next App".
- Home page hardcodes RA486186 (comment says Bearcat, data says Buck's Iron Spike).
- Missing ancestor cards say "Unknown / Not Ingested".

## 17. Hosting

Single VPS (Hetzner, DigitalOcean or IONOS, roughly $5–8/month) running Next.js and PostgreSQL on the same machine. Nightly `pg_dump` backup copied off the server. Keep `GEMINI_API_KEY` off the server unless ingestion runs there.

## 18. Launch checklist (AmStaff v1)

- [ ] Backup made and restore tested
- [ ] Phase 0 steps 1–10 applied for AmStaff, exit criteria met
- [ ] Real URLs for dog, person, litter, breed pages
- [ ] Search: reg detection, fuzzy names, aka names, people, filters
- [ ] Pedigree 2–9 generations, common ancestors, completeness, print
- [ ] Offspring, siblings/litter, descendants tabs
- [ ] Person/kennel pages
- [ ] Breed home with coverage chart, decades, foundation dogs, influential sires/dams
- [ ] Test mating tool with completeness rule
- [ ] Google sign-in, favorites
- [ ] About + coverage pages
- [ ] Mobile pass at phone width
- [ ] Titles and descriptions on every page, sitemap for search engines
- [ ] Deployed to VPS with nightly backups

## 19. Not in v1

Photos, user submissions, other breeds, saved-search alerts, paid anything.
