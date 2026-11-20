/** Public address of the site, for sitemaps and absolute links. Set SITE_URL on the server, e.g. https://example.org */
export const SITE_URL = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Where corrections go. Set CONTACT_EMAIL on the server; without it, links point at the About page. */
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || null;

/** A "report an error" link: a pre-addressed email when CONTACT_EMAIL is set. */
export function correctionHref(subject: string): string {
  return CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}` : '/about#corrections';
}
