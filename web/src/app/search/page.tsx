import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SearchBox } from '@/components/SearchBox';
import { normalizeReg, search } from '@/lib/data';
import { displayName, dogHref, isRealReg, personHref } from '@/lib/format';
import { getLabels, searchDogs, type DogFilters } from '@/lib/queries';

type Props = PageProps<'/search'>;
type SP = Record<string, string | string[] | undefined>;
const PAGE = 25;

const FILTER_KEYS = ['breed', 'sex', 'from', 'to', 'titled', 'type', 'sire', 'dam', 'breeder', 'owner', 'desc', 'color'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

function first(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

function readFilters(sp: SP) {
  const get = (k: string) => first(sp[k]);
  const year = (k: string) => {
    const n = Number(get(k));
    return Number.isInteger(n) && n > 1800 && n < 2100 ? n : undefined;
  };
  const id = (k: string) => {
    const n = Number(get(k));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const reg = (k: string) => get(k).toUpperCase().replace(/[^A-Z0-9_:\-]/g, '') || undefined;
  const sex = get('sex');
  const type = get('type');
  const sort = get('sort');
  return {
    q: get('q').slice(0, 80),
    breed: get('breed') || undefined,
    sex: sex === 'D' || sex === 'B' ? sex : undefined,
    from: year('from'),
    to: year('to'),
    titled: get('titled') === '1' || undefined,
    type: type === 'entry' || type === 'parent' || type === 'unregistered' ? type : undefined,
    sire: reg('sire'),
    dam: reg('dam'),
    breeder: id('breeder'),
    owner: id('owner'),
    desc: reg('desc'),
    color: get('color').slice(0, 80) || undefined,
    sort: sort === 'oldest' || sort === 'newest' || sort === 'name' ? sort : undefined,
    page: Math.max(1, Number(get('page')) || 1),
  } satisfies Partial<DogFilters> & { page: number; q: string };
}

type F = ReturnType<typeof readFilters>;

function hrefWith(f: F, change: Partial<Record<keyof F, string | number | boolean | undefined>>) {
  const merged: Record<string, unknown> = { ...f, page: undefined, ...change };
  const qs = Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== '' && v !== false && !(typeof v === 'number' && Number.isNaN(v)))
    .map(([k, v]) => `${k}=${encodeURIComponent(v === true ? '1' : String(v))}`)
    .join('&');
  return `/search${qs ? `?${qs}` : ''}`;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = first((await searchParams).q);
  return { title: q ? `Search: ${q}` : 'Search', robots: { index: false } };
}

export default function SearchRoute(props: Props) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-surface" />}>
        <Results {...props} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Props) {
  const f = readFilters(await searchParams);
  const hasFilters = FILTER_KEYS.some((k) => f[k] !== undefined);

  if (f.q.length < 2 && !hasFilters) {
    return (
      <div className="max-w-2xl">
        <SearchBox size="large" slashToFocus={false} />
        <p className="mt-6 text-sm text-muted">Type at least two letters, or a registration number like R75131.</p>
      </div>
    );
  }

  const [quick, dogsPlus, labels] = await Promise.all([
    f.q.length >= 2 ? search(f.q, { dogLimit: 0, peopleLimit: f.page === 1 && !hasFilters ? 12 : 0, breed: f.breed }) : null,
    searchDogs({ ...f, limit: PAGE + 1, offset: (f.page - 1) * PAGE }),
    getLabels([f.sire, f.dam, f.desc].filter((x): x is string => !!x), [f.breeder, f.owner].filter((x): x is number => !!x)),
  ]);
  // A registration number with one exact match goes straight to the dog.
  if (quick?.exact && normalizeReg(f.q) && f.page === 1 && !hasFilters) redirect(dogHref(quick.exact.breed_slug, quick.exact.reg_number));

  const more = dogsPlus.length > PAGE;
  const dogs = dogsPlus.slice(0, PAGE);
  const people = quick?.people ?? [];
  const dogName = (r: string) => (labels.dogs[r] ? displayName(labels.dogs[r]) : r);
  const personName = (id: number) => (labels.people[id] ? displayName(labels.people[id]) : `#${id}`);

  const chips: { key: FilterKey | 'fromto'; label: string; clear: Partial<Record<keyof F, undefined>> }[] = [];
  if (f.sex) chips.push({ key: 'sex', label: f.sex === 'D' ? 'Dogs' : 'Bitches', clear: { sex: undefined } });
  if (f.from || f.to) chips.push({ key: 'fromto', label: `Born ${f.from ?? '…'}–${f.to ?? '…'}`, clear: { from: undefined, to: undefined } });
  if (f.color) chips.push({ key: 'color', label: `Colour: ${f.color}`, clear: { color: undefined } });
  if (f.titled) chips.push({ key: 'titled', label: 'Has titles', clear: { titled: undefined } });
  if (f.type)
    chips.push({
      key: 'type',
      label: { entry: 'Stud book entries', parent: 'Parent references', unregistered: 'Unregistered / imports' }[f.type],
      clear: { type: undefined },
    });
  if (f.sire) chips.push({ key: 'sire', label: `Sired by ${dogName(f.sire)}`, clear: { sire: undefined } });
  if (f.dam) chips.push({ key: 'dam', label: `Out of ${dogName(f.dam)}`, clear: { dam: undefined } });
  if (f.desc) chips.push({ key: 'desc', label: `Descendant of ${dogName(f.desc)}`, clear: { desc: undefined } });
  if (f.breeder) chips.push({ key: 'breeder', label: `Bred by ${personName(f.breeder)}`, clear: { breeder: undefined } });
  if (f.owner) chips.push({ key: 'owner', label: `Owned by ${personName(f.owner)}`, clear: { owner: undefined } });

  return (
    <>
      <div className="max-w-2xl">
        <SearchBox size="large" initial={f.q} slashToFocus={false} />
      </div>
      <h1 className="sr-only">Search results{f.q ? ` for ${f.q}` : ''}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {chips.map((c) => (
          <Link key={c.key} href={hrefWith(f, c.clear)} className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 py-0.5 text-accent">
            {c.label}
            <span aria-label="Remove filter">×</span>
          </Link>
        ))}
        {chips.length > 1 && (
          <Link href={hrefWith(f, Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))} className="text-muted hover:text-fg">
            Clear all
          </Link>
        )}
        <span className="ml-auto flex items-center gap-1 text-muted">
          Sort
          {(['best', 'oldest', 'newest', 'name'] as const).map((s) => (
            <Link
              key={s}
              href={hrefWith(f, { sort: s === 'best' ? undefined : s })}
              aria-current={(f.sort ?? 'best') === s ? 'true' : undefined}
              className={`rounded px-1.5 ${(f.sort ?? 'best') === s ? 'bg-surface text-fg' : 'hover:text-fg'}`}
            >
              {{ best: 'Best match', oldest: 'Oldest', newest: 'Newest', name: 'A–Z' }[s]}
            </Link>
          ))}
        </span>
      </div>

      <div className="mt-4 grid gap-8 md:grid-cols-[220px_1fr]">
        <FilterPanel f={f} open={hasFilters} />

        <div className="min-w-0">
          {dogs.length === 0 && people.length === 0 && (
            <div className="text-sm text-muted">
              <p className="text-fg">Nothing found{f.q ? ` for “${f.q}”` : ''}.</p>
              <p className="mt-2">Try fewer words, part of a kennel name (like “X-Pert”), a registration number, or fewer filters.</p>
              <p className="mt-2">
                The records are thin for some years, including 1953–1970 for AmStaffs. See{' '}
                <Link href="/amstaff#coverage" className="text-accent hover:underline">
                  coverage by year
                </Link>
                .
              </p>
            </div>
          )}

          {dogs.length > 0 && (
            <section>
              <h2 className="text-xs font-medium uppercase tracking-wide text-faint">Dogs</h2>
              <ul className="mt-2 divide-y divide-line">
                {dogs.map((d) => (
                  <li key={d.reg_number}>
                    <Link href={dogHref(d.breed_slug, d.reg_number)} className="flex flex-wrap items-baseline gap-x-3 py-2.5 hover:bg-surface">
                      <span className="font-medium">
                        {d.titles && <span className="mr-1 text-xs font-normal text-muted">{d.titles}</span>}
                        {displayName(d.name)}
                      </span>
                      {d.matched_aka && <span className="text-xs italic text-muted">matched: also recorded as {displayName(d.matched_aka)}</span>}
                      <span className="ml-auto text-xs text-muted">
                        {[d.sex === 'D' ? 'Dog' : d.sex === 'B' ? 'Bitch' : null, d.birth_year, d.breed_name, d.is_stub ? 'parent reference' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {isRealReg(d.reg_number) && <span className="font-mono text-xs text-faint">{d.reg_number}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              {(f.page > 1 || more) && (
                <nav className="mt-4 flex gap-4 text-sm" aria-label="Pages">
                  {f.page > 1 && (
                    <Link href={hrefWith(f, { page: f.page - 1 })} className="text-accent hover:underline">
                      ← Previous
                    </Link>
                  )}
                  <span className="text-muted">Page {f.page}</span>
                  {more && (
                    <Link href={hrefWith(f, { page: f.page + 1 })} className="text-accent hover:underline">
                      Next →
                    </Link>
                  )}
                </nav>
              )}
            </section>
          )}

          {people.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xs font-medium uppercase tracking-wide text-faint">People &amp; kennels</h2>
              <ul className="mt-2 divide-y divide-line">
                {people.map((p) => (
                  <li key={p.id}>
                    <Link href={personHref(p)} className="flex items-baseline gap-3 py-2.5 hover:bg-surface">
                      <span className="font-medium">{displayName(p.full_name)}</span>
                      <span className="ml-auto text-xs text-muted">
                        {[
                          p.kind === 'kennel' ? 'Kennel' : 'Person',
                          `${p.dog_count} dog${p.dog_count === 1 ? '' : 's'}`,
                          p.first_year && (p.first_year === p.last_year ? p.first_year : `${p.first_year}–${p.last_year}`),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

/** A plain GET form: works without JavaScript, and every filter lands in the URL. */
function FilterPanel({ f, open }: { f: F; open: boolean }) {
  const field = 'mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm';
  const label = 'block text-xs font-medium text-muted';
  return (
    <details open={open || undefined} className="md:open:block self-start rounded-lg border border-line p-3 text-sm md:sticky md:top-4">
      <summary className="cursor-pointer select-none font-medium">Filters</summary>
      <form action="/search" className="mt-3 space-y-3">
        {f.q && <input type="hidden" name="q" value={f.q} />}
        {f.sort && <input type="hidden" name="sort" value={f.sort} />}
        {f.color && <input type="hidden" name="color" value={f.color} />}
        <input type="hidden" name="breed" value="amstaff" />
        <div>
          <label className={label} htmlFor="f-sex">
            Sex
          </label>
          <select id="f-sex" name="sex" defaultValue={f.sex ?? ''} className={field}>
            <option value="">Any</option>
            <option value="D">Dogs</option>
            <option value="B">Bitches</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label} htmlFor="f-from">
              Born from
            </label>
            <input id="f-from" name="from" inputMode="numeric" placeholder="1930" defaultValue={f.from ?? ''} className={field} />
          </div>
          <div>
            <label className={label} htmlFor="f-to">
              to
            </label>
            <input id="f-to" name="to" inputMode="numeric" placeholder="1999" defaultValue={f.to ?? ''} className={field} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="f-type">
            Record type
          </label>
          <select id="f-type" name="type" defaultValue={f.type ?? ''} className={field}>
            <option value="">Any</option>
            <option value="entry">Stud book entry</option>
            <option value="parent">Parent reference only</option>
            <option value="unregistered">Unregistered / import</option>
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="titled" value="1" defaultChecked={!!f.titled} /> Has titles
        </label>
        <fieldset className="space-y-2 border-t border-line pt-3">
          <legend className="text-xs font-medium text-muted">Relationships (registration number)</legend>
          {(
            [
              ['sire', 'Sired by'],
              ['dam', 'Out of'],
              ['desc', 'Descendant of'],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <label className={label} htmlFor={`f-${k}`}>
                {l}
              </label>
              <input id={`f-${k}`} name={k} placeholder="R75131" defaultValue={f[k] ?? ''} className={`${field} font-mono`} />
            </div>
          ))}
          {f.breeder && <input type="hidden" name="breeder" value={f.breeder} />}
          {f.owner && <input type="hidden" name="owner" value={f.owner} />}
        </fieldset>
        <button type="submit" className="w-full rounded-md bg-accent px-3 py-1.5 font-medium text-bg">
          Apply
        </button>
      </form>
    </details>
  );
}
