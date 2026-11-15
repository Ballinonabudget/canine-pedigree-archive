import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';

  if (!q || q.length < 2) {
    return NextResponse.json({ dogs: [], people: [] });
  }

  try {
    const searchPattern = `%${q}%`;
    const regPattern = `${q.replace(/[^a-zA-Z0-9]/g, '')}%`;

    // 1. Search Dogs by name or registration number
    const dogsRes = await pool.query(
      `SELECT d.reg_number, d.name, d.titles, d.sex, d.breed, d.birth_date, d.is_stub,
              similarity(d.name, $1) as sim
       FROM dogs d
       WHERE d.name ILIKE $2 
          OR d.reg_number ILIKE $3 
          OR d.name % $1
       ORDER BY sim DESC, d.is_stub ASC, d.name ASC
       LIMIT 15`,
      [q, searchPattern, regPattern]
    );

    // 2. Search People (Breeders & Owners)
    const peopleRes = await pool.query(
      `SELECT p.id, p.full_name, COUNT(dp.dog_reg) as dog_count
       FROM people p
       LEFT JOIN dog_people dp ON p.id = dp.person_id
       WHERE p.full_name ILIKE $1 OR p.full_name % $2
       GROUP BY p.id, p.full_name
       ORDER BY dog_count DESC, p.full_name ASC
       LIMIT 8`,
      [searchPattern, q]
    );

    return NextResponse.json({
      dogs: dogsRes.rows,
      people: peopleRes.rows,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
