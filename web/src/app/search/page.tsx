import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SearchBox } from '@/components/SearchBox';
import { normalizeReg, search } from '@/lib/data';
import { displayName, dogHref, isRealReg, personHref } from '@/lib/format';

type Props = PageProps<'/search'>;
const PAGE = 25;

function first(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = first((await searchParams).q);
  return { title: q ? `Search: ${q}` : 'Search', robots: { index: false } };
}

export default function SearchRoute(props: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-surface" />}>
        <Results {...props} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Props) {
  const sp = await searchParams;
  const q = first(sp.q).slice(0, 80);
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const breed = first(sp.breed) || undefined;

  if (q.length < 2) {
    return (
      <>
        <SearchBox size="large" slashToFocus={false} />
        <p className="mt-6 text-sm text-muted">Type at least two letters, or a registration number like R75131.</p>
      </>
    );
  }

  const res = await search(q, { dogLimit: PAGE + 1, peopleLimit: page === 1 ? 20 : 0, offset: (page - 1) * PAGE, breed });
  // A registration number with one exact match goes straight to the dog.
  if (res.exact && normalizeReg(q) && page === 1) redirect(dogHref(res.exact.breed_slug, res.exact.reg_number));

  const more = res.dogs.length > PAGE;
  const dogs = res.dogs.slice(0, PAGE);
  const pageHref = (p: number) => `/search?q=${encodeURIComponent(q)}${breed ? `&breed=${breed}` : ''}${p > 1 ? `&page=${p}` : ''}`;

  return (
    <>
      <SearchBox size="large" initial={q} slashToFocus={false} />
      <h1 className="sr-only">Search results for {q}</h1>

      {dogs.length === 0 && res.people.length === 0 && (
        <div className="mt-8 text-sm text-muted">
          <p className="text-fg">Nothing found for “{q}”.</p>
          <p className="mt-2">Try fewer words, part of a kennel name (like “X-Pert”), or a registration number.</p>
          <p className="mt-2">
            The records are thin for some years, including 1954–1966 for AmStaffs. See{' '}
            <Link href="/amstaff#coverage" className="text-accent hover:underline">
              coverage by year
            </Link>
            .
          </p>
        </div>
      )}

      {dogs.length > 0 && (
        <section className="mt-8">
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
          {(page > 1 || more) && (
            <nav className="mt-4 flex gap-4 text-sm" aria-label="Pages">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="text-accent hover:underline">
                  ← Previous
                </Link>
              )}
              <span className="text-muted">Page {page}</span>
              {more && (
                <Link href={pageHref(page + 1)} className="text-accent hover:underline">
                  Next →
                </Link>
              )}
            </nav>
          )}
        </section>
      )}

      {res.people.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-medium uppercase tracking-wide text-faint">People &amp; kennels</h2>
          <ul className="mt-2 divide-y divide-line">
            {res.people.map((p) => (
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
    </>
  );
}
