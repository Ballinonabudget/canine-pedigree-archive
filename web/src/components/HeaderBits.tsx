'use client';

import { usePathname } from 'next/navigation';
import { Moon } from 'lucide-react';
import { SearchBox } from './SearchBox';

/** The home page has its own large search box, so the header one is hidden there. */
export function HeaderSearch() {
  if (usePathname() === '/') return null;
  return (
    <div className="ml-auto max-w-md">
      <SearchBox />
    </div>
  );
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      aria-label="Switch light or dark mode"
      className="rounded p-1.5 text-muted hover:text-fg"
      onClick={() => {
        const root = document.documentElement;
        const dark = root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
        const next = dark ? 'light' : 'dark';
        root.dataset.theme = next;
        try {
          localStorage.setItem('theme', next);
        } catch {
          /* storage blocked: the choice lasts for this page only */
        }
      }}
    >
      <Moon className="size-4" aria-hidden />
    </button>
  );
}
