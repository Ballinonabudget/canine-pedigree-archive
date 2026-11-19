import Link from 'next/link';
import type { Kid } from '@/lib/queries';
import { bornLabel, displayName, dogHref, isRealReg } from '@/lib/format';

export function DogRows({ dogs, showBorn = true }: { dogs: Kid[]; showBorn?: boolean }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {dogs.map((d) => (
        <li key={d.reg_number}>
          <Link href={dogHref(d.breed_slug, d.reg_number)} className="flex flex-wrap items-baseline gap-x-3 py-2 hover:bg-surface">
            <span className="font-medium">
              {d.titles && <span className="mr-1 text-xs font-normal text-muted">{d.titles}</span>}
              {displayName(d.name)}
            </span>
            <span className="ml-auto text-xs text-muted">
              {[d.sex === 'D' ? 'Dog' : d.sex === 'B' ? 'Bitch' : null, showBorn ? bornLabel(d) : null].filter(Boolean).join(' · ')}
            </span>
            {isRealReg(d.reg_number) && <span className="font-mono text-xs text-faint">{d.reg_number}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">{children}</p>;
}

export function TabSkeleton() {
  return <div className="h-40 animate-pulse rounded-lg bg-surface" />;
}
