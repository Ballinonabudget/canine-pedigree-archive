'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { DogHit, PersonHit, SearchResult } from '@/lib/data';
import { displayName, dogHref, isRealReg, personHref } from '@/lib/format';

type Item = { kind: 'dog'; dog: DogHit } | { kind: 'person'; person: PersonHit };

const EMPTY: SearchResult = { exact: null, dogs: [], people: [] };

function years(p: PersonHit) {
  if (!p.first_year) return null;
  return p.first_year === p.last_year ? String(p.first_year) : `${p.first_year}–${p.last_year}`;
}

export function SearchBox({ size = 'compact', initial = '', slashToFocus = true }: { size?: 'large' | 'compact'; initial?: string; slashToFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<SearchResult>(EMPTY);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const dogs = res.exact ? [res.exact, ...res.dogs.filter((d) => d.reg_number !== res.exact!.reg_number)].slice(0, 8) : res.dogs;
  const items: Item[] = [...dogs.map((dog) => ({ kind: 'dog' as const, dog })), ...res.people.map((person) => ({ kind: 'person' as const, person }))];

  useEffect(() => {
    if (!slashToFocus) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [slashToFocus]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return; // the list is hidden below 2 characters
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (r.ok) {
          setRes(await r.json());
          setActive(-1);
        }
      } catch {
        /* aborted or offline: keep the last results */
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (item: Item) => {
    setOpen(false);
    router.push(item.kind === 'dog' ? dogHref(item.dog.breed_slug, item.dog.reg_number) : personHref(item.person));
  };

  const submit = () => {
    const term = q.trim();
    if (active >= 0 && items[active]) return go(items[active]);
    if (term.length >= 2) {
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(term)}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const large = size === 'large';
  const showList = open && q.trim().length >= 2 && items.length > 0;

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor={`${listId}-input`}>
          Search dogs, registration numbers, people and kennels
        </label>
        <div className={`flex items-center gap-2 rounded-lg border border-line bg-surface ${large ? 'px-4 py-3.5 shadow-sm' : 'px-3 py-1.5'}`}>
          <Search aria-hidden className={`shrink-0 text-faint ${large ? 'size-5' : 'size-4'}`} />
          <input
            ref={inputRef}
            id={`${listId}-input`}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={large ? 'Dog name, registration number, breeder or kennel' : 'Search the archive'}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            className={`w-full bg-transparent outline-none placeholder:text-faint ${large ? 'text-lg' : 'text-sm'}`}
          />
          {slashToFocus && !large && (
            <kbd className="hidden rounded border border-line px-1.5 font-mono text-[11px] text-faint sm:block" aria-hidden>
              /
            </kbd>
          )}
        </div>
      </form>

      {showList && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-[70vh] w-full overflow-auto rounded-lg border border-line bg-surface py-1 text-sm shadow-lg">
          {dogs.length > 0 && <li className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint">Dogs</li>}
          {items.map((item, i) => {
            const first = item.kind === 'person' && (i === 0 || items[i - 1].kind === 'dog');
            return (
              <li key={item.kind === 'dog' ? `d${item.dog.reg_number}` : `p${item.person.id}`} role="presentation">
                {first && <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-faint">People &amp; kennels</div>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(item)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 ${i === active ? 'bg-accent-soft' : ''}`}
                >
                  {item.kind === 'dog' ? <DogRow dog={item.dog} /> : <PersonRow person={item.person} />}
                </div>
              </li>
            );
          })}
          <li role="presentation" className="mt-1 border-t border-line px-3 pt-1.5 pb-1 text-xs text-muted">
            Press Enter for all results
          </li>
        </ul>
      )}
    </div>
  );
}

function DogRow({ dog }: { dog: DogHit }) {
  return (
    <>
      <span className="min-w-0 truncate">
        {dog.titles && <span className="mr-1 text-xs text-muted">{dog.titles}</span>}
        <span className="font-medium">{displayName(dog.name)}</span>
        {dog.matched_aka && <span className="ml-1.5 text-xs italic text-muted">matched: also recorded as {displayName(dog.matched_aka)}</span>}
      </span>
      <span className="ml-auto shrink-0 text-xs text-muted">
        {[dog.sex === 'D' ? 'Dog' : dog.sex === 'B' ? 'Bitch' : null, dog.birth_year, dog.breed_name].filter(Boolean).join(' · ')}
      </span>
      {isRealReg(dog.reg_number) && <span className="shrink-0 font-mono text-xs text-faint">{dog.reg_number}</span>}
    </>
  );
}

function PersonRow({ person }: { person: PersonHit }) {
  return (
    <>
      <span className="min-w-0 truncate font-medium">{displayName(person.full_name)}</span>
      <span className="ml-auto shrink-0 text-xs text-muted">
        {[person.kind === 'kennel' ? 'Kennel' : 'Person', `${person.dog_count} dog${person.dog_count === 1 ? '' : 's'}`, years(person)].filter(Boolean).join(' · ')}
      </span>
    </>
  );
}
