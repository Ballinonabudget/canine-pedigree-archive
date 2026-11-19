import Link from 'next/link';
import type { Ranked } from '@/lib/breed';
import { displayName, dogHref } from '@/lib/format';

export function CoverageChart({ data, breedSlug }: { data: { year: number; n: number }[]; breedSlug?: string }) {
  if (!data.length) return null;
  const from = data[0].year;
  const to = data[data.length - 1].year;
  const byYear = new Map(data.map((d) => [d.year, d.n]));
  const max = Math.max(...data.map((d) => d.n));
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const W = 720;
  const H = 140;
  const bw = W / years.length;
  const decades = years.filter((y) => y % 10 === 0);
  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label={`Dogs per birth year, ${from} to ${to}`}>
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" />
        {years.map((y, i) => {
          const n = byYear.get(y) ?? 0;
          const h = n ? Math.max(2, (n / max) * (H - 8)) : 0;
          const bar = (
            <rect x={i * bw + 0.5} y={H - h} width={Math.max(1, bw - 1)} height={h} rx={1} fill="var(--accent)">
              <title>{`${y}: ${n} dogs`}</title>
            </rect>
          );
          return breedSlug && n ? (
            <a key={y} href={`/search?breed=${breedSlug}&from=${y}&to=${y}&sort=name`}>
              {bar}
            </a>
          ) : (
            <g key={y}>{bar}</g>
          );
        })}
        {decades.map((y) => (
          <text key={y} x={(y - from) * bw} y={H + 15} fontSize={11} fill="var(--muted)">
            {y}
          </text>
        ))}
      </svg>
      <figcaption className="sr-only">{data.map((d) => `${d.year}: ${d.n}`).join(', ')}</figcaption>
    </figure>
  );
}

export function RankList({ title, note, items, unit }: { title: string; note?: string; items: Ranked[]; unit: string }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {note && <p className="text-xs text-muted">{note}</p>}
      <ol className="mt-2 divide-y divide-line text-sm">
        {items.map((d, i) => (
          <li key={d.reg_number}>
            <Link href={dogHref(d.breed_slug, d.reg_number)} className="flex items-baseline gap-2 py-1.5 hover:bg-surface">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-faint">{i + 1}</span>
              <span className="min-w-0 truncate">
                {d.titles && <span className="mr-1 text-xs text-muted">{d.titles}</span>}
                {displayName(d.name)}
              </span>
              {d.birth_year && <span className="text-xs text-muted">{d.birth_year}</span>}
              <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">
                {d.n} {unit}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
