// Wright's coefficient of inbreeding, computed exactly from the known pedigree by the coancestry
// (kinship) recursion: F(pup) = f(sire, dam), where
//   f(a, a) = (1 + f(sire(a), dam(a))) / 2
//   f(a, b) = (f(sire(a), b) + f(dam(a), b)) / 2, expanding whichever of a, b is not an ancestor of the other.
// Unknown parents count as unrelated founders, so the result is a lower bound: it can only grow as more
// ancestors become known. That is why every COI is shown with its depth and how complete the pedigree is.
import type { PedigreeNode } from './data';

/** Below this share of known ancestors beyond the parents, no number is shown. */
export const MIN_COMPLETENESS = 0.25;

export type CoiResult = {
  gens: number;
  coi: number; // 0..1
  /** Known ancestors beyond the parents, as a share of all slots beyond the parents. */
  completeness: number;
  enough: boolean;
  common: { node: PedigreeNode; sireSide: number; damSide: number }[];
};

/** `nodes` are the subject's ancestors with positions ('S', 'D', 'SD', ...) as returned by getPedigree. */
export function computeCoi(nodes: PedigreeNode[], gens: number): CoiResult {
  const byPos = new Map(nodes.map((n) => [n.pos, n]));
  const parents = new Map<string, [string | null, string | null]>();
  for (const n of nodes) {
    if (parents.has(n.reg_number)) continue;
    parents.set(n.reg_number, [byPos.get(n.pos + 'S')?.reg_number ?? null, byPos.get(n.pos + 'D')?.reg_number ?? null]);
  }
  // A dog can appear at several depths; keep the deepest known parents for it.
  for (const n of nodes) {
    const cur = parents.get(n.reg_number)!;
    parents.set(n.reg_number, [cur[0] ?? byPos.get(n.pos + 'S')?.reg_number ?? null, cur[1] ?? byPos.get(n.pos + 'D')?.reg_number ?? null]);
  }

  const rankMemo = new Map<string, number>();
  const rank = (x: string, seen = new Set<string>()): number => {
    const hit = rankMemo.get(x);
    if (hit !== undefined) return hit;
    if (seen.has(x)) return 0; // defensive: the query already excludes loops
    seen.add(x);
    const [s, d] = parents.get(x) ?? [null, null];
    const r = 1 + Math.max(s ? rank(s, seen) : 0, d ? rank(d, seen) : 0);
    rankMemo.set(x, r);
    return r;
  };

  const memo = new Map<string, number>();
  const kin = (a: string | null, b: string | null): number => {
    if (!a || !b) return 0;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let v: number;
    if (a === b) {
      const [s, d] = parents.get(a) ?? [null, null];
      v = (1 + kin(s, d)) / 2;
    } else {
      const [x, y] = rank(a) >= rank(b) ? [a, b] : [b, a];
      const [s, d] = parents.get(x) ?? [null, null];
      v = (kin(s, y) + kin(d, y)) / 2;
    }
    memo.set(key, v);
    return v;
  };

  const coi = kin(byPos.get('S')?.reg_number ?? null, byPos.get('D')?.reg_number ?? null);
  const beyond = nodes.filter((n) => n.pos.length >= 2 && n.pos.length <= gens).length;
  const slots = 2 ** (gens + 1) - 2 - 2;
  const completeness = slots > 0 ? beyond / slots : 0;

  const side = new Map<string, { node: PedigreeNode; sireSide: number; damSide: number }>();
  for (const n of nodes) {
    const e = side.get(n.reg_number) ?? { node: n, sireSide: 0, damSide: 0 };
    if (n.pos[0] === 'S') e.sireSide++;
    else e.damSide++;
    side.set(n.reg_number, e);
  }
  const common = [...side.values()].filter((e) => e.sireSide > 0 && e.damSide > 0).sort((a, b) => a.node.pos.length - b.node.pos.length);

  return { gens, coi, completeness, enough: byPos.has('S') && byPos.has('D') && completeness >= MIN_COMPLETENESS, common };
}

export function coiLabel(r: CoiResult): string {
  const pct = `${Math.round(r.completeness * 100)}% known ancestors`;
  if (!r.enough) return `${r.gens}-gen COI: not enough data (${pct})`;
  const v = r.coi * 100;
  return `${r.gens}-gen COI: ${v < 0.01 && v > 0 ? '<0.01' : v.toFixed(v >= 10 ? 1 : 2)}% (based on ${pct})`;
}
