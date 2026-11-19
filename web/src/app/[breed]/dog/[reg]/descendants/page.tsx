import Link from 'next/link';
import { Suspense } from 'react';
import { DogRows, Empty, TabSkeleton } from '@/components/DogList';
import { dogMetadata, loadDog } from '@/lib/dogRoute';
import { displayName } from '@/lib/format';
import { getDescendants } from '@/lib/queries';

type Props = PageProps<'/[breed]/dog/[reg]/descendants'>;
const PER_GEN = 150;
const GEN_NAME = ['', 'Children', 'Grandchildren', 'Great-grandchildren', '4th generation', '5th generation'];

export async function generateMetadata({ params }: Props) {
  return dogMetadata((await params).reg, 'Descendants');
}

export default function DescendantsTab(props: Props) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Descendants {...props} />
    </Suspense>
  );
}

async function Descendants({ params }: Props) {
  const { breed, reg } = await params;
  const dog = await loadDog(breed, reg, '/descendants');
  const gens = await getDescendants(dog.reg_number, 5, PER_GEN);
  if (!gens.length) return <Empty>No descendants of {displayName(dog.name)} appear in the records we have.</Empty>;
  const total = gens.reduce((n, g) => n + g.count, 0);

  return (
    <section aria-label="Descendants">
      <p className="text-sm text-muted">
        {total} recorded {total === 1 ? 'descendant' : 'descendants'} across {gens.length} {gens.length === 1 ? 'generation' : 'generations'}. A dog that descends
        by more than one path is counted once, in its nearest generation.
      </p>
      <table className="mt-3 text-sm">
        <tbody>
          {gens.map((g) => (
            <tr key={g.gen}>
              <th scope="row" className="py-0.5 pr-6 text-left font-normal text-muted">
                {GEN_NAME[g.gen]}
              </th>
              <td className="text-right tabular-nums">{g.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {gens.map((g) => (
        <details key={g.gen} open={g.gen === 1} className="mt-6">
          <summary className="cursor-pointer text-sm font-medium">
            {GEN_NAME[g.gen]} <span className="font-normal text-muted">({g.count})</span>
          </summary>
          <div className="mt-1">
            <DogRows dogs={g.dogs} />
          </div>
          {g.count > g.dogs.length && (
            <p className="mt-2 text-xs text-muted">
              Showing the oldest {g.dogs.length} of {g.count}.{' '}
              <Link href={`/search?desc=${encodeURIComponent(dog.reg_number)}&sort=oldest`} className="text-accent hover:underline">
                Browse all descendants
              </Link>
            </p>
          )}
        </details>
      ))}
    </section>
  );
}
