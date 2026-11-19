// Display helpers shared by server and client components. No database access here.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const ROMAN = /^(II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)$/;

/** "BUCK'S IRON SPIKE" -> "Buck's Iron Spike", "X-PERT BLUFFER" -> "X-Pert Bluffer", "O'BRIEN" -> "O'Brien". */
export function displayName(raw: string | null | undefined): string {
  if (!raw) return '';
  if (raw !== raw.toUpperCase()) return raw; // already mixed case: trust it
  return raw
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (ROMAN.test(word.toUpperCase())) return word.toUpperCase();
      return word
        .split('-')
        .map((part) =>
          part
            .split("'")
            .map((seg, i) => (i > 0 && seg.length <= 1 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
            .join("'"),
        )
        .join('-');
    })
    .join(' ');
}

export function bornLabel(d: { birth_year: number | null; birth_month: number | null; birth_day: number | null; date_precision: string | null }): string | null {
  if (!d.birth_year) return null;
  if (d.date_precision === 'full' && d.birth_month && d.birth_day) return `${MONTHS[d.birth_month - 1]} ${d.birth_day}, ${d.birth_year}`;
  if (d.birth_month) return `${MONTHS[d.birth_month - 1]} ${d.birth_year}`;
  return String(d.birth_year);
}

export function sexLabel(sex: string): string {
  return sex === 'D' ? 'Dog' : sex === 'B' ? 'Bitch' : 'Sex unknown';
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function personHref(p: { id: number; full_name: string }): string {
  return `/people/${p.id}-${slugify(p.full_name)}`;
}

export function dogHref(breedSlug: string | null | undefined, reg: string, query?: Record<string, string | number | undefined>): string {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `/${breedSlug || 'amstaff'}/dog/${encodeURIComponent(reg)}${qs ? `?${qs}` : ''}`;
}

/** Placeholder ids made in Phase 0 (UNREG_..., UNREG:...) are not real registration numbers. */
export function isRealReg(reg: string): boolean {
  return !reg.startsWith('UNREG');
}

export type RecordType = 'entry' | 'parent' | 'unregistered';

export function recordType(d: { reg_number: string; is_stub: boolean }): RecordType {
  if (!isRealReg(d.reg_number)) return 'unregistered';
  return d.is_stub ? 'parent' : 'entry';
}

export const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  entry: 'Stud book entry',
  parent: 'Parent reference only',
  unregistered: 'Unregistered / import',
};

/** "AKC Stud Book, August 1981" with honest wording for inferred and estimated issues. */
export function sourceLine(issue: string | null, source: string | null): string | null {
  if (!issue) return null;
  if (source === 'estimated') return `AKC Stud Book, ${issue} (approximate)`;
  if (source === 'interpolated') return `AKC Stud Book, around ${issue}`;
  return `AKC Stud Book, ${issue}`;
}

/** Alternate spellings worth showing: drops OCR fragments of the dog's own name ("FFER" for "X-PERT BLUFFER"). */
export function usefulAka(name: string, aka: string[]): string[] {
  const n = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return aka.filter((a) => {
    const k = a.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return k.length >= 5 && !n.includes(k) && k !== n;
  });
}

/** "R-75,131" -> "R75131". Returns null when the text doesn't look like a registration number. */
export function normalizeReg(q: string): string | null {
  const t = q.trim().toUpperCase();
  if (!/^[A-Z]{0,3}[\s.\-]?[0-9][0-9,.\s\-]{2,}(\/\d{1,2})?$/.test(t)) return null;
  return t.replace(/\/\d{1,2}$/, '').replace(/[^A-Z0-9]/g, '');
}
