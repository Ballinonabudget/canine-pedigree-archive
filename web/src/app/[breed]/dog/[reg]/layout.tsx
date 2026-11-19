import Link from 'next/link';
import { Suspense } from 'react';
import { getArticlesForDog } from '@/lib/breed';
import { DogHeader } from '@/components/DogHeader';
import { DogTabs } from '@/components/DogTabs';
import { dogHref } from '@/lib/format';
import { loadDog } from '@/lib/dogRoute';

type Props = LayoutProps<'/[breed]/dog/[reg]'>;

export default function DogLayout({ params, children }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="print:hidden">
        <Suspense fallback={<div className="h-56 animate-pulse rounded-lg bg-surface" />}>
          <Header params={params} />
        </Suspense>
      </div>
      <div className="mt-6 print:mt-0">{children}</div>
    </div>
  );
}

async function Header({ params }: { params: Props['params'] }) {
  const { breed, reg } = await params;
  const dog = await loadDog(breed, reg);
  const articles = dog.breed_slug ? await getArticlesForDog(dog.breed_slug, dog.reg_number) : [];
  return (
    <>
      <DogHeader dog={dog} />
      {articles.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="text-muted">Mentioned in breed history: </span>
          {articles.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <Link href={`/${dog.breed_slug}#history-${a.id}`} className="text-accent hover:underline">
                {a.title}
              </Link>
            </span>
          ))}
        </p>
      )}
      <Suspense fallback={<div className="mt-6 h-9 border-b border-line" />}>
        <DogTabs base={dogHref(dog.breed_slug, dog.reg_number)} />
      </Suspense>
    </>
  );
}
