// Shared by the dog layout and each profile tab: load the dog or send the visitor somewhere sensible.
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getDog } from './data';
import { displayName, dogHref, isRealReg } from './format';

export function regFrom(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function loadDog(breed: string, rawReg: string, tab = '') {
  const reg = regFrom(rawReg);
  const dog = await getDog(reg);
  if (dog && !dog.breed_live) notFound();
  if (!dog) {
    // An old "R75131/2" style link, or a reg typed with punctuation
    const clean = reg.toUpperCase().replace(/\/\d+$/, '').replace(/[^A-Z0-9_:\-]/g, '');
    if (clean !== reg) redirect(dogHref(breed, clean) + tab);
    notFound();
  }
  if (dog.breed_slug && dog.breed_slug !== breed) redirect(dogHref(dog.breed_slug, dog.reg_number) + tab);
  return dog;
}

export async function dogMetadata(rawReg: string, tab: string): Promise<Metadata> {
  const dog = await getDog(regFrom(rawReg));
  if (!dog) return { title: 'Dog not found' };
  const name = `${dog.titles ? dog.titles + ' ' : ''}${displayName(dog.name)}`;
  const bits = [name + (isRealReg(dog.reg_number) ? ` (${dog.reg_number})` : ''), dog.breed_name, dog.birth_year, tab].filter(Boolean);
  return {
    title: { absolute: bits.join(' · ') },
    description: `${tab} of ${name}${dog.breed_name ? `, ${dog.breed_name}` : ''}${dog.birth_year ? `, born ${dog.birth_year}` : ''}. From the AKC stud book records.`,
  };
}
