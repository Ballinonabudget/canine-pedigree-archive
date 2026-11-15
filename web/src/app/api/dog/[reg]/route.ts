import { NextRequest, NextResponse } from 'next/server';
import { getDogByReg, buildAncestorTree, getProgeny, getSiblings, calculateCOI } from '@/lib/pedigree';
import { generateDogBio } from '@/lib/bio';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ reg: string }> }) {
  const { reg } = await params;
  if (!reg) return NextResponse.json({ error: 'Missing registration number' }, { status: 400 });

  try {
    const dog = await getDogByReg(reg);
    if (!dog) {
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
    }

    const [tree, progeny, siblings, coi] = await Promise.all([
      buildAncestorTree(dog.reg_number, 4),
      getProgeny(dog.reg_number),
      getSiblings(dog.reg_number, dog.sire_reg, dog.dam_reg),
      calculateCOI(dog.sire_reg, dog.dam_reg, 8),
    ]);

    // If stub has no direct breeder/owner, infer associated breeders/owners from progeny
    if ((!dog.breeders || dog.breeders.length === 0) && (!dog.owners || dog.owners.length === 0)) {
      const progPeopleRes = await pool.query(
        `SELECT DISTINCT p.full_name, dp.role
         FROM dogs child
         JOIN dog_people dp ON child.reg_number = dp.dog_reg
         JOIN people p ON dp.person_id = p.id
         WHERE child.sire_reg = $1 OR child.dam_reg = $1
         LIMIT 6`,
        [dog.reg_number]
      );
      const inferredBreeders: string[] = [];
      const inferredOwners: string[] = [];
      for (const row of progPeopleRes.rows) {
        if (row.role === 'B') inferredBreeders.push(row.full_name);
        if (row.role === 'O') inferredOwners.push(row.full_name);
      }
      if (inferredBreeders.length > 0) dog.breeders = inferredBreeders;
      if (inferredOwners.length > 0) dog.owners = inferredOwners;
    }

    // Check if mentioned in any historical articles
    const articleRes = await pool.query(
      `SELECT title FROM historical_articles
       WHERE $1 = ANY(mentioned_dogs) OR $2 ILIKE ANY(mentioned_dogs)`,
      [dog.reg_number, `%${dog.name}%`]
    );
    const articleMentions = articleRes.rows.map((r) => r.title);

    const [sire, dam] = await Promise.all([
      dog.sire_reg ? getDogByReg(dog.sire_reg) : Promise.resolve(null),
      dog.dam_reg ? getDogByReg(dog.dam_reg) : Promise.resolve(null),
    ]);

    const bio = generateDogBio(dog, sire, dam, progeny, articleMentions);

    return NextResponse.json({
      dog,
      bio,
      tree,
      progeny,
      siblings,
      coi,
      articleMentions,
    });
  } catch (error: any) {
    console.error('Fetch dog error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
