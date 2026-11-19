import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getPerson, type PersonPage } from '@/lib/data';
import { displayName, dogHref, isRealReg, personHref } from '@/lib/format';

type Props = PageProps<'/people/[id]'>;

const idOf = (raw: string) => Number(raw.split('-')[0]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPerson(idOf((await params).id));
  if (!p) return { title: 'Not found' };
  const name = displayName(p.full_name);
  return {
    title: `${name} · ${p.kind === 'kennel' ? 'Kennel' : 'Breeder and owner'}`,
    description: `${p.dog_count} dogs bred or owned by ${name}${p.first_year ? `, ${p.first_year}–${p.last_year}` : ''}, from the AKC stud book records.`,
  };
}

export default function PersonRoute(props: Props) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-surface" />}>
        <PersonView {...props} />
      </Suspense>
    </div>
  );
}

async function PersonView({ params }: Props) {
  const { id } = await params;
  const p = await getPerson(idOf(id));
  if (!p) notFound();
  const canonical = personHref(p).split('/').pop();
  if (canonical !== id) redirect(personHref(p));

  const bred = p.dogs.filter((d) => d.roles.includes('B'));
  const owned = p.dogs.filter((d) => d.roles.includes('O'));

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{p.kind === 'kennel' ? 'Kennel' : 'Person'}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{displayName(p.full_name)}</h1>
      <p className="mt-2 text-sm text-muted">
        {p.dog_count} {p.dog_count === 1 ? 'dog' : 'dogs'} in the records
        {p.first_year && ` · active ${p.first_year === p.last_year ? p.first_year : `${p.first_year}–${p.last_year}`}`}
      </p>
      {p.initials_only && (
        <p className="mt-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-muted">
          This name may refer to more than one person. The stud books often list owners by initials only.
        </p>
      )}
      {p.co_people.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="text-muted">Co-owned dogs with </span>
          {p.co_people.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              <Link href={personHref(c)} className="text-accent hover:underline">
                {displayName(c.full_name)}
              </Link>
            </span>
          ))}
        </p>
      )}
      <DogList title="Dogs bred" dogs={bred} />
      <DogList title="Dogs owned" dogs={owned} />
    </>
  );
}

function DogList({ title, dogs }: { title: string; dogs: PersonPage['dogs'] }) {
  if (!dogs.length) return null;
  const groups = new Map<string, PersonPage['dogs']>();
  for (const d of dogs) {
    const k = d.breed_name ?? 'Breed not recorded';
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">
        {title} <span className="text-sm font-normal text-muted">({dogs.length})</span>
      </h2>
      {[...groups].map(([breed, list]) => (
        <div key={breed} className="mt-3">
          {groups.size > 1 && <h3 className="text-xs font-medium uppercase tracking-wide text-faint">{breed}</h3>}
          <ul className="mt-1 divide-y divide-line text-sm">
            {list.map((d) => (
              <li key={d.reg_number}>
                <Link href={dogHref(d.breed_slug, d.reg_number)} className="flex items-baseline gap-3 py-2 hover:bg-surface">
                  <span className="w-12 shrink-0 text-muted">{d.birth_year ?? '—'}</span>
                  <span className="font-medium">
                    {d.titles && <span className="mr-1 text-xs font-normal text-muted">{d.titles}</span>}
                    {displayName(d.name)}
                  </span>
                  <span className="ml-auto text-xs text-muted">{d.sex === 'D' ? 'Dog' : d.sex === 'B' ? 'Bitch' : ''}</span>
                  {isRealReg(d.reg_number) && <span className="font-mono text-xs text-faint">{d.reg_number}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
