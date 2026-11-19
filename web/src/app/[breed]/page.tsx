import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CoverageChart, RankList } from '@/components/BreedBits';
import { SearchBox } from '@/components/SearchBox';
import { gaps, getArticles, getBreedHome } from '@/lib/breed';
import { getBreed, getBreedStats } from '@/lib/data';
import { displayName, dogHref, personHref } from '@/lib/format';

type Props = PageProps<'/[breed]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getBreed((await params).breed);
  if (!b?.is_live) return { title: 'Not found' };
  return {
    title: `${b.name} pedigrees and stud book records`,
    description: `Search and trace ${b.name} pedigrees from the AKC stud books. Coverage by year, foundation dogs, influential sires and dams, and breeders.`,
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

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-14 scroll-mt-20">
      <h2 id={`${id}-h`} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function BreedView({ params }: Props) {
  const b = await getBreed((await params).breed);
  if (!b?.is_live) notFound();
  const [s, home, articles] = await Promise.all([getBreedStats(b.slug), getBreedHome(b.slug), getArticles(b.slug)]);
  const thin = gaps(s.per_year);

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
      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {[
          ['coverage', 'Coverage'],
          ['browse', 'Browse by decade'],
          ['foundation', 'Foundation dogs'],
          ['influential', 'Influential sires and dams'],
          ['breeders', 'Breeders'],
          ...(articles.length ? [['history', 'Breed history']] : []),
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="hover:text-fg">
            {label}
          </a>
        ))}
      </nav>

      <Section id="coverage" title="Records by year of birth">
        <p className="mt-1 text-sm text-muted">
          Records from AKC Stud Books, {s.first_year}–{s.last_year}. Coverage is uneven
          {thin.length > 0 && <>; thin years: {thin.map(([a, z]) => (a === z ? a : `${a}–${z}`)).join(', ')}</>}. Gaps are in the scans we have, not in the
          breed. Click a bar to see that year’s dogs.{' '}
          <Link href="/about/coverage" className="text-accent hover:underline">
            More on coverage
          </Link>
        </p>
        <CoverageChart data={s.per_year} breedSlug={b.slug} />
      </Section>

      <Section id="browse" title="Browse by decade">
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {home.decades.map((d) => (
            <li key={d.decade}>
              <Link href={`/${b.slug}/browse/${d.decade}s`} className="block rounded-lg border border-line px-3 py-1.5 hover:border-accent">
                <span className="font-medium">{d.decade}s</span> <span className="text-muted">{d.n.toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="foundation" title="Foundation dogs">
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
      </Section>

      <Section id="influential" title="Most influential sires and dams">
        <p className="mt-1 text-sm text-muted">Ranked by what the records show, so dogs from well-covered years rank higher.</p>
        <div className="mt-4 grid gap-8 md:grid-cols-3">
          <RankList title="Sires by recorded offspring" items={home.topSiresByOffspring} unit="pups" />
          <RankList title="Dams by recorded offspring" items={home.topDamsByOffspring} unit="pups" />
          <RankList title="By descendants" note="Within five generations" items={home.topByDescendants} unit="desc." />
        </div>
      </Section>

      <Section id="breeders" title="Breeders and kennels with the most dogs bred">
        <ol className="mt-3 grid gap-x-8 text-sm sm:grid-cols-2">
          {home.breeders.map((p) => (
            <li key={p.id} className="border-b border-line">
              <Link href={personHref(p)} className="flex items-baseline gap-3 py-2 hover:bg-surface">
                <span className="font-medium">{displayName(p.full_name)}</span>
                <span className="ml-auto text-xs text-muted">
                  {p.n} dogs{p.first_year ? ` · ${p.first_year === p.last_year ? p.first_year : `${p.first_year}–${p.last_year}`}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Section>

      {articles.length > 0 && (
        <Section id="history" title="Breed history">
          <p className="mt-1 text-sm text-muted">Summaries written for this archive from historical club and magazine articles. The originals are not reproduced.</p>
          <div className="mt-4 space-y-8">
            {articles.map((a) => (
              <article key={a.id} id={`history-${a.id}`} className="scroll-mt-20">
                <h3 className="font-medium">{a.title}</h3>
                {a.publication_era && <p className="text-xs text-muted">{a.publication_era}</p>}
                <p className="mt-2 text-[15px] leading-relaxed">{a.summary_rewrite}</p>
                {a.mentions.length > 0 && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted">Dogs mentioned: </span>
                    {a.mentions.map((m, i) => (
                      <span key={m.label}>
                        {i > 0 && ', '}
                        {m.dog ? (
                          <Link href={dogHref(m.dog.breed_slug, m.dog.reg_number)} className="text-accent hover:underline">
                            {m.label}
                          </Link>
                        ) : (
                          m.label
                        )}
                      </span>
                    ))}
                  </p>
                )}
              </article>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
