import { Suspense } from 'react';
import { DogRows, Empty, TabSkeleton } from '@/components/DogList';
import { dogMetadata, loadDog } from '@/lib/dogRoute';
import { displayName } from '@/lib/format';
import { getSiblings, type Kid } from '@/lib/queries';

type Props = PageProps<'/[breed]/dog/[reg]/siblings'>;

export async function generateMetadata({ params }: Props) {
  return dogMetadata((await params).reg, 'Siblings and litter');
}

export default function SiblingsTab(props: Props) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <Siblings {...props} />
    </Suspense>
  );
}

function Group({ title, note, dogs }: { title: string; note?: string; dogs: Kid[] }) {
  if (!dogs.length) return null;
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-sm font-medium">
        {title} <span className="font-normal text-muted">({dogs.length})</span>
      </h3>
      {note && <p className="text-xs text-muted">{note}</p>}
      <div className="mt-1">
        <DogRows dogs={dogs} />
      </div>
    </section>
  );
}

async function Siblings({ params }: Props) {
  const { breed, reg } = await params;
  const dog = await loadDog(breed, reg, '/siblings');
  if (!dog.sire_reg && !dog.dam_reg) return <Empty>Neither parent of {displayName(dog.name)} is recorded, so we can’t list siblings.</Empty>;
  const s = await getSiblings(dog.reg_number);
  const n = s.littermates.length + s.full.length + s.bySire.length + s.byDam.length;
  if (!n) return <Empty>No siblings of {displayName(dog.name)} appear in the records we have.</Empty>;
  return (
    <div aria-label="Siblings">
      <Group title="Littermates" note="Same sire, same dam, same birth date." dogs={s.littermates} />
      <Group title="Full siblings from other litters" dogs={s.full} />
      <Group title={`Half siblings through the sire${dog.sire ? `, ${displayName(dog.sire.name)}` : ''}`} dogs={s.bySire} />
      <Group title={`Half siblings through the dam${dog.dam ? `, ${displayName(dog.dam.name)}` : ''}`} dogs={s.byDam} />
    </div>
  );
}
