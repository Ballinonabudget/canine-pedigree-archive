import Link from 'next/link';
import type { PedigreeNode } from '@/lib/data';
import { bornLabel, displayName, dogHref, isRealReg } from '@/lib/format';

/**
 * Phone view of the pedigree: the two parents as big tap targets, each with its own parents underneath.
 * Tapping a dog moves up the tree to that dog's page. Usable one-handed at a show.
 */
export function WalkUp({ nodes, breedSlug, gens, trail }: { nodes: PedigreeNode[]; breedSlug: string; gens: number; trail: string }) {
  const at = new Map(nodes.map((n) => [n.pos, n]));
  const card = (pos: string, big: boolean) => {
    const n = at.get(pos);
    const role = pos.endsWith('S') ? 'Sire' : 'Dam';
    if (!n)
      return (
        <div className={`rounded-lg border border-dashed border-line bg-unknown px-3 ${big ? 'py-3' : 'py-2'} text-sm text-faint`}>
          {role} unknown
        </div>
      );
    return (
      <Link
        href={dogHref(n.breed_slug || breedSlug, n.reg_number, { gens, from: trail || undefined })}
        className={`block rounded-lg border border-line ${pos[0] === 'S' ? 'bg-sire' : 'bg-dam'} px-3 ${big ? 'py-3' : 'py-2'} active:border-accent`}
      >
        <div className="text-[10px] font-medium uppercase tracking-wide text-faint">{role}</div>
        <div className={`${big ? 'text-base' : 'text-sm'} font-medium`}>
          {n.titles && <span className="mr-1 text-xs font-normal text-muted">{n.titles}</span>}
          {displayName(n.name)}
        </div>
        <div className="text-xs text-muted">
          {[bornLabel(n), isRealReg(n.reg_number) ? n.reg_number : null].filter(Boolean).join(' · ')}
        </div>
      </Link>
    );
  };
  return (
    <div className="space-y-4 sm:hidden print:hidden">
      {(['S', 'D'] as const).map((p) => (
        <div key={p}>
          {card(p, true)}
          {at.has(p) && (
            <div className="mt-2 ml-4 grid grid-cols-2 gap-2 border-l-2 border-line pl-3">
              {card(p + 'S', false)}
              {card(p + 'D', false)}
            </div>
          )}
        </div>
      ))}
      <p className="text-xs text-muted">
        Tap a dog to walk up its line. {nodes.length} of {2 ** (gens + 1) - 2} ancestors known in {gens} generations.
      </p>
    </div>
  );
}
