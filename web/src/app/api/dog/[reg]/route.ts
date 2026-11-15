import { NextRequest, NextResponse } from 'next/server';
import { getDogByReg, buildAncestorTree, getProgeny, getSiblings, calculateCOI } from '@/lib/pedigree';

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

    return NextResponse.json({
      dog,
      tree,
      progeny,
      siblings,
      coi,
    });
  } catch (error: any) {
    console.error('Fetch dog error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
