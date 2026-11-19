import { cacheLife } from 'next/cache';
import { pool } from './db';
import { getPedigree, type PedigreeNode } from './data';

type Self = Omit<PedigreeNode, 'pos'>;

async function selfNode(reg: string): Promise<Self | null> {
  const r = await pool.query<Self>(
    `select d.reg_number, d.name, d.titles, d.sex, coalesce(d.is_stub, true) as is_stub, d.birth_year, d.birth_month, d.birth_day, d.date_precision, d.breed_slug,
            (select count(*)::int from dogs k where k.sire_reg = d.reg_number or k.dam_reg = d.reg_number) as offspring_count
     from dogs d join breeds b on b.slug = d.breed_slug and b.is_live where d.reg_number = $1`,
    [reg],
  );
  return r.rows[0] ?? null;
}

/** The pedigree of a hypothetical pup of `sire` x `dam`, `gens` generations deep, in getPedigree's position format. */
export async function getMatingPedigree(sire: string, dam: string, gens: number): Promise<{ sire: Self | null; dam: Self | null; nodes: PedigreeNode[] }> {
  'use cache';
  cacheLife('hours');
  const [s, d] = await Promise.all([selfNode(sire), selfNode(dam)]);
  if (!s || !d) return { sire: s, dam: d, nodes: [] };
  const [sa, da] = await Promise.all([gens > 1 ? getPedigree(sire, gens - 1) : [], gens > 1 ? getPedigree(dam, gens - 1) : []]);
  const nodes: PedigreeNode[] = [
    { ...s, pos: 'S' },
    { ...d, pos: 'D' },
    ...sa.map((n) => ({ ...n, pos: 'S' + n.pos })),
    ...da.map((n) => ({ ...n, pos: 'D' + n.pos })),
  ];
  return { sire: s, dam: d, nodes };
}
