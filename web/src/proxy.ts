// Runs before a page starts streaming, so it can still send real 404s and HTTP redirects.
// (Inside a streamed page, notFound() and redirect() can only answer 200 + noindex / a client redirect.)
import { NextResponse, type NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { dogHref, normalizeReg, personHref } from '@/lib/format';

const RESERVED = new Set(['search', 'about', 'tools', 'people', 'api', 'account', 'sitemap.xml', 'robots.txt', 'favicon.ico']);
const NOT_FOUND_PATH = '/__missing/__missing';
const TABS = new Set(['offspring', 'siblings', 'descendants', 'details']);

let liveCache: { at: number; slugs: Set<string> } | null = null;
async function liveBreeds() {
  if (!liveCache || Date.now() - liveCache.at > 10 * 60_000) {
    const r = await pool.query<{ slug: string }>('select slug from breeds where is_live');
    liveCache = { at: Date.now(), slugs: new Set(r.rows.map((x) => x.slug)) };
  }
  return liveCache.slugs;
}

function notFound(req: NextRequest) {
  // No route matches this two-segment path, so Next renders app/not-found.tsx with a 404 status.
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, req.url));
}

function moved(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url), 308);
}

/** "r-75,131/2" -> "R75131"; keeps the "-X1" suffix Phase 0 gives OCR collisions. Placeholder ids are left alone. */
function cleanReg(reg: string) {
  if (reg.startsWith('UNREG')) return reg;
  const up = reg.toUpperCase().replace(/\/\d{1,2}$/, '');
  const x = /-X\d+$/.exec(up)?.[0] ?? '';
  return up.slice(0, up.length - x.length).replace(/[^A-Z0-9]/g, '') + x;
}

async function findDog(reg: string) {
  const r = await pool.query<{ reg_number: string; breed_slug: string | null; live: boolean }>(
    `select d.reg_number, d.breed_slug, coalesce(b.is_live, false) as live from dogs d left join breeds b on b.slug = d.breed_slug where d.reg_number = $1`,
    [reg],
  );
  return r.rows[0] ?? null;
}

export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === NOT_FOUND_PATH) return NextResponse.next();
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  try {
    if (parts[0] === 'search') {
      const sp = req.nextUrl.searchParams;
      const q = sp.get('q') ?? '';
      const onlyQuery = [...sp.keys()].every((k) => k === 'q' || (k === 'breed' && sp.get('breed') === 'amstaff'));
      const reg = onlyQuery ? normalizeReg(q) : null;
      if (reg) {
        const r = await pool.query<{ reg_number: string; breed_slug: string }>(
          `select d.reg_number, d.breed_slug from dogs d join breeds b on b.slug = d.breed_slug and b.is_live
           where d.reg_number = $1 or d.reg_number like $1 || '-X%' order by d.is_stub, d.reg_number limit 1`,
          [reg],
        );
        if (r.rows[0]) return NextResponse.redirect(new URL(dogHref(r.rows[0].breed_slug, r.rows[0].reg_number), req.url), 307);
      }
      return NextResponse.next();
    }

    if (parts[0] === 'people' && parts.length === 2) {
      const id = Number(parts[1].split('-')[0]);
      if (!Number.isInteger(id) || id <= 0) return notFound(req);
      const r = await pool.query<{ id: number; full_name: string }>('select id, full_name from people where id = $1', [id]);
      if (!r.rows[0]) return notFound(req);
      const canonical = personHref(r.rows[0]);
      return decodeURIComponent(req.nextUrl.pathname) === canonical ? NextResponse.next() : moved(req, canonical);
    }

    if (parts.length === 0 || RESERVED.has(parts[0])) return NextResponse.next();

    const live = await liveBreeds();
    const [breed, kind, key, tab, ...rest] = parts;
    if (!live.has(breed)) return notFound(req);
    if (parts.length === 1) return NextResponse.next();

    if (kind === 'colors') return parts.length === 2 ? NextResponse.next() : notFound(req);
    if (kind === 'browse') return parts.length === 3 && /^(1[89]\d0|20[0-2]0)s$/.test(key ?? '') ? NextResponse.next() : notFound(req);

    if (kind === 'dog' && key && rest.length === 0 && (!tab || TABS.has(tab))) {
      let reg = key;
      try {
        reg = decodeURIComponent(key);
      } catch {
        return notFound(req);
      }
      const suffix = tab ? `/${tab}` : '';
      let dog = await findDog(reg);
      if (!dog) {
        // Old "R75131/2"-style links, or a reg typed with punctuation
        const clean = cleanReg(reg);
        const retry = clean !== reg ? await findDog(clean) : null;
        if (!retry) return notFound(req);
        dog = retry;
      }
      if (!dog.live) return notFound(req);
      if (dog.reg_number !== reg || dog.breed_slug !== breed) {
        const url = new URL(dogHref(dog.breed_slug, dog.reg_number) + suffix, req.url);
        url.search = req.nextUrl.search;
        return NextResponse.redirect(url, 308);
      }
      return NextResponse.next();
    }
    return notFound(req);
  } catch (error) {
    // Never take the site down over a lookup: let the page handle it.
    console.error('proxy lookup failed', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico|sitemap.xml|robots.txt).*)'],
};
