import Link from 'next/link';
import { Suspense } from 'react';
import { HeaderSearch, ThemeToggle } from './HeaderBits';

export function SiteHeader() {
  return (
    <header className="no-print border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <Link href="/" className="shrink-0 font-semibold tracking-tight">
          Canine Pedigree Archive
        </Link>
        <div className="flex-1">
          <Suspense fallback={null}>
            <HeaderSearch />
          </Suspense>
        </div>
        <Link href="/amstaff" className="hidden text-sm text-muted hover:text-fg sm:block">
          AmStaff
        </Link>
        <Link href="/about" className="hidden text-sm text-muted hover:text-fg sm:block">
          About
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
