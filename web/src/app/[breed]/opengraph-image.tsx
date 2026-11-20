import { ImageResponse } from 'next/og';
import { getBreed, getBreedStats } from '@/lib/data';
import { C, Frame, OG_SIZE } from '@/lib/og';

export const alt = 'Breed records in the Canine Pedigree Archive';
export const size = OG_SIZE;
export const contentType = 'image/png';

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 56 }}>
      <span style={{ fontSize: 52, color: C.fg, letterSpacing: -1 }}>{n}</span>
      <span style={{ fontSize: 21, color: C.muted }}>{label}</span>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ breed: string }> }) {
  const b = await getBreed((await params).breed);
  if (!b?.is_live) {
    return new ImageResponse(
      <Frame kicker="Breed">
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 56 }}>Not found</div>
      </Frame>,
      size,
    );
  }
  const s = await getBreedStats(b.slug);
  const max = Math.max(1, ...s.per_year.map((p) => p.n));
  const by = new Map(s.per_year.map((p) => [p.year, p.n]));
  const years: number[] = [];
  if (s.first_year && s.last_year) for (let y = s.first_year; y <= s.last_year; y++) years.push(y);

  return new ImageResponse(
    <Frame kicker="Pedigrees and stud book records" footRight={s.first_year ? `AKC stud books, ${s.first_year}–${s.last_year}` : undefined}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <span style={{ fontSize: 66, letterSpacing: -1.5, lineHeight: 1.05 }}>{b.name}</span>
        <div style={{ display: 'flex', marginTop: 30 }}>
          <Stat n={s.dogs.toLocaleString('en-US')} label="dogs" />
          <Stat n={s.entries.toLocaleString('en-US')} label="stud book entries" />
          <Stat n={s.people.toLocaleString('en-US')} label="breeders and owners" />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, marginTop: 28, marginBottom: 20 }}>
          {years.map((y) => (
            <div
              key={y}
              style={{ display: 'flex', flex: 1, margin: '0 1px', height: `${Math.max(2, ((by.get(y) ?? 0) / max) * 100)}%`, background: (by.get(y) ?? 0) ? C.accent : C.line, borderRadius: 2 }}
            />
          ))}
        </div>
      </div>
    </Frame>,
    size,
  );
}
