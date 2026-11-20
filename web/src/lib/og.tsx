// Shared look for the link-preview images (Open Graph / X cards), 1200×630.
import type { ReactNode } from 'react';

export const OG_SIZE = { width: 1200, height: 630 };

export const C = {
  bg: '#fbfaf8',
  fg: '#1b1d1f',
  muted: '#62676d',
  faint: '#9aa0a6',
  line: '#e4e2dd',
  accent: '#1d5c7a',
  sire: '#eaf0f5',
  dam: '#f8eeeb',
  unknown: '#f1f0ec',
};

/** Trims a name to fit a box, on a word boundary where possible. */
export function fit(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

export function Frame({ kicker, children, footRight }: { kicker: string; children: ReactNode; footRight?: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, color: C.fg, padding: '56px 64px 44px' }}>
      <div style={{ display: 'flex', fontSize: 22, letterSpacing: 3, color: C.accent, textTransform: 'uppercase' }}>{kicker}</div>
      <div style={{ display: 'flex', flex: 1, marginTop: 20 }}>{children}</div>
      <div style={{ display: 'flex', alignItems: 'center', borderTop: `2px solid ${C.line}`, paddingTop: 22, fontSize: 24, color: C.muted }}>
        <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: C.accent, marginRight: 14 }} />
        <span style={{ color: C.fg }}>Canine Pedigree Archive</span>
        <span style={{ marginLeft: 'auto' }}>{footRight ?? 'From the AKC stud books'}</span>
      </div>
    </div>
  );
}
