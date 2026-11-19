import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // Search result pages are endless combinations of filters; the sitemap lists every real page.
    rules: { userAgent: '*', allow: '/', disallow: ['/search', '/api/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
