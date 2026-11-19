import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CoverageChart } from '@/components/BreedBits';
import { gaps, getCoverage } from '@/lib/breed';

export const metadata: Metadata = {
  title: 'Coverage: what the archive has and what’s missing',
  description: 'Which years the American Staffordshire Terrier records cover, how complete the pedigrees are, and how stud book issues were dated.',
};

const SOURCE_LABEL: Record<string, string> = {
  header: 'Dated from the page’s own heading',
  pub_date: 'Dated from the entry’s own publication date',
  interpolated: 'Dated from neighbouring pages (shown as “around”)',
  estimated: 'Estimated from birth dates on the page (shown as approximate)',
  none: 'No date',
};

export default function CoverageRoute() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-xs text-muted">
        <Link href="/about" className="hover:text-fg">
          About
        </Link>{' '}
        › Coverage
      </nav>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Coverage</h1>
      <p className="mt-2 text-muted">American Staffordshire Terrier records, including dogs registered as Staffordshire Terriers before 1972.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-lg bg-surface" />}>
        <CoverageView />
      </Suspense>
    </article>
  );
}

function pct(n: number, total: number) {
  return total ? `${Math.round((100 * n) / total)}%` : '—';
}

async function CoverageView() {
  const c = await getCoverage('amstaff');
  const thin = gaps(c.per_year);
  return (
    <>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Dogs by year of birth</h2>
        {thin.length > 0 && (
          <p className="mt-1 text-sm text-muted">
            Years with fewer than five dogs: {thin.map(([a, z]) => (a === z ? a : `${a}–${z}`)).join(', ')}. Pedigrees that pass through these years usually stop there.
          </p>
        )}
        <CoverageChart data={c.per_year} breedSlug="amstaff" />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">How deep the pedigrees go</h2>
        <p className="mt-1 text-sm text-muted">Out of {c.entries.toLocaleString()} stud book entries.</p>
        <table className="mt-3 text-sm">
          <tbody>
            {c.depth.map((d) => (
              <tr key={d.label}>
                <th scope="row" className="py-1 pr-8 text-left font-normal">
                  {d.label}
                </th>
                <td className="py-1 pr-4 text-right tabular-nums">{d.n.toLocaleString()}</td>
                <td className="py-1 text-right tabular-nums text-muted">{pct(d.n, c.entries)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">How each entry was dated</h2>
        <p className="mt-1 text-sm text-muted">Each dog page names the stud book issue its entry came from. Not every scanned page shows its date, so some issues are inferred.</p>
        <table className="mt-3 text-sm">
          <tbody>
            {c.issue_sources.map((s) => (
              <tr key={s.source}>
                <th scope="row" className="py-1 pr-8 text-left font-normal">
                  {SOURCE_LABEL[s.source] ?? s.source}
                </th>
                <td className="py-1 pr-4 text-right tabular-nums">{s.n.toLocaleString()}</td>
                <td className="py-1 text-right tabular-nums text-muted">{pct(s.n, c.entries)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
