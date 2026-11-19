import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getBreedColors } from '@/lib/breed';
import { getBreed } from '@/lib/data';

type Props = PageProps<'/[breed]/colors'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getBreed((await params).breed);
  if (!b?.is_live) return { title: 'Not found' };
  return { title: `${b.name} colours`, description: `Every colour recorded for ${b.name}s in the AKC stud books, with how many dogs had each.` };
}

export default function ColorsRoute(props: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface" />}>
        <Colors {...props} />
      </Suspense>
    </div>
  );
}

async function Colors({ params }: Props) {
  const b = await getBreed((await params).breed);
  if (!b?.is_live) notFound();
  const colors = await getBreedColors(b.slug);
  const total = colors.reduce((n, c) => n + c.n, 0);
  return (
    <>
      <nav className="text-xs text-muted">
        <Link href={`/${b.slug}`} className="hover:text-fg">
          {b.name}
        </Link>{' '}
        › Colours
      </nav>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Colours</h1>
      <p className="mt-2 text-sm text-muted">
        The stud books abbreviate colours many ways (“BLK &amp; WH”, “Blk, wh”, “BRDL &amp; WH”). Here each is spelled out in full, so one colour is one entry.
        {` ${total.toLocaleString()} dogs, ${colors.length} colours.`} Each dog’s Details tab still shows the colour as printed.
      </p>
      <ul className="mt-6 divide-y divide-line text-sm">
        {colors.map((c) => (
          <li key={c.color}>
            <Link href={`/search?breed=${b.slug}&color=${encodeURIComponent(c.color)}&sort=oldest`} className="flex items-baseline gap-3 py-2 hover:bg-surface">
              <span className="font-medium">{c.color}</span>
              {c.spellings > 1 && <span className="text-xs text-muted">{c.spellings} spellings in the books</span>}
              <span className="ml-auto tabular-nums text-muted">{c.n.toLocaleString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
