import Link from 'next/link';
import { CopyButton, ShareButton } from './ClientBits';
import type { DogPage } from '@/lib/data';
import { RECORD_TYPE_LABEL, bornLabel, displayName, dogHref, isRealReg, personHref, recordType, sexLabel, sourceLine, usefulAka } from '@/lib/format';

export function DogHeader({ dog }: { dog: DogPage }) {
  const type = recordType(dog);
  const born = bornLabel(dog);
  const source = sourceLine(dog.stud_book_issue, dog.stud_book_issue_source);
  const fullName = `${dog.titles ? dog.titles + ' ' : ''}${displayName(dog.name)}`;
  const aka = usefulAka(dog.name, dog.aka_names);
  const facts = [sexLabel(dog.sex), dog.country].filter(Boolean);
  const breedQ = dog.breed_slug ? `breed=${dog.breed_slug}&` : '';

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
          {aka.length > 0 && <p className="mt-0.5 text-xs text-muted">Also recorded as {aka.map(displayName).join(', ')}</p>}
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
        <dt className="text-muted">Born</dt>
        <dd>
          {born && dog.birth_year ? (
            <>
              {born}
              <Link href={`/search?${breedQ}from=${dog.birth_year}&to=${dog.birth_year}&sort=name`} className="ml-2 text-xs text-accent hover:underline">
                All dogs born in {dog.birth_year}
              </Link>
            </>
          ) : dog.date_precision === 'disputed' ? (
            <span className="text-muted">Disputed: the records contradict each other</span>
          ) : (
            <span className="text-faint">Not recorded</span>
          )}
        </dd>
        <dt className="text-muted">Colour</dt>
        <dd>
          {dog.color_code ? (
            <Link href={`/search?${breedQ}color=${encodeURIComponent(dog.color_code)}&sort=oldest`} className="text-accent hover:underline" title="See every dog recorded with this colour">
              {dog.color_code}
            </Link>
          ) : (
            <span className="text-faint">Not recorded</span>
          )}
        </dd>
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

export function DogLink({ dog, breed }: { dog: { reg_number: string; name: string; titles: string | null }; breed: string | null }) {
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
