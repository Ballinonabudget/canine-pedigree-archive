import { Suspense } from 'react';
import { DogHeader } from '@/components/DogHeader';
import { DogTabs } from '@/components/DogTabs';
import { dogHref } from '@/lib/format';
import { loadDog } from '@/lib/dogRoute';

type Props = LayoutProps<'/[breed]/dog/[reg]'>;

export default function DogLayout({ params, children }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<div className="h-56 animate-pulse rounded-lg bg-surface" />}>
        <Header params={params} />
      </Suspense>
      <div className="mt-6">{children}</div>
    </div>
  );
}

async function Header({ params }: { params: Props['params'] }) {
  const { breed, reg } = await params;
  const dog = await loadDog(breed, reg);
  return (
    <>
      <DogHeader dog={dog} />
      <Suspense fallback={<div className="mt-6 h-9 border-b border-line" />}>
        <DogTabs base={dogHref(dog.breed_slug, dog.reg_number)} />
      </Suspense>
    </>
  );
}
