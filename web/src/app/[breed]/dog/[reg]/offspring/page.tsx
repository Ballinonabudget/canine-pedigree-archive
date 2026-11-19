import Link from 'next/link';
import { Suspense } from 'react';
import { DogRows, Empty, TabSkeleton } from '@/components/DogList';
import { dogMetadata, loadDog } from '@/lib/dogRoute';
import { bornLabel, displayName, dogHref } from '@/lib/format';
import { getOffspring } from '@/lib/queries';

type Props = PageProps<'/[breed]/dog/[reg]/offspring'>;

export async function generateMetadata({ params }: Props) {
  return dogMetadata((await params).reg, 'Offspring');
}

export default function OffspringTab(props: Props) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Offspring {...props} />
    </Suspense>
  );
}

async function Offspring({ params }: Props) {
  const { breed, reg } = await params;
  const dog = await loadDog(breed, reg, '/offspring');
  const litters = await getOffspring(dog.reg_number);
  const total = litters.reduce((n, l) => n + l.pups.length, 0);
  if (!total) return <Empty>No offspring of {displayName(dog.name)} appear in the records we have.</Empty>;
  const otherRole = dog.sex === 'B' ? 'Sire' : 'Dam';

  return (
    <section aria-label="Offspring">
      <p className="text-sm text-muted">
        {total} {total === 1 ? 'offspring' : 'offspring'} in {litters.length} {litters.length === 1 ? 'litter' : 'litters'}, newest first. Pups born on the same day
        to the same {otherRole.toLowerCase()} are grouped as one litter.
      </p>
      <div className="mt-4 space-y-6">
        {litters.map((l, i) => (
          <div key={i}>
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{bornLabel(l.born) ?? 'Birth date not recorded'}</span>
              <span className="text-muted">
                · {otherRole}:{' '}
                {l.other ? (
                  <Link href={dogHref(dog.breed_slug, l.other.reg_number)} className="text-accent hover:underline">
                    {displayName(l.other.name)}
                  </Link>
                ) : (
                  'unknown'
                )}
              </span>
              <span className="text-faint">
                · {l.pups.length} {l.pups.length === 1 ? 'pup' : 'pups'}
              </span>
            </h3>
            <div className="mt-1">
              <DogRows dogs={l.pups} showBorn={false} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
