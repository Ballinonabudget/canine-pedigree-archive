import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getBreed } from '@/lib/data';
import { displayName, dogHref, isRealReg } from '@/lib/format';
import { searchDogs } from '@/lib/queries';

type Props = PageProps<'/[breed]/browse/[decade]'>;
const PAGE = 50;

function decadeOf(raw: string) {
  const m = /^(1[89]\d0|20[0-2]0)s$/.exec(raw);
  return m ? Number(m[1]) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { breed, decade } = await params;
  const b = await getBreed(breed);
  const d = decadeOf(decade);
  if (!b?.is_live || !d) return { title: 'Not found' };
  return { title: `${b.name}s born in the ${d}s`, description: `${b.name}s born ${d}–${d + 9}, from the AKC stud book records.` };
}

export default function BrowseRoute(props: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface" />}>
        <Browse {...props} />
      </Suspense>
    </div>
  );
}

async function Browse({ params, searchParams }: Props) {
  const [{ breed, decade }, sp] = await Promise.all([params, searchParams]);
  const b = await getBreed(breed);
  const d = decadeOf(decade);
  if (!b?.is_live || !d) notFound();
  const sex = sp.sex === 'D' || sp.sex === 'B' ? sp.sex : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = await searchDogs({ breed: b.slug, from: d, to: d + 9, sex, sort: 'oldest', limit: PAGE + 1, offset: (page - 1) * PAGE });
  const more = rows.length > PAGE;
  const href = (q: { sex?: string; page?: number }) => {
    const p = new URLSearchParams();
    if (q.sex) p.set('sex', q.sex);
    if (q.page && q.page > 1) p.set('page', String(q.page));
    return `/${b.slug}/browse/${d}s${p.size ? `?${p}` : ''}`;
  };

  return (
    <>
      <nav className="text-xs text-muted">
        <Link href={`/${b.slug}#browse`} className="hover:text-fg">
          {b.name}
        </Link>{' '}
        › Browse by decade
      </nav>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Born in the {d}s</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {[
          [undefined, 'All'],
          ['D', 'Dogs'],
          ['B', 'Bitches'],
        ].map(([v, l]) => (
          <Link
            key={l}
            href={href({ sex: v })}
            aria-current={sex === v ? 'true' : undefined}
            className={`rounded-full border px-3 py-0.5 ${sex === v ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg'}`}
          >
            {l}
          </Link>
        ))}
        <Link href={`/search?breed=${b.slug}&from=${d}&to=${d + 9}&sort=oldest`} className="ml-auto text-accent hover:underline">
          More filters
        </Link>
        <span className="text-muted">
          <Link href={`/${b.slug}/browse/${d - 10}s`} className="hover:text-fg">
            ← {d - 10}s
          </Link>{' '}
          ·{' '}
          <Link href={`/${b.slug}/browse/${d + 10}s`} className="hover:text-fg">
            {d + 10}s →
          </Link>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No dogs born in the {d}s are in the records we have. This is a gap in the scans, not in the breed.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line text-sm">
          {rows.slice(0, PAGE).map((x) => (
            <li key={x.reg_number}>
              <Link href={dogHref(x.breed_slug, x.reg_number)} className="flex items-baseline gap-3 py-2 hover:bg-surface">
                <span className="w-10 shrink-0 text-muted">{x.birth_year}</span>
                <span className="font-medium">
                  {x.titles && <span className="mr-1 text-xs font-normal text-muted">{x.titles}</span>}
                  {displayName(x.name)}
                </span>
                <span className="ml-auto text-xs text-muted">{x.sex === 'D' ? 'Dog' : x.sex === 'B' ? 'Bitch' : ''}</span>
                {isRealReg(x.reg_number) && <span className="font-mono text-xs text-faint">{x.reg_number}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(page > 1 || more) && (
        <nav className="mt-4 flex gap-4 text-sm" aria-label="Pages">
          {page > 1 && (
            <Link href={href({ sex, page: page - 1 })} className="text-accent hover:underline">
              ← Previous
            </Link>
          )}
          <span className="text-muted">Page {page}</span>
          {more && (
            <Link href={href({ sex, page: page + 1 })} className="text-accent hover:underline">
              Next →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
