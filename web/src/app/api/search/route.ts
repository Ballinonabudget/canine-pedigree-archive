import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/data';

// Instant dropdown: up to 8 dogs and 5 people.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ exact: null, dogs: [], people: [] });
  try {
    return NextResponse.json(await search(q.slice(0, 80), { dogLimit: 8, peopleLimit: 5 }));
  } catch (error) {
    console.error('search failed', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
