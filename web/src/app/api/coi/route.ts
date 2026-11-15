import { NextRequest, NextResponse } from 'next/server';
import { calculateCOI, getDogByReg } from '@/lib/pedigree';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sire = searchParams.get('sire')?.trim();
  const dam = searchParams.get('dam')?.trim();

  if (!sire || !dam) {
    return NextResponse.json({ error: 'Please provide both sire and dam registration numbers' }, { status: 400 });
  }

  try {
    const [sireDog, damDog, coiResult] = await Promise.all([
      getDogByReg(sire),
      getDogByReg(dam),
      calculateCOI(sire, dam, 8),
    ]);

    return NextResponse.json({
      sire: sireDog,
      dam: damDog,
      ...coiResult,
    });
  } catch (error: any) {
    console.error('COI simulation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
