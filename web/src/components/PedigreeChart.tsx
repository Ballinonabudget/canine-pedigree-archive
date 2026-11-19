import Link from 'next/link';
import type { PedigreeNode } from '@/lib/data';
import { bornLabel, displayName, dogHref, isRealReg, recordType } from '@/lib/format';

// Distinct, readable in light and dark. Each repeated ancestor also gets a number, so colour is never the only cue.
const COMMON_COLORS = ['#c2410c', '#7c3aed', '#0f766e', '#b45309', '#be185d', '#1d4ed8', '#4d7c0f', '#9f1239'];

type Props = {
  nodes: PedigreeNode[];
  gens: number;
  breedSlug: string;
  trail: string[];
  subjectReg: string;
  showCommon: boolean;
};

function indexOf(pos: string) {
  let i = 0;
  for (const c of pos) i = i * 2 + (c === 'D' ? 1 : 0);
  return i;
}

export function commonAncestors(nodes: PedigreeNode[]) {
  const counts = new Map<string, { node: PedigreeNode; n: number }>();
  for (const node of nodes) {
    const c = counts.get(node.reg_number);
    if (c) c.n++;
    else counts.set(node.reg_number, { node, n: 1 });
  }
  return [...counts.values()].filter((c) => c.n > 1).sort((a, b) => b.n - a.n || a.node.pos.length - b.node.pos.length);
}

export function PedigreeChart({ nodes, gens, breedSlug, trail, subjectReg, showCommon }: Props) {
  const byPos = new Map(nodes.map((n) => [n.pos, n]));
  const rows = 2 ** gens;
  const rowH = gens <= 3 ? 52 : gens === 4 ? 44 : 27;
  const nextTrail = [...trail, subjectReg].slice(-8).join(',');
  const common = commonAncestors(nodes);
  const colorOf = new Map(showCommon ? common.slice(0, COMMON_COLORS.length).map((c, i) => [c.node.reg_number, i]) : []);

  const cells: React.ReactNode[] = [];
  const visit = (pos: string) => {
    const g = pos.length;
    const node = byPos.get(pos);
    const span = 2 ** (gens - g);
    const rowStart = indexOf(pos) * span + 1;
    const tint = pos[0] === 'S' ? 'bg-sire' : 'bg-dam';
    if (!node) {
      cells.push(
        <div
          key={pos}
          style={{ gridColumn: `${g} / ${gens + 1}`, gridRow: `${rowStart} / span ${span}` }}
          className="flex items-center p-0.5"
        >
          <div className="flex h-full min-h-0 w-full items-center rounded border border-dashed border-line bg-unknown px-2 text-xs text-faint">
            {g === 1 ? (pos === 'S' ? 'Sire unknown' : 'Dam unknown') : g < gens ? 'Unknown · records end here' : 'Unknown'}
          </div>
        </div>,
      );
      return;
    }
    const compact = g >= 5;
    const ci = colorOf.get(node.reg_number);
    const born = bornLabel(node);
    const tip = [
      `${node.titles ? node.titles + ' ' : ''}${displayName(node.name)}`,
      born && `Born ${born}`,
      isRealReg(node.reg_number) && node.reg_number,
      `${node.offspring_count} recorded offspring`,
    ]
      .filter(Boolean)
      .join('\n');
    cells.push(
      <div key={pos} style={{ gridColumn: g, gridRow: `${rowStart} / span ${span}` }} className="flex items-center p-0.5">
        <Link
          href={dogHref(node.breed_slug || breedSlug, node.reg_number, { gens, from: nextTrail })}
          title={tip}
          style={ci !== undefined ? { boxShadow: `inset 3px 0 0 ${COMMON_COLORS[ci]}`, borderColor: COMMON_COLORS[ci] } : undefined}
          className={`block w-full min-w-0 rounded border border-line ${tint} px-2 ${compact ? 'py-0.5' : 'py-1'} hover:border-accent`}
        >
          {g === 1 && <div className="text-[10px] font-medium uppercase tracking-wide text-faint">{pos === 'S' ? 'Sire' : 'Dam'}</div>}
          <div className={`flex min-w-0 items-baseline gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
            {ci !== undefined && (
              <span className="shrink-0 rounded px-1 text-[10px] font-semibold text-white" style={{ background: COMMON_COLORS[ci] }}>
                {ci + 1}
              </span>
            )}
            <span className="truncate font-medium">
              {!compact && node.titles && <span className="mr-1 text-xs font-normal text-muted">{node.titles}</span>}
              {displayName(node.name)}
            </span>
            {compact && isRealReg(node.reg_number) && <span className="ml-auto shrink-0 font-mono text-[11px] text-faint">{node.reg_number}</span>}
          </div>
          {!compact && (
            <div className="flex gap-2 truncate text-xs text-muted">
              {born && <span>{born}</span>}
              {isRealReg(node.reg_number) && <span className="font-mono text-faint">{node.reg_number}</span>}
              {recordType(node) === 'unregistered' && <span className="text-faint">Unregistered / import</span>}
            </div>
          )}
        </Link>
      </div>,
    );
    if (g < gens) {
      visit(pos + 'S');
      visit(pos + 'D');
    }
  };
  visit('S');
  visit('D');

  const total = 2 ** (gens + 1) - 2;
  const known = nodes.length;

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div
          role="tree"
          aria-label={`${gens}-generation pedigree`}
          className="grid min-w-[720px]"
          style={{ gridTemplateColumns: `repeat(${gens}, minmax(${gens >= 6 ? 170 : 200}px, 1fr))`, gridTemplateRows: `repeat(${rows}, ${rowH}px)`, ['--rows' as string]: rows }}
        >
          {cells}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        {known} of {total} ancestors known ({Math.round((100 * known) / total)}%)
      </p>
      {showCommon && (
        <div className="mt-3 text-sm">
          {common.length === 0 ? (
            <p className="text-muted">No ancestor appears more than once in these {gens} generations.</p>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {common.map((c, i) => (
                <li key={c.node.reg_number} className="flex items-center gap-1.5">
                  {i < COMMON_COLORS.length && (
                    <span className="rounded px-1 text-[10px] font-semibold text-white" style={{ background: COMMON_COLORS[i] }}>
                      {i + 1}
                    </span>
                  )}
                  <Link href={dogHref(c.node.breed_slug || breedSlug, c.node.reg_number, { gens })} className="hover:underline">
                    {displayName(c.node.name)}
                  </Link>
                  <span className="text-muted">× {c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
