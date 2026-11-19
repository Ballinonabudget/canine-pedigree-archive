'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  ['', 'Pedigree'],
  ['/offspring', 'Offspring'],
  ['/siblings', 'Siblings & litter'],
  ['/descendants', 'Descendants'],
  ['/details', 'Details'],
] as const;

export function DogTabs({ base }: { base: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Dog profile" className="no-print -mx-4 mt-6 overflow-x-auto border-b border-line px-4">
      <ul className="flex gap-1 text-sm">
        {TABS.map(([suffix, label]) => {
          const href = base + suffix;
          const active = decodeURIComponent(path) === decodeURIComponent(href);
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-2 ${active ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg'}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
