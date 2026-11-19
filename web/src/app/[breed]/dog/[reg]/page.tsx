import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { CopyButton, GensMemory, ShareButton } from '@/components/ClientBits';
import { PedigreeChart } from '@/components/PedigreeChart';
import { getDog, getDogNames, getPedigree, type DogPage } from '@/lib/data';
import { RECORD_TYPE_LABEL, bornLabel, displayName, dogHref, isRealReg, personHref, recordType, sexLabel, sourceLine, usefulAka } from '@/lib/format';

type Props = PageProps<'/[breed]/dog/[reg]'>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function parseGens(v: string | undefined) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 2 && n <= 9 ? n : 4;
}

function regFrom(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reg } = await params;
  const dog = await getDog(regFrom(reg));
  if (!dog) return { title: 'Dog not found' };
  const name = `${dog.titles ? dog.titles + ' ' : ''}${displayName(dog.name)}`;
  const bits = [name + (isRealReg(dog.reg_number) ? ` (${dog.reg_number})` : ''), dog.breed_name, dog.birth_year, 'Pedigree'].filter(Boolean);
  return {
    title: { absolute: bits.join(' · ') },
    description: `Pedigree of ${name}${dog.breed_name ? `, ${dog.breed_name}` : ''}${dog.birth_year ? `, born ${dog.birth_year}` : ''}. From the AKC stud book records.`,
  };
}

export default function DogRoute(props: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface" />}>
        <DogView {...props} />
      </Suspense>
    </div>
  );
}

async function DogView({ params, searchParams }: Props) {
  const [{ breed, reg: rawReg }, sp] = await Promise.all([params, searchParams]);
  const reg = regFrom(rawReg);
  const dog = await getDog(reg);
  if (dog && !dog.breed_live) notFound();
  if (!dog) {
    // An old "R75131/2" style link, or a reg typed with punctuation
    const clean = reg.toUpperCase().replace(/\/\d+$/, '').replace(/[^A-Z0-9_:\-]/g, '');
    if (clean !== reg) redirect(dogHref(breed, clean));
    notFound();
  }
  if (dog.breed_slug && dog.breed_slug !== breed) redirect(dogHref(dog.breed_slug, dog.reg_number));

  const gens = parseGens(first(sp.gens));
  const showCommon = first(sp.common) === '1';
  const trailRegs = (first(sp.from) ?? '').split(',').filter(Boolean).slice(-8);
  const [nodes, trail] = await Promise.all([getPedigree(dog.reg_number, gens), getDogNames(trailRegs)]);

  const here = (q: Record<string, string | number | undefined>) =>
    dogHref(dog.breed_slug, dog.reg_number, { gens, common: showCommon ? 1 : undefined, from: trailRegs.join(',') || undefined, ...q });

  return (
    <>
      <GensMemory gens={gens} />
      {trail.length > 0 && (
        <nav aria-label="Dogs you came from" className="no-print mb-4 flex flex-wrap items-center gap-1 text-xs text-muted">
          {trail.map((t, i) => (
            <span key={t.reg_number} className="flex items-center gap-1">
              <Link href={dogHref(t.breed_slug, t.reg_number, { gens, from: trailRegs.slice(0, i).join(',') || undefined })} className="hover:text-fg hover:underline">
                {displayName(t.name)}
              </Link>
              <span aria-hidden>›</span>
            </span>
          ))}
          <span className="text-fg">{displayName(dog.name)}</span>
        </nav>
      )}

      <DogHeader dog={dog} />

      <section aria-labelledby="pedigree-h" className="mt-8">
        <div className="no-print mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <h2 id="pedigree-h" className="text-lg font-semibold">
            Pedigree
          </h2>
          <div className="flex items-center gap-1 text-sm" role="group" aria-label="Generations">
            <span className="mr-1 text-muted">Generations</span>
            {[2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
              <Link
                key={g}
                href={here({ gens: g })}
                scroll={false}
                aria-current={g === gens ? 'true' : undefined}
                className={`rounded px-2 py-0.5 ${g === gens ? 'bg-accent text-bg' : 'text-muted hover:bg-surface hover:text-fg'}`}
              >
                {g}
              </Link>
            ))}
          </div>
          <Link href={here({ common: showCommon ? undefined : 1 })} scroll={false} className="text-sm text-muted hover:text-fg" aria-pressed={showCommon}>
            <span className={`mr-1.5 inline-block size-3 rounded-sm border align-[-1px] ${showCommon ? 'border-accent bg-accent' : 'border-line'}`} aria-hidden />
            Highlight repeated ancestors
          </Link>
        </div>
        <PedigreeChart nodes={nodes} gens={gens} breedSlug={dog.breed_slug ?? breed} trail={trailRegs} subjectReg={dog.reg_number} showCommon={showCommon} />
      </section>
    </>
  );
}

function DogHeader({ dog }: { dog: DogPage }) {
  const type = recordType(dog);
  const born = bornLabel(dog);
  const source = sourceLine(dog.stud_book_issue, dog.stud_book_issue_source);
  const fullName = `${dog.titles ? dog.titles + ' ' : ''}${displayName(dog.name)}`;
  const facts = [
    sexLabel(dog.sex),
    born ? `born ${born}` : dog.date_precision === 'disputed' ? 'birth date disputed in the records' : null,
    dog.color_code,
    dog.country,
  ].filter(Boolean);

  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {dog.titles &&
              dog.titles.split(/\s+/).map((t) => (
                <span key={t} className="rounded border border-line px-1.5 py-0.5 text-[11px] font-medium text-muted">
                  {t}
                </span>
              ))}
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${type === 'entry' ? 'bg-accent-soft text-accent' : 'bg-unknown text-muted'}`}>
              {RECORD_TYPE_LABEL[type]}
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">{displayName(dog.name)}</h1>
          {usefulAka(dog.name, dog.aka_names).length > 0 && (
            <p className="mt-0.5 text-xs text-muted">Also recorded as {usefulAka(dog.name, dog.aka_names).map(displayName).join(', ')}</p>
          )}
        </div>
        <ShareButton title={fullName} />
      </div>

      <p className="mt-3 text-sm">
        {facts.join(' · ')}
        {dog.breed_name && (
          <>
            {' · '}
            {dog.breed_name}
            {dog.historical_breed_label && <span className="text-muted"> (registered as {dog.historical_breed_label})</span>}
          </>
        )}
      </p>

      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        {isRealReg(dog.reg_number) && (
          <>
            <dt className="text-muted">Registration</dt>
            <dd className="flex items-center gap-1 font-mono">
              {dog.reg_number}
              {dog.litter_code && <span className="text-faint">/{dog.litter_code}</span>}
              <CopyButton text={dog.reg_number} label="Copy registration number" />
            </dd>
          </>
        )}
        <dt className="text-muted">Sire</dt>
        <dd>{dog.sire ? <DogLink dog={dog.sire} breed={dog.breed_slug} /> : <span className="text-faint">Unknown</span>}</dd>
        <dt className="text-muted">Dam</dt>
        <dd>{dog.dam ? <DogLink dog={dog.dam} breed={dog.breed_slug} /> : <span className="text-faint">Unknown</span>}</dd>
        {dog.breeders.length > 0 && (
          <>
            <dt className="text-muted">Bred by</dt>
            <dd>
              <PeopleLinks people={dog.breeders} />
            </dd>
          </>
        )}
        {dog.owners.length > 0 && (
          <>
            <dt className="text-muted">Owned by</dt>
            <dd>
              <PeopleLinks people={dog.owners} />
            </dd>
          </>
        )}
        {source && (
          <>
            <dt className="text-muted">Source</dt>
            <dd>{source}</dd>
          </>
        )}
      </dl>

      {type !== 'entry' && (
        <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
          This dog is known only as a parent in the records we have.
          {dog.offspring_count > 0 &&
            ` It appears as the ${dog.sex === 'B' ? 'dam' : dog.sex === 'D' ? 'sire' : 'parent'} of ${dog.offspring_count} recorded ${dog.offspring_count === 1 ? 'dog' : 'dogs'}`}
          {dog.offspring_count > 0 && dog.first_appearance ? `, the earliest born in ${dog.first_appearance}.` : dog.offspring_count > 0 ? '.' : ''}
        </p>
      )}
    </header>
  );
}

function DogLink({ dog, breed }: { dog: { reg_number: string; name: string; titles: string | null }; breed: string | null }) {
  return (
    <Link href={dogHref(breed, dog.reg_number)} className="text-accent hover:underline">
      {dog.titles && <span className="mr-1 text-xs">{dog.titles}</span>}
      {displayName(dog.name)}
      {isRealReg(dog.reg_number) && <span className="ml-1.5 font-mono text-xs text-faint">{dog.reg_number}</span>}
    </Link>
  );
}

function PeopleLinks({ people }: { people: { id: number; full_name: string }[] }) {
  return (
    <>
      {people.map((p, i) => (
        <span key={p.id}>
          {i > 0 && ', '}
          <Link href={personHref(p)} className="text-accent hover:underline">
            {displayName(p.full_name)}
          </Link>
        </span>
      ))}
    </>
  );
}
