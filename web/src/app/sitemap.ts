import type { MetadataRoute } from 'next';
import { cacheLife } from 'next/cache';
import { pool } from '@/lib/db';
import { dogHref, personHref } from '@/lib/format';
import { SITE_URL } from '@/lib/site';

// Every live-breed dog, every person with a live-breed dog, breed homes and decade pages.
// Refreshed hourly, so new records appear without a rebuild.
async function entries(): Promise<MetadataRoute.Sitemap> {
  'use cache';
  cacheLife('hours');
  const [breeds, decades, dogs, people] = await Promise.all([
    pool.query<{ slug: string }>('select slug from breeds where is_live order by slug'),
    pool.query<{ slug: string; decade: number }>(
      `select distinct d.breed_slug as slug, (d.birth_year / 10 * 10)::int as decade from dogs d join breeds b on b.slug = d.breed_slug and b.is_live
       where d.birth_year is not null order by 1, 2`,
    ),
    pool.query<{ reg_number: string; breed_slug: string; stub: boolean }>(
      `select d.reg_number, d.breed_slug, coalesce(d.is_stub, true) as stub from dogs d join breeds b on b.slug = d.breed_slug and b.is_live order by d.reg_number`,
    ),
    pool.query<{ id: number; full_name: string }>(
      `select distinct p.id, p.full_name from people p join dog_people dp on dp.person_id = p.id join dogs d on d.reg_number = dp.dog_reg
       join breeds b on b.slug = d.breed_slug and b.is_live order by p.id`,
    ),
  ]);
  const u = (path: string) => `${SITE_URL}${path}`;
  return [
    { url: u('/'), changeFrequency: 'weekly', priority: 1 },
    { url: u('/about'), changeFrequency: 'monthly', priority: 0.3 },
    { url: u('/about/coverage'), changeFrequency: 'monthly', priority: 0.3 },
    { url: u('/tools/test-mating'), changeFrequency: 'monthly', priority: 0.3 },
    ...breeds.rows.map((b) => ({ url: u(`/${b.slug}`), changeFrequency: 'weekly' as const, priority: 0.9 })),
    ...breeds.rows.map((b) => ({ url: u(`/${b.slug}/colors`), changeFrequency: 'monthly' as const, priority: 0.4 })),
    ...decades.rows.map((d) => ({ url: u(`/${d.slug}/browse/${d.decade}s`), changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...dogs.rows.map((d) => ({ url: u(dogHref(d.breed_slug, d.reg_number)), changeFrequency: 'monthly' as const, priority: d.stub ? 0.4 : 0.7 })),
    ...people.rows.map((p) => ({ url: u(personHref(p)), changeFrequency: 'monthly' as const, priority: 0.4 })),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return entries();
}
