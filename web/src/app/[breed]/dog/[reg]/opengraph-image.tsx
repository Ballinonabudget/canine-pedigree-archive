import { ImageResponse } from 'next/og';
import { getDog, getPedigree, type PedigreeNode } from '@/lib/data';
import { displayName, isRealReg, sexLabel } from '@/lib/format';
import { C, fit, Frame, OG_SIZE } from '@/lib/og';
import { regFrom } from '@/lib/dogRoute';

export const alt = 'Pedigree card from the Canine Pedigree Archive';
export const size = OG_SIZE;
export const contentType = 'image/png';

function Box({ node, side, big }: { node: PedigreeNode | undefined; side: 'S' | 'D'; big?: boolean }) {
  const name = node ? `${node.titles ? node.titles + ' ' : ''}${displayName(node.name)}` : 'Unknown';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: 1,
        margin: '5px 0',
        padding: '0 18px',
        borderRadius: 10,
        background: node ? (side === 'S' ? C.sire : C.dam) : C.unknown,
        borderLeft: `5px solid ${node ? (side === 'S' ? '#7d9db3' : '#c29a8f') : C.line}`,
      }}
    >
      <span style={{ fontSize: big ? 24 : 19, color: node ? C.fg : C.faint, lineHeight: 1.2 }}>{fit(name, big ? 30 : 34)}</span>
      {node?.birth_year && big && <span style={{ fontSize: 17, color: C.muted, marginTop: 4 }}>{`${side === 'S' ? 'Sire' : 'Dam'} · ${node.birth_year}`}</span>}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ breed: string; reg: string }> }) {
  const { reg } = await params;
  const dog = await getDog(regFrom(reg));
  if (!dog) {
    return new ImageResponse(
      <Frame kicker="Pedigree">
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 56 }}>Dog not found</div>
      </Frame>,
      size,
    );
  }
  const tree = await getPedigree(dog.reg_number, 2);
  const at = (pos: string) => tree.find((n) => n.pos === pos);
  const name = displayName(dog.name);
  const facts = [dog.birth_year ? `Born ${dog.birth_year}` : null, sexLabel(dog.sex), dog.color, isRealReg(dog.reg_number) ? dog.reg_number : null].filter(Boolean);
  const nameSize = name.length > 34 ? 46 : name.length > 24 ? 54 : 62;

  return new ImageResponse(
    <Frame kicker={`${dog.breed_name ?? 'Dog'} · Pedigree`}>
      <div style={{ display: 'flex', flexDirection: 'column', width: 470, paddingRight: 36, justifyContent: 'center' }}>
        {dog.titles && <span style={{ fontSize: 26, color: C.accent, marginBottom: 8 }}>{dog.titles}</span>}
        <span style={{ fontSize: nameSize, lineHeight: 1.08, letterSpacing: -1 }}>{fit(name, 52)}</span>
        <span style={{ fontSize: 24, color: C.muted, marginTop: 22, lineHeight: 1.4 }}>{facts.join(' · ')}</span>
      </div>
      <div style={{ display: 'flex', flex: 1, paddingBottom: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 300, marginRight: 14 }}>
          <Box node={at('S')} side="S" big />
          <Box node={at('D')} side="D" big />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <Box node={at('SS')} side="S" />
          <Box node={at('SD')} side="D" />
          <Box node={at('DS')} side="S" />
          <Box node={at('DD')} side="D" />
        </div>
      </div>
    </Frame>,
    size,
  );
}
