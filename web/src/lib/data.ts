// Server-only data access. The archive changes only when a migration or ingest runs,
// so reads are cached for hours.
import { cacheLife } from 'next/cache';
import { pool } from './db';

export type Dog = {
  reg_number: string;
  name: string;
  titles: string | null;
  sex: string;
  color_code: string | null;
  /** Colour spelled out in full, from the colour ledger (null when the printed text couldn't be read). */
  color: string | null;
  breed_slug: string | null;
  breed_name: string | null;
  historical_breed_label: string | null;
  sire_reg: string | null;
  dam_reg: string | null;
  is_stub: boolean;
  aka_names: string[];
  country: string | null;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  date_precision: string | null;
  stud_book_issue: string | null;
  stud_book_issue_source: string | null;
  litter_code: string | null;
  breed_live: boolean;
};

export type PersonRef = { id: number; full_name: string; kind: string };

export type DogPage = Dog & {
  sire: Pick<Dog, 'reg_number' | 'name' | 'titles'> | null;
  dam: Pick<Dog, 'reg_number' | 'name' | 'titles'> | null;
  breeders: PersonRef[];
  owners: PersonRef[];
  offspring_count: number;
  first_appearance: number | null;
};

const DOG_COLS = `d.reg_number, d.name, d.titles, d.sex, d.color_code, d.color, d.breed_slug, b.name as breed_name,
  d.historical_breed_label, d.sire_reg, d.dam_reg, coalesce(d.is_stub, true) as is_stub, d.aka_names, d.country,
  d.birth_year, d.birth_month, d.birth_day, d.date_precision, d.stud_book_issue, d.stud_book_issue_source, d.litter_code, coalesce(b.is_live, false) as breed_live`;

export async function getBreed(slug: string) {
  'use cache';
  cacheLife('hours');
  const r = await pool.query<{ slug: string; name: string; is_live: boolean }>('select slug, name, is_live from breeds where slug = $1', [slug]);
  return r.rows[0] ?? null;
}

export async function getDog(reg: string): Promise<DogPage | null> {
  'use cache';
  cacheLife('hours');
  const r = await pool.query<Dog>(`select ${DOG_COLS} from dogs d left join breeds b on b.slug = d.breed_slug where d.reg_number = $1`, [reg]);
  const dog = r.rows[0];
  if (!dog) return null;
  const [parents, people, kids] = await Promise.all([
    pool.query<Pick<Dog, 'reg_number' | 'name' | 'titles'>>('select reg_number, name, titles from dogs where reg_number = any($1)', [
      [dog.sire_reg, dog.dam_reg].filter(Boolean),
    ]),
    pool.query<PersonRef & { role: string }>(
      `select p.id, p.full_name, p.kind, dp.role from dog_people dp join people p on p.id = dp.person_id
       where dp.dog_reg = $1 order by p.full_name`,
      [reg],
    ),
    pool.query<{ n: number; first: number | null }>(
      `select count(*)::int as n, min(birth_year)::int as first from dogs where sire_reg = $1 or dam_reg = $1`,
      [reg],
    ),
  ]);
  const byReg = new Map(parents.rows.map((p) => [p.reg_number, p]));
  const strip = ({ id, full_name, kind }: PersonRef) => ({ id, full_name, kind });
  return {
    ...dog,
    sire: dog.sire_reg ? byReg.get(dog.sire_reg) ?? null : null,
    dam: dog.dam_reg ? byReg.get(dog.dam_reg) ?? null : null,
    breeders: people.rows.filter((p) => p.role === 'B').map(strip),
    owners: people.rows.filter((p) => p.role === 'O').map(strip),
    offspring_count: kids.rows[0].n,
    first_appearance: kids.rows[0].first,
  };
}

export async function getDogNames(regs: string[]): Promise<{ reg_number: string; name: string; breed_slug: string | null }[]> {
  'use cache';
  cacheLife('hours');
  if (!regs.length) return [];
  const r = await pool.query('select reg_number, name, breed_slug from dogs where reg_number = any($1)', [regs]);
  const byReg = new Map(r.rows.map((x) => [x.reg_number, x]));
  return regs.map((reg) => byReg.get(reg)).filter(Boolean);
}

export type PedigreeNode = Pick<
  Dog,
  'reg_number' | 'name' | 'titles' | 'sex' | 'is_stub' | 'birth_year' | 'birth_month' | 'birth_day' | 'date_precision' | 'breed_slug'
> & {
  /** Path from the subject: 'S' = sire, 'D' = dam. 'SD' is the sire's dam. */
  pos: string;
  offspring_count: number;
};

/** All ancestors up to `gens` generations in one recursive query. A dog already on the current path is never revisited. */
export async function getPedigree(reg: string, gens: number): Promise<PedigreeNode[]> {
  'use cache';
  cacheLife('hours');
  const r = await pool.query<PedigreeNode>(
    `with recursive tree(reg, pos, depth, path) as (
       select d.reg_number, ''::text, 0, array[d.reg_number::text] from dogs d where d.reg_number = $1
       union all
       select par.reg, t.pos || par.side, t.depth + 1, t.path || par.reg::text
       from tree t
       join dogs c on c.reg_number = t.reg
       cross join lateral (values ('S', c.sire_reg), ('D', c.dam_reg)) as par(side, reg)
       where par.reg is not null and t.depth < $2 and not (par.reg = any(t.path))
     )
     select t.pos, d.reg_number, d.name, d.titles, d.sex, coalesce(d.is_stub, true) as is_stub, d.birth_year, d.birth_month,
            d.birth_day, d.date_precision, d.breed_slug,
            (select count(*)::int from dogs k where k.sire_reg = d.reg_number or k.dam_reg = d.reg_number) as offspring_count
     from tree t join dogs d on d.reg_number = t.reg
     where t.depth > 0`,
    [reg, gens],
  );
  return r.rows;
}

export { normalizeReg } from './format';
import { normalizeReg } from './format';

const TITLE_WORDS = /^(CH|GR|GCH|INT|AM|CAN|UKC|ROM|CD|CDX|UD|TT|CGC)\.?$/i;

/** Words a name search should match, with punctuation and title prefixes dropped. */
export function searchWords(q: string): string[] {
  const words = q
    .toUpperCase()
    .replace(/'/g, '')
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  while (words.length > 1 && TITLE_WORDS.test(words[0])) words.shift();
  return words;
}

export type DogHit = Pick<Dog, 'reg_number' | 'name' | 'titles' | 'sex' | 'birth_year' | 'breed_slug' | 'is_stub'> & {
  breed_name: string | null;
  matched_aka: string | null;
};
export type PersonHit = { id: number; full_name: string; kind: string; dog_count: number; first_year: number | null; last_year: number | null };
export type SearchResult = { exact: DogHit | null; dogs: DogHit[]; people: PersonHit[] };

export async function search(q: string, opts: { dogLimit?: number; peopleLimit?: number; offset?: number; breed?: string } = {}): Promise<SearchResult> {
  'use cache';
  cacheLife('hours');
  const { dogLimit = 8, peopleLimit = 5, offset = 0, breed } = opts;
  const words = searchWords(q);
  if (words.join('').length < 2) return { exact: null, dogs: [], people: [] };
  const reg = normalizeReg(q);
  const like = `%${words.join('%')}%`;
  const plain = words.join(' ');
  const hitCols = `d.reg_number, d.name, d.titles, d.sex, d.birth_year, d.breed_slug, coalesce(d.is_stub, true) as is_stub, b.name as breed_name`;

  const exactQ = reg
    ? pool.query<DogHit>(
        `select ${hitCols}, null as matched_aka from dogs d left join breeds b on b.slug = d.breed_slug
         where (d.reg_number = $1 or d.reg_number like $1 || '-X%') and b.is_live order by d.is_stub, d.reg_number limit 1`,
        [reg],
      )
    : null;

  const dogsQ = pool.query<DogHit>(
    `select ${hitCols},
            case when replace(d.name, '''', '') ilike $1 or d.name % $2 then null
                 else (select a from unnest(d.aka_names) a where replace(a, '''', '') ilike $1 or a % $2 limit 1) end as matched_aka
     from dogs d left join breeds b on b.slug = d.breed_slug
     where (d.name ilike $1 or replace(d.name, '''', '') ilike $1 or d.name % $2 or aka_text(d.aka_names) ilike $1 or aka_text(d.aka_names) % $2
            or ($3::text is not null and d.reg_number like $3 || '%'))
       and b.is_live and ($4::text is null or d.breed_slug = $4)
     order by (d.name ilike $5) desc, (replace(d.name, '''', '') ilike $1) desc, similarity(d.name, $2) desc,
              coalesce(d.is_stub, true), d.birth_year nulls last, d.reg_number
     limit $6 offset $7`,
    [like, plain, reg, breed ?? null, `${words[0]}%`, dogLimit, offset],
  );

  const peopleQ =
    peopleLimit > 0
      ? pool.query<PersonHit>(
          `select p.id, p.full_name, p.kind, count(distinct dp.dog_reg)::int as dog_count,
                  min(d.birth_year)::int as first_year, max(d.birth_year)::int as last_year
           from people p join dog_people dp on dp.person_id = p.id join dogs d on d.reg_number = dp.dog_reg join breeds lb on lb.slug = d.breed_slug and lb.is_live
           where (p.full_name ilike $1 or p.full_name % $2) and ($3::text is null or d.breed_slug = $3)
           group by p.id
           order by (p.full_name ilike $4) desc, similarity(p.full_name, $2) desc, count(distinct dp.dog_reg) desc
           limit $5 offset $6`,
          [like, plain, breed ?? null, `${words[0]}%`, peopleLimit, offset],
        )
      : null;

  const [exact, dogs, people] = await Promise.all([exactQ, dogsQ, peopleQ]);
  return { exact: exact?.rows[0] ?? null, dogs: dogs.rows, people: people?.rows ?? [] };
}

export type PersonPage = PersonHit & {
  initials_only: boolean;
  dogs: (Pick<Dog, 'reg_number' | 'name' | 'titles' | 'sex' | 'birth_year' | 'breed_slug' | 'is_stub'> & { breed_name: string | null; roles: string })[];
  co_people: PersonRef[];
};

export async function getPerson(id: number): Promise<PersonPage | null> {
  'use cache';
  cacheLife('hours');
  const p = await pool.query<{ id: number; full_name: string; kind: string; initials_only: boolean }>(
    'select id, full_name, kind, initials_only from people where id = $1',
    [id],
  );
  if (!p.rows[0]) return null;
  const [dogs, co] = await Promise.all([
    pool.query<PersonPage['dogs'][number]>(
      `select d.reg_number, d.name, d.titles, d.sex, d.birth_year, d.breed_slug, coalesce(d.is_stub, true) as is_stub, b.name as breed_name,
              string_agg(dp.role, '' order by dp.role) as roles
       from dog_people dp join dogs d on d.reg_number = dp.dog_reg join breeds b on b.slug = d.breed_slug and b.is_live
       where dp.person_id = $1
       group by d.reg_number, b.name
       order by b.name nulls last, d.birth_year nulls last, d.name`,
      [id],
    ),
    pool.query<PersonRef>(
      `select p.id, p.full_name, p.kind from dog_people a join dog_people x on x.dog_reg = a.dog_reg and x.role = a.role and x.person_id <> a.person_id
       join people p on p.id = x.person_id where a.person_id = $1 and a.role = 'O'
       group by p.id order by count(*) desc limit 12`,
      [id],
    ),
  ]);
  const years = dogs.rows.map((d) => d.birth_year).filter((y): y is number => !!y);
  return {
    ...p.rows[0],
    dog_count: dogs.rows.length,
    first_year: years.length ? Math.min(...years) : null,
    last_year: years.length ? Math.max(...years) : null,
    dogs: dogs.rows,
    co_people: co.rows,
  };
}

export type BreedStats = {
  dogs: number;
  entries: number;
  people: number;
  first_year: number | null;
  last_year: number | null;
  per_year: { year: number; n: number }[];
  foundation: Pick<Dog, 'reg_number' | 'name' | 'titles' | 'sex' | 'birth_year' | 'breed_slug' | 'is_stub'>[];
};

export async function getBreedStats(slug: string): Promise<BreedStats> {
  'use cache';
  cacheLife('hours');
  const [totals, perYear, foundation] = await Promise.all([
    pool.query<{ dogs: number; entries: number; people: number; first_year: number; last_year: number }>(
      `select count(*)::int as dogs, count(*) filter (where not coalesce(is_stub, true))::int as entries,
              (select count(distinct dp.person_id)::int from dog_people dp join dogs x on x.reg_number = dp.dog_reg where x.breed_slug = $1) as people,
              min(birth_year)::int as first_year, max(birth_year)::int as last_year
       from dogs where breed_slug = $1`,
      [slug],
    ),
    pool.query<{ year: number; n: number }>(
      `select birth_year::int as year, count(*)::int as n from dogs where breed_slug = $1 and birth_year is not null
       group by 1 order by 1`,
      [slug],
    ),
    pool.query<BreedStats['foundation'][number]>(
      `select reg_number, name, titles, sex, birth_year, breed_slug, coalesce(is_stub, true) as is_stub from dogs
       where breed_slug = $1 and birth_year is not null order by birth_year, name limit 12`,
      [slug],
    ),
  ]);
  return { ...totals.rows[0], per_year: perYear.rows, foundation: foundation.rows };
}
