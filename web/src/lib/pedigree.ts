import { pool } from './db';

export interface Dog {
  reg_number: string;
  name: string;
  titles?: string | null;
  sex: string;
  birth_date?: string | null;
  color_code?: string | null;
  breed: string;
  sire_reg?: string | null;
  dam_reg?: string | null;
  is_stub: boolean;
  source_file?: string | null;
  breeders?: string[];
  owners?: string[];
}

export interface PedigreeNode {
  reg_number: string;
  name: string;
  titles?: string | null;
  sex: string;
  breed: string;
  generation: number;
  sire?: PedigreeNode | null;
  dam?: PedigreeNode | null;
}

export async function getDogByReg(reg: string): Promise<Dog | null> {
  const dogRes = await pool.query(
    `SELECT d.*, 
       COALESCE(ARRAY_AGG(DISTINCT p.full_name) FILTER (WHERE dp.role = 'B'), '{}') as breeders,
       COALESCE(ARRAY_AGG(DISTINCT p.full_name) FILTER (WHERE dp.role = 'O'), '{}') as owners
     FROM dogs d
     LEFT JOIN dog_people dp ON d.reg_number = dp.dog_reg
     LEFT JOIN people p ON dp.person_id = p.id
     WHERE UPPER(d.reg_number) = UPPER($1)
     GROUP BY d.reg_number`,
    [reg.trim()]
  );

  if (dogRes.rows.length === 0) return null;
  return dogRes.rows[0];
}

export async function buildAncestorTree(reg: string, maxGen = 4): Promise<PedigreeNode | null> {
  const dog = await getDogByReg(reg);
  if (!dog) return null;

  async function buildNode(currentReg: string | null | undefined, gen: number): Promise<PedigreeNode | null> {
    if (!currentReg || gen > maxGen) return null;
    const res = await pool.query(
      `SELECT reg_number, name, titles, sex, breed, sire_reg, dam_reg FROM dogs WHERE reg_number = $1`,
      [currentReg]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    const node: PedigreeNode = {
      reg_number: row.reg_number,
      name: row.name,
      titles: row.titles,
      sex: row.sex,
      breed: row.breed,
      generation: gen,
    };

    if (gen < maxGen) {
      const [sire, dam] = await Promise.all([
        buildNode(row.sire_reg, gen + 1),
        buildNode(row.dam_reg, gen + 1),
      ]);
      node.sire = sire;
      node.dam = dam;
    }

    return node;
  }

  return buildNode(dog.reg_number, 0);
}

export async function getProgeny(reg: string): Promise<Dog[]> {
  const res = await pool.query(
    `SELECT * FROM dogs WHERE sire_reg = $1 OR dam_reg = $1 ORDER BY name ASC`,
    [reg]
  );
  return res.rows;
}

export async function getSiblings(reg: string, sire_reg?: string | null, dam_reg?: string | null) {
  if (!sire_reg && !dam_reg) return { fullSiblings: [], halfSiblings: [] };

  const res = await pool.query(
    `SELECT * FROM dogs 
     WHERE reg_number != $1 
       AND ((sire_reg IS NOT NULL AND sire_reg = $2) OR (dam_reg IS NOT NULL AND dam_reg = $3))
     ORDER BY name ASC`,
    [reg, sire_reg || null, dam_reg || null]
  );

  const fullSiblings: Dog[] = [];
  const halfSiblings: Dog[] = [];

  for (const row of res.rows) {
    if (sire_reg && dam_reg && row.sire_reg === sire_reg && row.dam_reg === dam_reg) {
      fullSiblings.push(row);
    } else {
      halfSiblings.push(row);
    }
  }

  return { fullSiblings, halfSiblings };
}

export async function calculateCOI(sire_reg?: string | null, dam_reg?: string | null, maxGenerations = 8) {
  if (!sire_reg || !dam_reg) {
    return { coiPercent: 0, commonAncestors: [] };
  }

  // Trace sire ancestors
  const sireAncestors = await traceAncestors(sire_reg, maxGenerations);
  const damAncestors = await traceAncestors(dam_reg, maxGenerations);

  let totalCOI = 0.0;
  const commonMap: Record<string, { name: string; paths: number; contribution: number }> = {};

  for (const [ancReg, sDepths] of Object.entries(sireAncestors)) {
    if (damAncestors[ancReg]) {
      const dDepths = damAncestors[ancReg];
      for (const n1 of sDepths.depths) {
        for (const n2 of dDepths.depths) {
          const pathContribution = Math.pow(0.5, n1 + n2 + 1);
          totalCOI += pathContribution;
          if (!commonMap[ancReg]) {
            commonMap[ancReg] = { name: sDepths.name, paths: 0, contribution: 0 };
          }
          commonMap[ancReg].paths += 1;
          commonMap[ancReg].contribution += pathContribution;
        }
      }
    }
  }

  const commonAncestors = Object.entries(commonMap).map(([reg, val]) => ({
    reg_number: reg,
    name: val.name,
    paths: val.paths,
    contributionPercent: Number((val.contribution * 100).toFixed(2)),
  })).sort((a, b) => b.contributionPercent - a.contributionPercent);

  return {
    coiPercent: Number((totalCOI * 100).toFixed(2)),
    commonAncestors,
  };
}

async function traceAncestors(startReg: string, maxGen: number) {
  const ancestors: Record<string, { name: string; depths: number[] }> = {};

  async function walk(reg: string | null | undefined, depth: number) {
    if (!reg || depth > maxGen) return;
    const res = await pool.query(
      `SELECT reg_number, name, sire_reg, dam_reg FROM dogs WHERE reg_number = $1`,
      [reg]
    );
    if (res.rows.length === 0) return;
    const row = res.rows[0];

    if (!ancestors[row.reg_number]) {
      ancestors[row.reg_number] = { name: row.name, depths: [] };
    }
    ancestors[row.reg_number].depths.push(depth);

    await Promise.all([
      walk(row.sire_reg, depth + 1),
      walk(row.dam_reg, depth + 1),
    ]);
  }

  const startRes = await pool.query(
    `SELECT sire_reg, dam_reg FROM dogs WHERE reg_number = $1`,
    [startReg]
  );
  if (startRes.rows.length > 0) {
    await Promise.all([
      walk(startRes.rows[0].sire_reg, 1),
      walk(startRes.rows[0].dam_reg, 1),
    ]);
  }

  return ancestors;
}
