import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SearchBox } from '@/components/SearchBox';
import { getBreed, getBreedStats, type BreedStats } from '@/lib/data';
import { displayName, dogHref } from '@/lib/format';

type Props = PageProps<'/[breed]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getBreed((await params).breed);
  if (!b?.is_live) return { title: 'Not found' };
  return {
    title: `${b.name} pedigrees and stud book records`,
    description: `Search and trace ${b.name} pedigrees from the AKC stud books. Coverage by year, foundation dogs and breeders.`,
  };
}

export default function BreedRoute(props: Props) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface" />}>
        <BreedView {...props} />
      </Suspense>
    </div>
  );
}

async function BreedView({ params }: Props) {
  const b = await getBreed((await params).breed);
  if (!b?.is_live) notFound();
  const s = await getBreedStats(b.slug);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{b.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {s.dogs.toLocaleString()} dogs ({s.entries.toLocaleString()} stud book entries, the rest known as parents) and {s.people.toLocaleString()} breeders and
        owners.
      </p>
      <div className="mt-6 max-w-xl">
        <SearchBox size="large" slashToFocus={false} />
      </div>

      <section id="coverage" className="mt-12 scroll-mt-20">
        <h2 className="text-lg font-semibold">Records by year of birth</h2>
        <p className="mt-1 text-sm text-muted">
          Records from AKC Stud Books, {s.first_year}–{s.last_year}. Coverage is uneven; years with few or no bars are gaps in the scans we have, not in the breed.
        </p>
        <CoverageChart data={s.per_year} />
      </section>

      <section id="foundation" className="mt-12 scroll-mt-20">
        <h2 className="text-lg font-semibold">Foundation dogs</h2>
        <p className="mt-1 text-sm text-muted">The earliest dogs in the archive.</p>
        <ul className="mt-3 grid gap-x-8 text-sm sm:grid-cols-2">
          {s.foundation.map((d) => (
            <li key={d.reg_number} className="border-b border-line">
              <Link href={dogHref(d.breed_slug, d.reg_number)} className="flex items-baseline gap-3 py-2 hover:bg-surface">
                <span className="w-10 shrink-0 text-muted">{d.birth_year}</span>
                <span className="font-medium">
                  {d.titles && <span className="mr-1 text-xs font-normal text-muted">{d.titles}</span>}
                  {displayName(d.name)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function CoverageChart({ data }: { data: BreedStats['per_year'] }) {
  if (!data.length) return null;
  const from = data[0].year;
  const to = data[data.length - 1].year;
  const byYear = new Map(data.map((d) => [d.year, d.n]));
  const max = Math.max(...data.map((d) => d.n));
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const W = 720;
  const H = 140;
  const bw = W / years.length;
  const decades = years.filter((y) => y % 10 === 0);
  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label={`Dogs per birth year, ${from} to ${to}`}>
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" />
        {years.map((y, i) => {
          const n = byYear.get(y) ?? 0;
          const h = n ? Math.max(2, (n / max) * (H - 8)) : 0;
          return (
            <rect key={y} x={i * bw + 0.5} y={H - h} width={Math.max(1, bw - 1)} height={h} rx={1} fill="var(--accent)">
              <title>{`${y}: ${n} dogs`}</title>
            </rect>
          );
        })}
        {decades.map((y) => (
          <text key={y} x={(y - from) * bw} y={H + 15} fontSize={11} fill="var(--muted)">
            {y}
          </text>
        ))}
      </svg>
      <figcaption className="sr-only">
        {data.map((d) => `${d.year}: ${d.n}`).join(', ')}
      </figcaption>
    </figure>
  );
}
