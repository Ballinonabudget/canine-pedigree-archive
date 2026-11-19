import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Not in the archive</h1>
      <p className="mt-2 text-sm text-muted">This page doesn’t exist, or the dog isn’t in the records we have.</p>
      <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">
        Search the archive
      </Link>
    </div>
  );
}
