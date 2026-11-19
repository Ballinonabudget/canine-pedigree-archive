import Link from 'next/link';
import { Suspense } from 'react';
import { Empty, TabSkeleton } from '@/components/DogList';
import { dogMetadata, loadDog } from '@/lib/dogRoute';
import { displayName, isRealReg, sourceLine } from '@/lib/format';
import { getDetails } from '@/lib/queries';
import { getPedigree } from '@/lib/data';
import { coiLabel, computeCoi } from '@/lib/coi';

type Props = PageProps<'/[breed]/dog/[reg]/details'>;

export async function generateMetadata({ params }: Props) {
  return dogMetadata((await params).reg, 'Details');
}

export default function DetailsTab(props: Props) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Details {...props} />
    </Suspense>
  );
}

const PRECISION: Record<string, string> = { full: 'exact day', month: 'month only', year: 'year only', disputed: 'disputed: contradicted by offspring born earlier' };

async function Details({ params }: Props) {
  const { breed, reg } = await params;
  const dog = await loadDog(breed, reg, '/details');
  const [d, ped] = await Promise.all([getDetails(dog.reg_number), getPedigree(dog.reg_number, 5)]);
  const coi = computeCoi(ped, 5);
  if (!d) return <Empty>No details recorded.</Empty>;
  const spellings = [...new Set([d.name_raw, dog.name, ...dog.aka_names].filter((x): x is string => !!x))];

  const rows: [string, React.ReactNode][] = [
    ['Archive id', <span key="id" className="font-mono">{dog.reg_number}</span>],
    ['Registration as printed', d.reg_raw],
    ['Birth date as printed', d.birth_date && `${d.birth_date}${dog.date_precision ? ` (${PRECISION[dog.date_precision] ?? dog.date_precision})` : ''}`],
    ['Breed as printed', d.breed_raw],
    ['Litter code', dog.litter_code],
    ['Every spelling recorded', spellings.join(' · ')],
    ['Stud book issue', sourceLine(dog.stud_book_issue, dog.stud_book_issue_source)],
    [
      'Inbreeding coefficient',
      <span key="coi">
        {coiLabel(coi)}
        <span className="block text-xs text-muted">Counts only ancestors in our records, so the real figure may be higher.</span>
      </span>,
    ],
  ];

  return (
    <div className="space-y-8">
      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>

      <section>
        <h3 className="text-sm font-medium">Stud book appearances</h3>
        {d.appearances.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            {isRealReg(dog.reg_number) && !dog.is_stub ? 'No printed rows found for this registration.' : 'This dog has no stud book row of its own; it is known from its offspring’s entries.'}
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted">Each row as printed in the stud book, including any misprints or reading errors.</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1 pr-4 font-normal">Issue</th>
                    <th className="py-1 pr-4 font-normal">Name</th>
                    <th className="py-1 pr-4 font-normal">Born</th>
                    <th className="py-1 pr-4 font-normal">Sire</th>
                    <th className="py-1 pr-4 font-normal">Dam</th>
                    <th className="py-1 font-normal">Breed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.appearances.map((a, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-4 whitespace-nowrap">{a.issue ? (a.issue_source === 'interpolated' ? `around ${a.issue}` : a.issue) : '—'}</td>
                      <td className="py-1.5 pr-4">{[a.titles, a.name].filter(Boolean).join(' ')}</td>
                      <td className="py-1.5 pr-4 whitespace-nowrap">{a.birth_date}</td>
                      <td className="py-1.5 pr-4">{a.sire}</td>
                      <td className="py-1.5 pr-4">{a.dam}</td>
                      <td className="py-1.5">{a.breed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <p className="text-sm text-muted">
        Spotted a mistake in {displayName(dog.name)}’s record?{' '}
        <Link href="/about#corrections" className="text-accent hover:underline">
          Report an error
        </Link>
      </p>
    </div>
  );
}
