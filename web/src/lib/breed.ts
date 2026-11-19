// Breed home, person summaries, breed history and coverage.
import { cacheLife } from 'next/cache';
import { pool } from './db';

type DogRef = { reg_number: string; name: string; titles: string | null; sex: string; birth_year: number | null; breed_slug: string | null };
export type Ranked = DogRef & { n: number };
export type BreederRank = { id: number; full_name: string; kind: string; n: number; first_year: number | null; last_year: number | null };

export type BreedHome = {
  decades: { decade: number; n: number }[];
  topSiresByOffspring: Ranked[];
  topDamsByOffspring: Ranked[];
  topByDescendants: Ranked[];
  breeders: BreederRank[];
};

export async function getBreedHome(slug: string): Promise<BreedHome> {
  'use cache';
  cacheLife('hours');
  const parentRank = (col: 'sire_reg' | 'dam_reg') =>
    pool.query<Ranked>(
      `select p.reg_number, p.name, p.titles, p.sex, p.birth_year, p.breed_slug, count(*)::int as n
       from dogs c join dogs p on p.reg_number = c.${col} where c.breed_slug = $1
       group by p.reg_number order by n desc, p.birth_year nulls last limit 10`,
      [slug],
    );
  const [decades, sires, dams, desc, breeders] = await Promise.all([
    pool.query<{ decade: number; n: number }>(
      `select (birth_year / 10 * 10)::int as decade, count(*)::int as n from dogs where breed_slug = $1 and birth_year is not null group by 1 order by 1`,
      [slug],
    ),
    parentRank('sire_reg'),
    parentRank('dam_reg'),
    pool.query<Ranked>(
      `with recursive down(root, reg, depth) as (
         select p.reg_number, c.reg_number, 1 from dogs p join dogs c on c.sire_reg = p.reg_number or c.dam_reg = p.reg_number where p.breed_slug = $1
         union
         select d.root, c.reg_number, d.depth + 1 from down d join dogs c on c.sire_reg = d.reg or c.dam_reg = d.reg where d.depth < 5),
       counts as (select root, count(distinct reg)::int as n from down group by root order by n desc limit 10)
       select p.reg_number, p.name, p.titles, p.sex, p.birth_year, p.breed_slug, counts.n
       from counts join dogs p on p.reg_number = counts.root order by counts.n desc`,
      [slug],
    ),
    pool.query<BreederRank>(
      `select p.id, p.full_name, p.kind, count(*)::int as n, min(d.birth_year)::int as first_year, max(d.birth_year)::int as last_year
       from dog_people dp join people p on p.id = dp.person_id join dogs d on d.reg_number = dp.dog_reg
       where dp.role = 'B' and d.breed_slug = $1 group by p.id order by n desc, p.full_name limit 12`,
      [slug],
    ),
  ]);
  return { decades: decades.rows, topSiresByOffspring: sires.rows, topDamsByOffspring: dams.rows, topByDescendants: desc.rows, breeders: breeders.rows };
}

/** Sires and dams a breeder used most. */
export async function getBreederParents(personId: number): Promise<{ sires: Ranked[]; dams: Ranked[] }> {
  'use cache';
  cacheLife('hours');
  const q = (col: 'sire_reg' | 'dam_reg') =>
    pool.query<Ranked>(
      `select p.reg_number, p.name, p.titles, p.sex, p.birth_year, p.breed_slug, count(*)::int as n
       from dog_people dp join dogs c on c.reg_number = dp.dog_reg join dogs p on p.reg_number = c.${col}
       where dp.person_id = $1 and dp.role = 'B' group by p.reg_number order by n desc, p.name limit 5`,
      [personId],
    );
  const [s, d] = await Promise.all([q('sire_reg'), q('dam_reg')]);
  return { sires: s.rows, dams: d.rows };
}

export type Article = {
  id: number;
  title: string;
  publication_era: string | null;
  summary_rewrite: string;
  mentions: { label: string; dog: DogRef | null }[];
};

const strip = (s: string) =>
  s
    .replace(/^(ch\.?|gr\.?\s*ch\.?|int\.?\s*ch\.?)\s+/i, '')
    .replace(/,\s*(cd|cdx|ud|rom)\.?$/i, '')
    .trim();

/** Breed history articles (rewritten summaries only), with mentioned dogs matched to archive records where possible. */
export async function getArticles(slug: string): Promise<Article[]> {
  'use cache';
  cacheLife('hours');
  const a = await pool.query<{ id: number; title: string; breed: string; publication_era: string | null; summary_rewrite: string; mentioned_dogs: string[] | null }>(
    `select h.id, h.title, h.breed, h.publication_era, h.summary_rewrite, h.mentioned_dogs
     from historical_articles h join breeds b on b.slug = $1
     where h.breed = b.name or h.breed in (select distinct historical_breed_label from dogs where breed_slug = $1 and historical_breed_label is not null)
     order by h.id`,
    [slug],
  );
  const labels = [...new Set(a.rows.flatMap((r) => r.mentioned_dogs ?? []))];
  const keys = labels.map((l) => strip(l).toUpperCase());
  const regs = labels.map((l) => l.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const found = labels.length
    ? await pool.query<DogRef & { k: string }>(
        `select distinct on (k) k, d.reg_number, d.name, d.titles, d.sex, d.birth_year, d.breed_slug
         from unnest($2::text[], $3::text[]) as m(k, r)
         join dogs d on d.breed_slug = $1 and (upper(d.name) = m.k or d.reg_number = m.r)
         order by k, d.is_stub, d.reg_number`,
        [slug, keys, regs],
      )
    : null;
  const byKey = new Map((found?.rows ?? []).map(({ k, ...d }) => [k, d]));
  return a.rows.map((r) => ({
    id: r.id,
    title: r.title,
    publication_era: r.publication_era,
    summary_rewrite: r.summary_rewrite,
    mentions: (r.mentioned_dogs ?? []).map((label) => ({ label, dog: byKey.get(strip(label).toUpperCase()) ?? null })),
  }));
}

/** Articles that mention a dog, for its profile. */
export async function getArticlesForDog(slug: string, reg: string): Promise<{ id: number; title: string }[]> {
  'use cache';
  cacheLife('hours');
  const all = await getArticles(slug);
  return all.filter((a) => a.mentions.some((m) => m.dog?.reg_number === reg)).map(({ id, title }) => ({ id, title }));
}

export type Coverage = {
  per_year: { year: number; n: number }[];
  issue_sources: { source: string; n: number }[];
  depth: { label: string; n: number }[];
  entries: number;
};

export async function getCoverage(slug: string): Promise<Coverage> {
  'use cache';
  cacheLife('hours');
  const [perYear, sources, depth] = await Promise.all([
    pool.query<{ year: number; n: number }>(
      `select birth_year::int as year, count(*)::int as n from dogs where breed_slug = $1 and birth_year is not null group by 1 order by 1`,
      [slug],
    ),
    pool.query<{ source: string; n: number }>(
      `select coalesce(stud_book_issue_source, 'none') as source, count(*)::int as n from dogs
       where breed_slug = $1 and not coalesce(is_stub, true) group by 1 order by 2 desc`,
      [slug],
    ),
    pool.query<{ both: number; one: number; none: number; grand: number; total: number }>(
      `select count(*) filter (where d.sire_reg is not null and d.dam_reg is not null)::int as both,
              count(*) filter (where (d.sire_reg is null) <> (d.dam_reg is null))::int as one,
              count(*) filter (where d.sire_reg is null and d.dam_reg is null)::int as none,
              count(*) filter (where s.sire_reg is not null and s.dam_reg is not null and m.sire_reg is not null and m.dam_reg is not null)::int as grand,
              count(*)::int as total
       from dogs d left join dogs s on s.reg_number = d.sire_reg left join dogs m on m.reg_number = d.dam_reg
       where d.breed_slug = $1 and not coalesce(d.is_stub, true)`,
      [slug],
    ),
  ]);
  const d = depth.rows[0];
  return {
    per_year: perYear.rows,
    issue_sources: sources.rows,
    entries: d.total,
    depth: [
      { label: 'Both parents known', n: d.both },
      { label: 'All four grandparents known', n: d.grand },
      { label: 'One parent known', n: d.one },
      { label: 'No parents known', n: d.none },
    ],
  };
}

/** Runs of years inside the covered span with fewer than `min` dogs, e.g. [[1954, 1966]]. */
export function gaps(perYear: { year: number; n: number }[], min = 5): [number, number][] {
  if (!perYear.length) return [];
  const by = new Map(perYear.map((p) => [p.year, p.n]));
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let y = perYear[0].year; y <= perYear[perYear.length - 1].year; y++) {
    const thin = (by.get(y) ?? 0) < min;
    if (thin && start === null) start = y;
    if (!thin && start !== null) {
      if (y - start >= 2) out.push([start, y - 1]);
      start = null;
    }
  }
  return out;
}
