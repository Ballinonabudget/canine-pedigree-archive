/** Public address of the site, for sitemaps and absolute links. Set SITE_URL on the server, e.g. https://example.org */
export const SITE_URL = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
