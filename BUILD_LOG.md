# BUILD LOG: 0-to-100 Canine Pedigree & Historical Archive Platform

This chronological build diary documents every architectural layer, milestone, bug, and resolution for the YouTube AI Case Study.

---

### Layer 1: Local File Discovery & Audit (`2026-11-14T19:00:00-05:00`)

- **Timestamp & Layer:** `2026-11-14 19:00 EST` — `Layer 1: Local File Discovery & Audit`
- **What We Planned:** Initialize the project workspace, create `/docs/screenshots/`, and scan all connected storage volumes on the M1 Mac (`/Volumes`, Box Drive, and Synology NAS mounts) to catalog every scanned AKC Stud Book sheet and historical breed article, separating tabular pedigree records from periodical write-ups and selecting the optimal target breed for our Proof-of-Concept (PoC).
- **What Actually Happened:**
  1. Initialized `/docs/screenshots/` and audited `/Volumes` and `~/Library/CloudStorage`.
  2. Located the mounted Samsung external drive at `/Volumes/Sam Tsung` (`Box` and `Synology NAS` are not currently mounted locally).
  3. Isolated the pedigree archives inside `/Volumes/Sam Tsung/Doberman Pinscher Studbook` and `/Volumes/Sam Tsung/Dog Ped stuff` (strictly ignoring unrelated folders on the external drive).
  4. Audited **2,750 valid pedigree/archive image files** across 6 distinct collections:
     - **American Staffordshire Terrier (` Dog Ped stuff/American Staffordshire Terrier`)**: **211 JPGs** (`Astaff peds 1.JPG` – `Astaff peds 211.JPG`) — Clean 1970s AKC Stud Book tabular sections (~15–22 dogs per sheet, ~3,500–4,200 dogs total) with `OWNER / BREEDER` delimited by `/`. Selected as our **Primary PoC Target Breed**.
     - **Amstaff Historical Periodicals & Articles (`Dog Ped stuff/Pedigrees/Amstaff pedigrees`)**: **429 JPGs** (`PTDC0416.JPG` – `PTDC0844.JPG`) — Rich historical archive including a July 24, 1936 letter to the AKC Executive Vice-President regarding the first registered Staffordshire Terrier (*Wheeler's Black Dinah*, `#A 86066`), *STCA* magazine features (*"Staffs from the Past: Ch. White Rock Jet Bomber and White Rock Grover"*), and 1980s champion stud/pedigree profiles. Selected for our **"Amstaff & Breed Chronicles" Historical Archives Tab**.
     - **Doberman Pinscher Studbook (`Doberman Pinscher Studbook`)**: **634 JPGs** — 1950s–1970s AKC Stud Book sheets (e.g., 1956–1957 pages with ~65 rows per page).
     - **Multi-Breed AKC Stud Book 1989–1991 (`Dog Ped stuff/Pedigrees/100MEDIA`)**: **415 JPGs** (`PTDC0001.JPG` – `PTDC0415.JPG`) — Covers Bernese Mountain Dogs, Border Terriers, Boxers, Australian Terriers, Bedlington Terriers, and American Staffordshire Terriers.
     - **Modern Multi-Breed AKC Stud Book 2010–2012 (`Dog Ped stuff/Dog Pedss/100MEDIA`)**: **963 JPGs** (`PTDC0001.JPG` – `PTDC0967.JPG`) — Group 3 (Working: Akitas, Alaskan Malamutes) and Group 4 (Terrier: Airedales, Amstaffs, West Highland White Terriers, Manchester Terriers).
     - **Joseph L. Colby 1936 Book & APBT Reference Photos (`APBT by JLC` & `APBT images`)**: **98 JPGs** (47 book pages + 51 historical dog photos).
- **Hiccup / Error Encountered:**
  1. When running our first Python orientation audit script using the default macOS Xcode Python (`/usr/bin/python3`, v3.9), it crashed with `ModuleNotFoundError: No module named 'PIL'`.
  2. Visual inspection of the scanned JPEGs revealed three major orientation & formatting traps that would break a naive OCR script:
     - **Sideways Scans:** 86% of the `American Staffordshire Terrier` Stud Book crops and ~33% of the `Amstaff pedigrees` magazine articles (e.g., `PTDC0502.JPG`) are rotated 90° counter-clockwise (`width > height` or vertical text lines).
     - **Upside-Down Scans:** Several pages in `Pedigrees/100MEDIA` (such as `PTDC0415.JPG`) were scanned 180° upside-down!
     - **Column Order Shift Across Eras:** 1950s Doberman sheets and 1989–1991 sheets list the 4th column header as `OWNER | BREEDER` (two sub-columns) or `OWNER/BREEDER`, whereas 1979 Amstaff sheets and 2010–2012 sheets use a single `/` delimiter (`BREEDER / OWNER` or `OWNER / BREEDER` depending on the issue).
- **How We Resolved It (Plain English Translation):**
  > *"When we plugged in the Samsung drive and ran our first automated scan of the 2,750 pedigree files, we immediately hit two classic real-world data problems. First, macOS's built-in Python didn't have image processing libraries installed, so we spun up an isolated Python 3.13 environment on our M1 chip. Second—and way more important—when we actually looked at the raw scans, they weren't uniform at all. Over 80% of the Amstaff stud book pages and a third of the vintage magazine articles were scanned sideways at a 90-degree angle, and some of the 1990s pages were literally 180 degrees upside-down! If you feed upside-down or sideways dense tables straight into an OCR pipeline without fixing orientation first, your accuracy tanks. Catching this in Layer 1 means we can build an auto-rotation preprocessor in Phase 4 that detects 90-degree and 180-degree flips before Gemini ever sees the page."*
- **Visual Evidence:** `01-drive-audit.png` (saved in `/docs/screenshots/01-drive-audit.png`)

---

### Layer 2: Box Cloud Archive Audit (`Pedigrees.co` — 14,929 Files) & M1 Resource / Local PostgreSQL 16 Setup (`2026-11-15T02:30:00-05:00`)

- **Timestamp & Layer:** `2026-11-15 02:30 EST` — `Layer 2: Box Cloud Archive Audit & M1 Resource / Local PostgreSQL 16 Setup`
- **What We Planned:**
  1. Audit the newly mounted Box Drive directory (`/Users/daplug/Library/CloudStorage/Box-Box/Pedigrees.co`) to catalog all 30+ breed folders.
  2. Audit the M1 Mac's pre-installed binaries, runtimes, and databases before installing anything new.
  3. Stand up our PostgreSQL relational database (`dogs`, `people`, `dog_people`, `historical_articles` + `pg_trgm` fuzzy-search GIN indexes) immediately using pre-installed resources so development is never blocked on external cloud setup.
- **What Actually Happened:**
  1. **M1 Mac Resource Audit:** Confirmed the Mac already had **PostgreSQL 16.15** (`/opt/homebrew/bin/postgres`), **Node.js v26.12.0**, **npm 11.20.0**, **Python 3.13**, **Tesseract OCR**, **ImageMagick**, **ExifTool**, **FFmpeg**, and **Git 2.54.0** (with an active SSH key authenticated to GitHub as `@Ballinonabudget`). The only missing CLI was `gh` (GitHub CLI), which we installed via Homebrew (`gh 2.104.0`).
  2. **Box Drive (`Pedigrees.co`) Full Inventory (14,929 Total Files across 30 Folders):**
     - **Rottweiler (`57 JPGs`) & Rottiweilder (`58 JPGs`)**: **115 JPGs total** — 1950s AKC Stud Book pages (rotated 90° CCW).
     - **Whippet Pedigrees (`89 JPGs`)**, **Ridgeback (`99 JPGs`)**, **Bullmastiff (`132 JPGs`)**: Compact single-breed champion & pedigree books (1955–1980).
     - **American Staffordshire Terrier (`229 JPGs`)**: Expanded version of the Samsung drive's 211 Stud Book pages (+18 additional sheets!).
     - **Amstaff Pedigrees (`428 JPGs`) + American Staffordshire Terrier Club Year Book (`644 JPGs`)**: Complete STCA Yearbooks (`1940`, `1977`, `1978`, `1980`) + historical magazine articles.
     - **Boxers (`567 JPGs`) + Boxer ped pic (`278 JPGs`) + Boxer 2 (`22 files`)**: **867 Boxer files** (1980 AKC Stud Book tables + illustrated pedigrees).
     - **Doberman Pinscher Studbook (`634 JPGs`) + Doberman CH 1952–1991 & UK (`701 files`)**: **1,335 Doberman files**.
     - **Ped Books (`3,293 JPGs`)**: Complete monthly AKC Stud Book issues (`May–June 1960`, `Dec 1999`, `Jan–Aug 2000`, `Jan 2007`).
     - **Working Group (`675 JPGs`)**, **Peds (`356 JPGs`)**, **Overseas Pedigrees (`185 JPGs`)**: **1,216 files**.
     - **Stud Books PDF (`17 files`)**: 1874–1884 UK & AKC Stud Books (`AKC VI`, `AKC VII`, `AKC XVIII`) — **including pre-extracted `.rtf` text files!**
     - **Additional Reference Collections**: `Adding Pic` (2,705), `Oldschoolreds` (2,096), `ANTOHIN KENNEL PIC` (1,542), `Added Pic` (597), `APBT Books` (287), `SDJ Mags` (23), `AMstaff Pic` (8), `AGDT` (7).
  3. **Zero-Friction Local PostgreSQL 16 Launch & Schema Migration:**
     - Started the M1 Mac's native `postgresql@16` service (`brew services start postgresql@16`).
     - Created database `canine_pedigree_archive`, enabled the `pg_trgm` extension, and migrated all 4 core tables (`dogs`, `people`, `dog_people`, `historical_articles`) plus 10 B-Tree and GIN trigram indexes.
- **Hiccup / Error Encountered:**
  1. While `ssh -T git@github.com` succeeded immediately (`Hi Ballinonabudget!`), the newly installed `gh` CLI requires a one-time OAuth token (`gh auth login`) before it can call GitHub's REST API to create the remote repository (`canine-pedigree-archive`).
  2. In Box Drive, `BullMastiff  1.JPG` is rotated **90° clockwise** (`CW`), whereas `Rottweiler 002.JPG` and `Astaff peds 10.JPG` are rotated **90° counter-clockwise** (`CCW`).
- **How We Resolved It (Plain English Translation):**
  > *"Before installing a single new database tool or paying a dime for hosting, we audited what was already sitting dormant on this M1 Mac—and struck gold. PostgreSQL 16, Tesseract OCR, and ImageMagick were already installed, just turned off! In five seconds we woke up local Postgres 16, enabled fuzzy trigram search, and migrated our entire four-table pedigree schema for $0. Meanwhile, Box finished mounting `Pedigrees.co`, unlocking nearly 15,000 archival scans across 30 folders—including 1940 Amstaff Yearbooks, 867 Boxer sheets, and 115 Rottweiler sheets. Even wilder: we noticed the Bullmastiff scans are rotated 90 degrees clockwise while the Rottweiler and Amstaff scans are rotated 90 degrees counter-clockwise, proving why our Phase 4 preprocessor has to detect text direction rather than blindly rotating everything the same way."*
- **Visual Evidence:** `02-box-and-resource-audit.png` (saved in `/docs/screenshots/02-box-and-resource-audit.png`)
