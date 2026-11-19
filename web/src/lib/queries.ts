// Queries for the full results page and the dog profile tabs.
import { cacheLife } from 'next/cache';
import { pool } from './db';
import { normalizeReg, searchWords, type Dog, type DogHit } from './data';

// ---------- Full results page: dogs with filters ----------

export type DogFilters = {
  q?: string;
  breed?: string;
  sex?: 'D' | 'B';
  from?: number;
  to?: number;
  titled?: boolean;
  type?: 'entry' | 'parent' | 'unregistered';
  sire?: string;
  dam?: string;
  breeder?: number;
  owner?: number;
  desc?: string;
  sort?: 'best' | 'oldest' | 'newest' | 'name';
  limit: number;
  offset: number;
};

export async function searchDogs(f: DogFilters): Promise<DogHit[]> {
  'use cache';
  cacheLife('hours');
  const args: unknown[] = [];
  const arg = (v: unknown) => {
    args.push(v);
    return `$${args.length}`;
  };
  const where: string[] = ['b.is_live'];
  let ctes = '';
  let rank = '';
  let akaSel = 'null::text';
  const words = f.q ? searchWords(f.q) : [];
  if (words.join('').length >= 2) {
    const like = arg(`%${words.join('%')}%`);
    const plain = arg(words.join(' '));
    const reg = normalizeReg(f.q!);
    where.push(`(d.name ilike ${like} or replace(d.name, '''', '') ilike ${like} or d.name % ${plain}
      or aka_text(d.aka_names) ilike ${like} or aka_text(d.aka_names) % ${plain}${reg ? ` or d.reg_number like ${arg(reg)}::text || '%'` : ''})`);
    akaSel = `case when replace(d.name, '''', '') ilike ${like} or d.name % ${plain} then null
      else (select a from unnest(d.aka_names) a where replace(a, '''', '') ilike ${like} or a % ${plain} limit 1) end`;
    // Only best-match ordering uses these, and Postgres rejects parameters that are never referenced.
    if (!f.sort || f.sort === 'best')
      rank = `(d.name ilike ${arg(`${words[0]}%`)}::text) desc, (replace(d.name, '''', '') ilike ${like}) desc, similarity(d.name, ${plain}) desc,`;
  }
  if (f.breed) where.push(`d.breed_slug = ${arg(f.breed)}`);
  if (f.sex) where.push(`d.sex = ${arg(f.sex)}`);
  if (f.from) where.push(`d.birth_year >= ${arg(f.from)}`);
  if (f.to) where.push(`d.birth_year <= ${arg(f.to)}`);
  if (f.titled) where.push(`coalesce(d.titles, '') <> ''`);
  if (f.type === 'unregistered') where.push(`d.reg_number like 'UNREG%'`);
  if (f.type === 'parent') where.push(`coalesce(d.is_stub, true) and d.reg_number not like 'UNREG%'`);
  if (f.type === 'entry') where.push(`not coalesce(d.is_stub, true) and d.reg_number not like 'UNREG%'`);
  if (f.sire) where.push(`d.sire_reg = ${arg(f.sire)}`);
  if (f.dam) where.push(`d.dam_reg = ${arg(f.dam)}`);
  if (f.breeder) where.push(`exists (select 1 from dog_people x where x.dog_reg = d.reg_number and x.role = 'B' and x.person_id = ${arg(f.breeder)})`);
  if (f.owner) where.push(`exists (select 1 from dog_people x where x.dog_reg = d.reg_number and x.role = 'O' and x.person_id = ${arg(f.owner)})`);
  if (f.desc) {
    const root = arg(f.desc);
    ctes = `with recursive down(reg, depth, path) as (
        select c.reg_number, 1, array[${root}::text, c.reg_number::text] from dogs c where c.sire_reg = ${root} or c.dam_reg = ${root}
        union all
        select c.reg_number, down.depth + 1, down.path || c.reg_number::text from down join dogs c on c.sire_reg = down.reg or c.dam_reg = down.reg
        where down.depth < 12 and not (c.reg_number = any(down.path)))`;
    where.push(`d.reg_number in (select reg from down)`);
  }
  const order =
    f.sort === 'oldest'
      ? 'd.birth_year nulls last, d.name'
      : f.sort === 'newest'
        ? 'd.birth_year desc nulls last, d.name'
        : f.sort === 'name'
          ? 'd.name'
          : `${rank} coalesce(d.is_stub, true), d.birth_year nulls last, d.name`;
  const r = await pool.query<DogHit>(
    `${ctes} select d.reg_number, d.name, d.titles, d.sex, d.birth_year, d.breed_slug, coalesce(d.is_stub, true) as is_stub, b.name as breed_name,
            ${akaSel} as matched_aka
     from dogs d join breeds b on b.slug = d.breed_slug
     where ${where.join(' and ')}
     order by ${order}, d.reg_number
     limit ${arg(f.limit)} offset ${arg(f.offset)}`,
    args,
  );
  return r.rows;
}

/** Labels for relationship filter chips. */
export async function getLabels(regs: string[], people: number[]) {
  'use cache';
  cacheLife('hours');
  const [d, p] = await Promise.all([
    regs.length ? pool.query<{ reg_number: string; name: string }>('select reg_number, name from dogs where reg_number = any($1)', [regs]) : null,
    people.length ? pool.query<{ id: number; full_name: string }>('select id, full_name from people where id = any($1)', [people]) : null,
  ]);
  return {
    dogs: Object.fromEntries((d?.rows ?? []).map((x) => [x.reg_number, x.name])) as Record<string, string>,
    people: Object.fromEntries((p?.rows ?? []).map((x) => [x.id, x.full_name])) as Record<number, string>,
  };
}

// ---------- Profile tabs ----------

export type Kid = Pick<Dog, 'reg_number' | 'name' | 'titles' | 'sex' | 'birth_year' | 'birth_month' | 'birth_day' | 'date_precision' | 'breed_slug' | 'is_stub'>;
const KID_COLS = `k.reg_number, k.name, k.titles, k.sex, k.birth_year, k.birth_month, k.birth_day, k.date_precision, k.breed_slug, coalesce(k.is_stub, true) as is_stub`;

export type Litter = { other: { reg_number: string; name: string } | null; born: Kid; pups: Kid[] };

/** Offspring grouped into litters (same other parent and birth date), newest first. */
export async function getOffspring(reg: string): Promise<Litter[]> {
  'use cache';
  cacheLife('hours');
  const r = await pool.query<Kid & { other_reg: string | null; other_name: string | null }>(
    `select ${KID_COLS}, o.reg_number as other_reg, o.name as other_name
     from dogs k left join dogs o on o.reg_number = case when k.sire_reg = $1 then k.dam_reg else k.sire_reg end
     where k.sire_reg = $1 or k.dam_reg = $1
     order by k.birth_year desc nulls last, k.birth_month desc nulls last, k.birth_day desc nulls last, o.name, k.name`,
    [reg],
  );
  const litters = new Map<string, Litter>();
  for (const { other_reg, other_name, ...kid } of r.rows) {
    const key = `${other_reg}|${kid.birth_year}|${kid.birth_month}|${kid.birth_day}`;
    const l = litters.get(key);
    if (l) l.pups.push(kid);
    else litters.set(key, { other: other_reg ? { reg_number: other_reg, name: other_name ?? '' } : null, born: kid, pups: [kid] });
  }
  return [...litters.values()];
}

export type Siblings = { littermates: Kid[]; full: Kid[]; bySire: Kid[]; byDam: Kid[] };

export async function getSiblings(reg: string): Promise<Siblings> {
  'use cache';
  cacheLife('hours');
  const r = await pool.query<Kid & { rel: string }>(
    `select ${KID_COLS},
            case when k.sire_reg = d.sire_reg and k.dam_reg = d.dam_reg and k.birth_year = d.birth_year
                      and k.birth_month is not distinct from d.birth_month and k.birth_day is not distinct from d.birth_day then 'litter'
                 when k.sire_reg = d.sire_reg and k.dam_reg = d.dam_reg then 'full'
                 when k.sire_reg = d.sire_reg then 'sire' else 'dam' end as rel
     from dogs d join dogs k on k.reg_number <> d.reg_number and (k.sire_reg = d.sire_reg or k.dam_reg = d.dam_reg)
     where d.reg_number = $1
     order by k.birth_year nulls last, k.name
     limit 600`,
    [reg],
  );
  const pick = (rel: string): Kid[] => r.rows.filter((x) => x.rel === rel).map(({ rel: _ignored, ...k }) => k);
  return { littermates: pick('litter'), full: pick('full'), bySire: pick('sire'), byDam: pick('dam') };
}

export type DescendantGen = { gen: number; count: number; dogs: Kid[] };

export async function getDescendants(reg: string, gens = 5, perGen = 150): Promise<DescendantGen[]> {
  'use cache';
  cacheLife('hours');
  const r = await pool.query<Kid & { gen: number; n: number; rn: number }>(
    `with recursive down(reg, gen, path) as (
       select c.reg_number, 1, array[$1::text, c.reg_number::text] from dogs c where c.sire_reg = $1 or c.dam_reg = $1
       union all
       select c.reg_number, down.gen + 1, down.path || c.reg_number::text from down join dogs c on c.sire_reg = down.reg or c.dam_reg = down.reg
       where down.gen < $2 and not (c.reg_number = any(down.path))),
     firsts as (select reg, min(gen) as gen from down group by reg),
     ranked as (select f.gen, ${KID_COLS}, count(*) over (partition by f.gen)::int as n,
                       row_number() over (partition by f.gen order by k.birth_year nulls last, k.name)::int as rn
                from firsts f join dogs k on k.reg_number = f.reg)
     select * from ranked where rn <= $3 order by gen, rn`,
    [reg, gens, perGen],
  );
  const out = new Map<number, DescendantGen>();
  for (const { gen, n, rn: _rn, ...k } of r.rows) {
    const g = out.get(gen) ?? { gen, count: n, dogs: [] };
    g.dogs.push(k);
    out.set(gen, g);
  }
  return [...out.values()];
}

export type Appearance = {
  issue: string | null;
  issue_source: string | null;
  name: string | null;
  titles: string | null;
  breed: string | null;
  birth_date: string | null;
  color: string | null;
  sire: string | null;
  dam: string | null;
  breeders: string[] | null;
  owners: string[] | null;
};

export type DogDetails = { reg_raw: string | null; name_raw: string | null; birth_date: string | null; breed_raw: string | null; appearances: Appearance[] };

/** Every stud book row this dog was read from, as printed. Scan file names are never exposed. */
export async function getDetails(reg: string): Promise<DogDetails | null> {
  'use cache';
  cacheLife('hours');
  const d = await pool.query<Omit<DogDetails, 'appearances'>>('select reg_raw, name_raw, birth_date, breed_raw from dogs where reg_number = $1', [reg]);
  if (!d.rows[0]) return null;
  const base = reg.startsWith('UNREG') ? '' : reg.split('-X')[0];
  const a = base
    ? await pool.query<Appearance>(
        `select s.issue_label as issue, s.source as issue_source, r.name, r.titles, r.breed, r.birth_date, r.color_code as color,
                concat_ws(' ', r.sire_name, nullif('(' || coalesce(r.sire_reg, '') || ')', '()')) as sire,
                concat_ws(' ', r.dam_name, nullif('(' || coalesce(r.dam_reg, '') || ')', '()')) as dam, r.breeders, r.owners
         from raw_entries r left join stud_book_sheets s on s.sheet = r.sheet
         where upper(regexp_replace(r.reg_number, '[^A-Za-z0-9]', '', 'g')) = $1
         order by s.issue_year nulls last, s.issue_month nulls last, r.sheet_seq`,
        [base],
      )
    : null;
  return { ...d.rows[0], appearances: a?.rows ?? [] };
}
