import { ImageResponse } from 'next/og';
import { C, Frame, OG_SIZE } from '@/lib/og';

export const alt = 'Canine Pedigree Archive: trace a dog’s lineage back through the AKC stud books';
export const size = OG_SIZE;
export const contentType = 'image/png';

// A bare pedigree bracket: one dog, two parents, four grandparents, eight great-grandparents.
function Column({ n, tint }: { n: number; tint?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 120, marginLeft: 14 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ display: 'flex', flex: 1, margin: '4px 0', borderRadius: 6, background: tint ? (i % 2 ? C.dam : C.sire) : C.accent }} />
      ))}
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    <Frame kicker="Free and open archive">
      <div style={{ display: 'flex', flexDirection: 'column', width: 600, justifyContent: 'center' }}>
        <span style={{ fontSize: 68, letterSpacing: -1.5, lineHeight: 1.05 }}>Canine Pedigree Archive</span>
        <span style={{ fontSize: 30, color: C.muted, marginTop: 24, lineHeight: 1.35 }}>Trace a dog’s lineage back through the AKC stud books.</span>
      </div>
      <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', paddingBottom: 24 }}>
        <Column n={1} />
        <Column n={2} tint />
        <Column n={4} tint />
        <Column n={8} tint />
      </div>
    </Frame>,
    size,
  );
}
