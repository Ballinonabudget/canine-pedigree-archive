import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { DogPicker } from '@/components/DogPicker';
import { PedigreeChart } from '@/components/PedigreeChart';
import { coiLabel, computeCoi, MIN_COMPLETENESS } from '@/lib/coi';
import { displayName, dogHref } from '@/lib/format';
import { getMatingPedigree } from '@/lib/mating';

type Props = PageProps<'/tools/test-mating'>;

export const metadata: Metadata = {
  title: 'Test mating and inbreeding coefficient (COI)',
  description: 'Pick a sire and a dam to see the hypothetical litter’s pedigree, shared ancestors and inbreeding coefficient, with how complete the data is.',
};

function first(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

export default function TestMatingRoute(props: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">Tools</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Test mating</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Pick a sire and a dam to see the pedigree their pups would have, which ancestors they share, and the inbreeding coefficient (COI). The COI only counts ancestors
        in our records, so with gaps in the records it can only understate the real figure.
      </p>
      <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-lg bg-surface" />}>
        <Mating {...props} />
      </Suspense>
    </div>
  );
}

async function Mating({ searchParams }: Props) {
  const sp = await searchParams;
  const sireReg = first(sp.sire).toUpperCase();
  const damReg = first(sp.dam).toUpperCase();
  const g = Number(first(sp.gens));
  const gens = Number.isInteger(g) && g >= 3 && g <= 9 ? g : 5;
  const ready = sireReg && damReg && sireReg !== damReg;
  const m = ready ? await getMatingPedigree(sireReg, damReg, gens) : null;
  const label = (d: { reg_number: string; name: string; birth_year: number | null } | null | undefined) =>
    d ? { reg: d.reg_number, label: `${displayName(d.name)}${d.birth_year ? ` (${d.birth_year})` : ''}` } : undefined;

  const result = m && m.sire && m.dam ? computeCoi(m.nodes, gens) : null;
  const here = (q: Record<string, string | number>) => `/tools/test-mating?${new URLSearchParams({ sire: sireReg, dam: damReg, gens: String(gens), ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <>
      <form action="/tools/test-mating" className="mt-6 grid max-w-3xl gap-4 rounded-lg border border-line p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <DogPicker key={`s-${sireReg}`} name="sire" label="Sire" sex="D" initial={label(m?.sire) ?? (sireReg ? { reg: sireReg, label: sireReg } : undefined)} />
        <DogPicker key={`d-${damReg}`} name="dam" label="Dam" sex="B" initial={label(m?.dam) ?? (damReg ? { reg: damReg, label: damReg } : undefined)} />
        <input type="hidden" name="gens" value={gens} />
        <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg">
          Show mating
        </button>
      </form>

      {sireReg && damReg && sireReg === damReg && <p className="mt-6 text-sm text-muted">Pick two different dogs.</p>}
      {m && (!m.sire || !m.dam) && <p className="mt-6 text-sm text-muted">One of those registration numbers isn’t in the records we have.</p>}

      {result && m?.sire && m.dam && (
        <section className="mt-8" aria-label="Result">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="text-lg">
              <span className="font-semibold">{coiLabel(result)}</span>
            </p>
            {!result.enough && (
              <p className="text-sm text-muted">
                We only show a number when at least {Math.round(MIN_COMPLETENESS * 100)}% of the ancestors beyond the parents are known. Try fewer generations, or dogs
                from better-covered years.
              </p>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {displayName(m.sire.name)} × {displayName(m.dam.name)}
          </p>

          <div className="no-print mt-4 flex items-center gap-1 text-sm" role="group" aria-label="Generations">
            <span className="mr-1 text-muted">Generations</span>
            {[3, 4, 5, 6, 7, 8, 9].map((n) => (
              <Link
                key={n}
                href={here({ gens: n })}
                scroll={false}
                aria-current={n === gens ? 'true' : undefined}
                className={`rounded px-2 py-0.5 ${n === gens ? 'bg-accent text-bg' : 'text-muted hover:bg-surface hover:text-fg'}`}
              >
                {n}
              </Link>
            ))}
          </div>

          <div className="mt-4">
            <PedigreeChart nodes={m.nodes} gens={gens} breedSlug={m.sire.breed_slug ?? 'amstaff'} trail={[]} subjectReg="" showCommon />
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-medium">Ancestors on both sides</h2>
            {result.common.length === 0 ? (
              <p className="mt-1 text-sm text-muted">The sire’s and dam’s known ancestors don’t overlap within {gens} generations.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {result.common.map((c) => (
                  <li key={c.node.reg_number} className="flex items-baseline gap-3 py-1.5">
                    <Link href={dogHref(c.node.breed_slug, c.node.reg_number)} className="text-accent hover:underline">
                      {displayName(c.node.name)}
                    </Link>
                    <span className="ml-auto text-xs text-muted">
                      {c.sireSide}× on the sire’s side · {c.damSide}× on the dam’s side
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </>
  );
}
