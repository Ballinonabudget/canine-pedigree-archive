import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <section className="pb-16 pt-[16vh] text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Canine Pedigree Archive</h1>
        <p className="mt-3 text-muted">Trace a dog’s lineage back through the AKC stud books, free.</p>
        <div className="mt-8 text-left">
          <SearchBox size="large" />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          <Link href="/amstaff" className="rounded-full border border-accent bg-accent-soft px-3 py-1 text-accent">
            American Staffordshire Terrier
          </Link>
          <span className="rounded-full border border-line px-3 py-1 text-faint">More breeds coming</span>
        </div>
      </section>
      <section className="grid gap-3 border-t border-line py-10 text-sm sm:grid-cols-3">
        <Link href="/amstaff#coverage" className="rounded-lg p-3 hover:bg-surface">
          <div className="font-medium">Records by year</div>
          <div className="mt-1 text-muted">See which years the archive covers and where it’s thin.</div>
        </Link>
        <Link href="/amstaff#foundation" className="rounded-lg p-3 hover:bg-surface">
          <div className="font-medium">Foundation dogs</div>
          <div className="mt-1 text-muted">The earliest AmStaffs in the records.</div>
        </Link>
        <Link href="/about" className="rounded-lg p-3 hover:bg-surface">
          <div className="font-medium">About the archive</div>
          <div className="mt-1 text-muted">Where the data comes from and what’s missing.</div>
        </Link>
      </section>
    </div>
  );
}
