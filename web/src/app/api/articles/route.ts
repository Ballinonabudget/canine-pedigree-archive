import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const res = await pool.query(
      `SELECT id, title, breed, publication_era, summary_rewrite, mentioned_dogs, source_image_url
       FROM historical_articles
       ORDER BY id ASC`
    );
    return NextResponse.json({ articles: res.rows });
  } catch (error: any) {
    console.error('Fetch articles error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
