import Link from 'next/link';
import { Suspense } from 'react';
import { GensMemory, PrintButton, TodayDate } from '@/components/ClientBits';
import { WalkUp } from '@/components/WalkUp';
import { TabSkeleton } from '@/components/DogList';
import { PedigreeChart } from '@/components/PedigreeChart';
import { getDogNames, getPedigree } from '@/lib/data';
import { dogMetadata, loadDog } from '@/lib/dogRoute';
import { displayName, dogHref, isRealReg, sourceLine } from '@/lib/format';

type Props = PageProps<'/[breed]/dog/[reg]'>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function parseGens(v: string | undefined) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 2 && n <= 9 ? n : 4;
}

export async function generateMetadata({ params }: Props) {
  return dogMetadata((await params).reg, 'Pedigree');
}

export default function PedigreeTab(props: Props) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Pedigree {...props} />
    </Suspense>
  );
}

async function Pedigree({ params, searchParams }: Props) {
  const [{ breed, reg }, sp] = await Promise.all([params, searchParams]);
  const dog = await loadDog(breed, reg);
  const gens = parseGens(first(sp.gens));
  const showCommon = first(sp.common) === '1';
  const forceChart = first(sp.view) === 'chart';
  const trailRegs = (first(sp.from) ?? '').split(',').filter(Boolean).slice(-8);
  const [nodes, trail] = await Promise.all([getPedigree(dog.reg_number, gens), getDogNames(trailRegs)]);

  const here = (q: Record<string, string | number | undefined>) =>
    dogHref(dog.breed_slug, dog.reg_number, { gens, common: showCommon ? 1 : undefined, from: trailRegs.join(',') || undefined, ...q });

  return (
    <section aria-label="Pedigree">
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
      <div className="no-print mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
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
        <Link
          href={`/tools/test-mating?${dog.sex === 'B' ? 'dam' : 'sire'}=${encodeURIComponent(dog.reg_number)}`}
          className="text-sm text-muted hover:text-fg sm:ml-auto"
        >
          Test a mating with this dog
        </Link>
        <PrintButton />
      </div>
      <div className={forceChart ? 'hidden' : 'mb-6'}>
        <WalkUp nodes={nodes} breedSlug={dog.breed_slug ?? breed} gens={gens} trail={[...trailRegs, dog.reg_number].slice(-8).join(',')} />
      </div>
      <div className="mb-4 hidden print:block">
        <p className="text-xs">Canine Pedigree Archive · printed <TodayDate /></p>
        <p className="mt-1 text-lg font-semibold">
          {dog.titles ? `${dog.titles} ` : ''}
          {displayName(dog.name)}
          {isRealReg(dog.reg_number) ? ` (${dog.reg_number})` : ''}
        </p>
        <p className="text-xs">{[dog.breed_name, sourceLine(dog.stud_book_issue, dog.stud_book_issue_source)].filter(Boolean).join(' · ')}</p>
      </div>
      {!forceChart && (
        <Link href={here({ view: 'chart' })} className="no-print text-sm text-accent hover:underline sm:hidden">
          Show the full {gens}-generation chart
        </Link>
      )}
      <div className={forceChart ? '' : 'hidden sm:block print:block'}>
        <PedigreeChart nodes={nodes} gens={gens} breedSlug={dog.breed_slug ?? breed} trail={trailRegs} subjectReg={dog.reg_number} showCommon={showCommon} />
      </div>
    </section>
  );
}
