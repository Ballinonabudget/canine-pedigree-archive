'use client';

import { useEffect, useId, useState } from 'react';
import type { DogHit } from '@/lib/data';
import { displayName, isRealReg } from '@/lib/format';

type Picked = { reg: string; label: string };

/** Search-as-you-type field that picks one dog, writing its reg number into a hidden form input. */
export function DogPicker({ name, label, sex, initial }: { name: string; label: string; sex: 'D' | 'B'; initial?: Picked }) {
  const id = useId();
  const [picked, setPicked] = useState<Picked | null>(initial ?? null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<DogHit[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!r.ok) return;
        const data: { exact: DogHit | null; dogs: DogHit[] } = await r.json();
        const all = data.exact ? [data.exact, ...data.dogs.filter((d) => d.reg_number !== data.exact!.reg_number)] : data.dogs;
        setHits(all.filter((d) => d.sex === sex || d.sex === 'U'));
        setActive(0);
      } catch {
        /* aborted */
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, sex]);

  const choose = (d: DogHit) => {
    setPicked({ reg: d.reg_number, label: `${displayName(d.name)}${d.birth_year ? ` (${d.birth_year})` : ''}` });
    setQ('');
    setHits([]);
  };
  const show = q.trim().length >= 2 && hits.length > 0;

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      <input type="hidden" name={name} value={picked?.reg ?? ''} />
      {picked ? (
        <div className="mt-1 flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm">
          <span className="font-medium">{picked.label}</span>
          {isRealReg(picked.reg) && <span className="font-mono text-xs text-faint">{picked.reg}</span>}
          <button type="button" onClick={() => setPicked(null)} className="ml-auto text-xs text-muted hover:text-fg">
            Change
          </button>
        </div>
      ) : (
        <input
          id={id}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && show) {
              e.preventDefault();
              choose(hits[active]);
            }
          }}
          placeholder={sex === 'D' ? 'Search for a sire' : 'Search for a dam'}
          autoComplete="off"
          role="combobox"
          aria-expanded={show}
          aria-controls={`${id}-list`}
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-faint"
        />
      )}
      {show && !picked && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface py-1 text-sm shadow-lg">
          {hits.map((d, i) => (
            <li
              key={d.reg_number}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(d)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 ${i === active ? 'bg-accent-soft' : ''}`}
            >
              <span className="truncate font-medium">{displayName(d.name)}</span>
              <span className="ml-auto shrink-0 text-xs text-muted">{d.birth_year}</span>
              {isRealReg(d.reg_number) && <span className="shrink-0 font-mono text-xs text-faint">{d.reg_number}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
