"""
Colour ledger: our own list of colours, spelled out in full.

The stud books abbreviate colours many ways ("BLK & WH", "Blk, wh", "FNWHMKGS", "Brindle, white markings").
This step builds `color_ledger`, one row per distinct raw text, with the colour written in full words:

    BLK & WH            -> Black and white
    FNWHMKGS            -> Fawn, white markings
    FN BLK MSK & WH     -> Fawn, black mask and white
    BLK BRDL & WH       -> Black brindle and white
    BLKTN               -> Black and tan

and sets `dogs.color` from it. The printed text stays untouched in `dogs.color_code` (shown in Details).

Rows the reader can't fully understand (OCR fragments like "FwnWkfg") get status 'unresolved', no colour,
and the list of unknown pieces, so they can be fixed by hand. Rows marked status 'manual' are never
overwritten, so hand corrections survive re-runs. Re-runnable.

Usage: python scripts/migrations/110_color_ledger.py [--apply]
"""
import re
from collections import Counter
from functools import lru_cache

from psycopg2.extras import execute_values

from lib import run_step

# Abbreviations used in the stud books -> full word
ABBR = {
    "fn": "fawn", "fwn": "fawn",
    "wh": "white", "wht": "white", "whi": "white", "wte": "white",
    "blk": "black", "bk": "black", "blck": "black",
    "brdl": "brindle", "brndl": "brindle", "brin": "brindle", "brind": "brindle", "brdle": "brindle", "bdl": "brindle",
    "br": "brown", "brn": "brown",
    "rd": "red",
    "bl": "blue", "blu": "blue",
    "gr": "gray", "gry": "gray", "grey": "gray",
    "tn": "tan",
    "gldn": "golden", "gld": "golden",
    "sbl": "sable",
    "slvr": "silver", "slv": "silver",
    "cr": "cream", "crm": "cream",
    "liv": "liver", "lvr": "liver",
    "mrl": "merle", "bm": "blue merle",
    "mhgy": "mahogany", "mahog": "mahogany",
    "rst": "rust",
    "whtn": "wheaten",
    "twny": "tawny",
    "sndy": "sandy",
    "bdgr": "badger",
    "grzl": "grizzle", "grzld": "grizzle",
    "choc": "chocolate",
    "msk": "mask", "sk": "mask",
    "mkgs": "markings", "mkg": "markings", "mks": "markings", "mk": "markings", "marking": "markings", "mkngs": "markings",
    "pts": "points",
    "chst": "chest", "chs": "chest",
    "hd": "head",
    "mzl": "muzzle", "muz": "muzzle",
    "dk": "dark", "drk": "dark",
    "lt": "light", "lght": "light",
    "w": "with",
    "ft": "feet",
    # OCR misreadings seen in the scans ("Wh Mkgs" read as "Wkgs", "Brdl" missing its B)
    "wkgs": "white markings", "wkkgs": "white markings", "wkfg": "white markings", "wk": "white",
    "brl": "brindle", "rdl": "brindle", "brcl": "brindle", "brdi": "brindle",
    "hlqn": "harlequin", "wlf": "wolf", "chcl": "charcoal", "thny": "tawny", "mg": "markings", "kgs": "markings", "wn": "white",
    # Misspellings found in the first unresolved review (Nov 2026)
    "brd": "brindle", "brds": "brindle", "brh": "brindle", "brid": "brindle", "bril": "brindle", "brill": "brindle",
    "brinde": "brindle", "brld": "brindle", "brsl": "brindle", "brul": "brindle", "erdl": "brindle", "rrdl": "brindle",
    "badl": "brindle", "brol": "brindle",
    "fln": "fawn", "fdn": "fawn", "fld": "fawn",
    "mas": "mask", "mssk": "mask", "smk": "mask", "rsk": "mask", "mki": "mask",
    "bkl": "black", "bln": "black", "wt": "white", "whte": "white", "wm": "white",
    "mzzle": "muzzle", "mz": "muzzle", "muckle": "muzzle",
    "marks": "markings", "mrkgs": "markings", "mksg": "markings", "rkg": "markings", "ngs": "markings", "msks": "markings",
    "whkg": "white markings", "wlmkg": "white markings", "whitings": "white markings",
    "trmgs": "trimmings",
    "silvr": "silver", "ylw": "yellow", "mhgny": "mahogany", "mhty": "mahogany",
    "spts": "spots", "spt": "spot", "badge": "badger",
}
COLORS = {
    "black", "white", "tan", "fawn", "brindle", "red", "blue", "gray", "brown", "golden", "gold", "sable", "silver", "cream",
    "liver", "merle", "mahogany", "rust", "wheaten", "tawny", "sandy", "badger", "grizzle", "chocolate", "orange", "lemon",
    "apricot", "yellow", "wolf", "pepper", "salt", "seal", "chestnut", "buckskin", "buff", "harlequin", "mantle", "roan",
    "tricolor", "bicolor", "steel", "slate", "isabella", "smoke", "biscuit", "champagne", "charcoal", "ebony", "bronze", "honey",
}
PARTS = {
    "mask", "markings", "points", "chest", "head", "muzzle", "feet", "foot", "ears", "ear", "eye", "eyes", "saddle", "trim",
    "spots", "spot", "blaze", "collar", "ticking", "ticked", "legs", "tail", "face", "toes", "toe", "patches", "patch", "shadings",
    "trimmings", "breast",
}
MODS = {"dark", "light", "pale", "deep", "bright", "clear", "mixed", "tiger"}
GLUE = {"on", "with", "of", "around"}
# Second word that forms one colour with the word before it ("black brindle", "blue merle", "red fawn")
COMPOUND_TAIL = {"brindle", "sable", "merle", "fawn", "gray", "grizzle", "roan"}
KNOWN = set(ABBR) | COLORS | PARTS | MODS | GLUE

# Whole spellings whose reading was decided by hand: too garbled for the rules above, or the rules read them clumsily.
EXACT = {
    "Bld": "Brindle",
    "BLD BRDL, BLK MSK": "Brindle, black mask",
    "Gldn fin, blk msk": "Golden fawn, black mask",
    "Fp, blk msk": "Fawn, black mask",
    "Flk msk": "Fawn, black mask",
    "FwnhonChst": "Fawn, white on chest",
    "FN PLAIN": "Fawn, plain",
    "brdl, lk msk": "Brindle, black mask",
    "Fn, blk mskgs": "Fawn, black mask",
    "Wh, lmn tkd ears": "White, lemon ticked ears",
    "Brdl, wh spt on chest": "Brindle, white spot on chest",
    "Gldn blkm sk, blkm sk, wh": "Golden, black mask, white",
    "BRDL BROL & WH": "Brindle and white",
    "Honey Br, blk msk": "Honey brown, black mask",
    "Wh brdl spts": "White, brindle spots",
    "GR BRD": None,  # a Collie: "gray brindle" is unlikely, so left for the scan
}


@lru_cache(maxsize=None)
def segment(tok):
    """Split a run-together code like 'fnwhmkgs' into known pieces; None if it can't be done."""
    if tok in KNOWN:
        return (tok,)
    best = None
    for i in range(len(tok) - 1, 1, -1):  # pieces are at least 2 letters
        head = tok[:i]
        if head in KNOWN:
            rest = segment(tok[i:])
            if rest is not None and (best is None or 1 + len(rest) < len(best)):
                best = (head,) + rest
    return best


def words_of(raw):
    """-> (groups, unknown). groups: list of (separator_before, [words])."""
    t = raw.lower().replace("[", " ").replace("]", " ")
    t = re.sub(r"\bm\s+sk\b", "msk", t)                   # OCR split of MSK
    t = re.sub(r"\bbr\s+dl\b", "brdl", t)                 # OCR split of BRDL
    t = re.sub(r"\bblkm\s+sk\b", "blk msk", t)             # "blkm sk" = BLK MSK
    parts = re.split(r"\s*(&|,|;|/|\+|\band\b)\s*", t)
    groups, unknown, sep = [], [], None
    for p in parts:
        if p in ("&", ",", ";", "/", "+", "and"):
            sep = ", " if p in (",", ";") else " and "
            continue
        words = []
        for tok in re.findall(r"[a-z]+", p):
            seg = segment(tok)
            if seg is None:
                if tok == "m" and words and words[-1] == "white":
                    words.append("markings")             # "WH M" = white markings cut short
                else:
                    unknown.append(tok)
                continue
            for s in seg:
                words.extend(ABBR.get(s, s).split() if s != "bl" else ["bl?"])
        # "bl" is blue ("Bl & tn", "Bl merle") except before mask/muzzle, where boxer books mean black
        words = [("black" if i + 1 < len(words) and words[i + 1] in ("mask", "muzzle", "points") else "blue") if w == "bl?" else w
                 for i, w in enumerate(words)]
        if words:
            groups.append((sep if groups else None, words))
        sep = None
    return groups, unknown


def phrases(words):
    """Group words into phrases: 'fawn', 'black mask', 'white on chest', 'black brindle'."""
    out, cur = [], []
    i = 0
    while i < len(words):
        w = words[i]
        if w in GLUE and (not cur or i + 1 >= len(words)):
            i += 1                                       # dangling "on" / "with"
            continue
        if w in GLUE and cur and i + 1 < len(words):
            cur += [w, words[i + 1]]
            i += 2
            if i < len(words) and words[i] in PARTS:      # "white on chest" / "black on head"
                continue
            continue
        if w in PARTS and not cur and out and out[-1][-1] in PARTS and w == "markings":
            out[-1].append(w)                            # "badger head markings"
        elif w in PARTS:
            cur.append(w)
            out.append(cur)
            cur = []
        elif w in COLORS:
            if cur and cur[-1] in COLORS and w not in COMPOUND_TAIL:
                out.append(cur)
                cur = [w]
            elif cur and cur[-1] in COLORS and w in COMPOUND_TAIL and len(cur) >= 2:
                out.append(cur)
                cur = [w]
            else:
                cur.append(w)
        else:  # modifier
            if cur and cur[-1] in COLORS:
                out.append(cur)
                cur = []
            cur.append(w)
        i += 1
    if cur:
        out.append(cur)
    # drop immediate repeats ("white white")
    dedup = []
    for p in out:
        if not dedup or dedup[-1] != p:
            dedup.append(p)
    return dedup


def render(groups):
    all_phrases = [p for _, words in groups for p in phrases(words)]
    if all_phrases and all(all(w in COLORS or w in MODS for w in p) for p in all_phrases):
        # Only colours, however they were separated: "Brdl, wh" = "BRDL & WH" = "Brindle and white"
        names = [" ".join(p) for p in all_phrases]
        dedup = [n for i, n in enumerate(names) if n not in names[:i]]
        text = dedup[0] if len(dedup) == 1 else ", ".join(dedup[:-1]) + " and " + dedup[-1]
        return text[:1].upper() + text[1:]
    chunks = []
    for sep, words in groups:
        ps = phrases(words)
        plain = all(len(p) == 1 and p[0] in COLORS for p in ps)
        inner = " and ".join(" ".join(p) for p in ps) if plain else ", ".join(" ".join(p) for p in ps)
        chunks.append((sep, inner))
    text = ""
    for sep, inner in chunks:
        text += (sep or "") + inner
    text = re.sub(r"\s+", " ", text).strip(" ,")
    # "black and tan and white" reads better as "black, tan and white"
    pieces = text.split(" and ")
    if len(pieces) > 2 and all("," not in p for p in pieces):
        text = ", ".join(pieces[:-1]) + " and " + pieces[-1]
    return text[:1].upper() + text[1:] if text else None


def canonical(raw):
    if raw in EXACT:
        return EXACT[raw], ([] if EXACT[raw] else ["(see scan)"])
    groups, unknown = words_of(raw or "")
    color = render(groups) if groups else None
    return color, unknown


def slug(color):
    return re.sub(r"[^a-z0-9]+", "-", color.lower()).strip("-") if color else None


def body(cur, report):
    cur.execute("""create table if not exists color_ledger (
        raw text primary key,
        color varchar(120),
        color_slug varchar(120),
        status varchar(12) not null,          -- auto | unresolved | manual
        unknown text[] not null default '{}',
        dogs int not null default 0)""")
    cur.execute("alter table dogs add column if not exists color varchar(120)")
    cur.execute("create index if not exists idx_dogs_color on dogs (lower(color))")

    cur.execute("select color_code, count(*) from dogs where color_code is not null and btrim(color_code) <> '' group by 1")
    raws = cur.fetchall()
    cur.execute("select raw from color_ledger where status = 'manual'")
    manual = {r[0] for r in cur.fetchall()}

    rows, status = [], Counter()
    for raw, n in raws:
        if raw in manual:
            status["manual (kept)"] += 1
            continue
        color, unknown = canonical(raw)
        st = "unresolved" if unknown or not color else "auto"
        status[st] += 1
        rows.append((raw, color if st == "auto" else None, slug(color) if st == "auto" else None, st, unknown, n))
    execute_values(cur, """insert into color_ledger (raw, color, color_slug, status, unknown, dogs) values %s
        on conflict (raw) do update set color = excluded.color, color_slug = excluded.color_slug, status = excluded.status,
        unknown = excluded.unknown, dogs = excluded.dogs
        where color_ledger.status <> 'manual'""", rows)

    cur.execute("""update dogs d set color = l.color from color_ledger l
                   where l.raw = d.color_code and d.color is distinct from l.color""")
    report["dogs whose colour was set/changed"] = cur.rowcount
    report["distinct raw colours"] = len(raws)
    report["ledger rows by status"] = dict(status)
    cur.execute("select count(distinct color) from color_ledger where color is not null")
    report["distinct colours after spelling out"] = cur.fetchone()[0]
    cur.execute("""select count(*) filter (where color is not null), count(*) filter (where color_code is not null) from dogs""")
    a, b = cur.fetchone()
    report["dogs with a readable colour / with any colour"] = f"{a} / {b}"
    cur.execute("select raw, color from color_ledger where status = 'auto' order by dogs desc limit 25")
    report["most common (raw -> colour)"] = cur.fetchall()
    cur.execute("select raw, unknown, dogs from color_ledger where status = 'unresolved' order by dogs desc limit 12")
    report["unresolved, most dogs first (raw, unknown pieces, dogs)"] = cur.fetchall()


if __name__ == "__main__":
    run_step("110_color_ledger", body)
