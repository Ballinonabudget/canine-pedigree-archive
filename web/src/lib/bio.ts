import { Dog } from './pedigree';

export interface DogBio {
  summary: string;
  lineageStory: string;
  breedingImpact: string;
  historicalEra: string;
  bloodlineTags: string[];
}

export function generateDogBio(
  dog: Dog,
  sire?: Dog | null,
  dam?: Dog | null,
  progeny: Dog[] = [],
  articleMentions: string[] = []
): DogBio {
  const isMale = dog.sex === 'D';
  const pronoun = isMale ? 'he' : 'she';
  const Pronoun = isMale ? 'He' : 'She';
  const possessive = isMale ? 'his' : 'her';
  const titlePrefix = dog.titles ? `${dog.titles} ` : '';
  const fullName = `${titlePrefix}${dog.name}`;

  // 1. Bloodline Tags
  const bloodlineTags: string[] = [];
  const nameUpper = dog.name.toUpperCase();
  if (nameUpper.includes('RUFFIAN')) bloodlineTags.push('Ruffian');
  if (nameUpper.includes('HAR-WY') || nameUpper.includes('HARWYN')) bloodlineTags.push('Har-Wyn');
  if (nameUpper.includes('TRYARR')) bloodlineTags.push('Tryarr');
  if (nameUpper.includes('WHITE ROCK')) bloodlineTags.push('White Rock');
  if (nameUpper.includes('X-PERT')) bloodlineTags.push('X-Pert');
  if (nameUpper.includes('WILLYNWOOD')) bloodlineTags.push('Willynwood');
  if (nameUpper.includes('PATTON') || nameUpper.includes('RED ROCK')) bloodlineTags.push('Red Rock');
  if (bloodlineTags.length === 0) bloodlineTags.push('AKC Foundation Line');

  // 2. Historical Era
  let historicalEra = 'Unknown Era';
  if (dog.birth_date) {
    historicalEra = `Whelped ${dog.birth_date}`;
  } else if (progeny.length > 0) {
    const dates = progeny.map((p) => p.birth_date).filter(Boolean);
    if (dates.length > 0) {
      historicalEra = `Active Breeding Era circa ${dates[0]}`;
    } else {
      historicalEra = 'Historic AKC Pedigree Era';
    }
  }

  // 3. Lineage Story
  let lineageStory = '';
  if (sire && dam) {
    lineageStory = `${fullName} is produced from the mating of sire ${sire.titles ? sire.titles + ' ' : ''}${sire.name} (${sire.reg_number}) and dam ${dam.titles ? dam.titles + ' ' : ''}${dam.name} (${dam.dam_reg || dam.reg_number}). This cross unites key foundation lineages within the ${dog.breed} stud book.`;
  } else if (sire) {
    lineageStory = `${fullName} is sired by ${sire.titles ? sire.titles + ' ' : ''}${sire.name} (${sire.reg_number}). Direct maternal whelp record is currently documented through generational linkage in the archival stud books.`;
  } else if (dam) {
    lineageStory = `${fullName} is out of dam ${dam.titles ? dam.titles + ' ' : ''}${dam.name} (${dam.reg_number}). Direct paternal sire lineage is traced through progeny entries in the archive.`;
  } else if (dog.is_stub) {
    lineageStory = `${fullName} is a pillar foundation dog in this archival batch. Sired and established multi-generation lineages appearing across registered litters in the American Kennel Club stud book.`;
  } else {
    lineageStory = `${fullName} represents an early purebred ${dog.breed} registration recorded in the official AKC stud book archives.`;
  }

  // 4. Breeding Impact
  let breedingImpact = '';
  if (progeny.length > 0) {
    const sampleNames = progeny.slice(0, 3).map((p) => `${p.name} (${p.reg_number})`).join(', ');
    breedingImpact = `As a proven producer, ${fullName} is officially recorded with ${progeny.length} registered offspring in this archive batch, including ${sampleNames}.`;
  } else if (!dog.is_stub) {
    breedingImpact = `${Pronoun} was registered as an individual pup in volume records. Breeding and progeny records are added as subsequent stud book sheets are indexed.`;
  } else {
    breedingImpact = `Documented as a foundation parent. ${Pronoun} passed ${possessive} genetic heritage forward into modern show and working pedigrees.`;
  }

  // 5. Summary Profile
  let summary = '';
  if (dog.is_stub) {
    summary = `${fullName} is an influential ${dog.breed} foundation ancestor (${dog.reg_number}). While originally entered into the platform as an auto-stitched parent reference for registered offspring, ${pronoun} stands as a key genealogical bridge connecting vintage lines.`;
  } else {
    summary = `${fullName} is a registered ${dog.breed} (${dog.reg_number})${dog.birth_date ? `, whelped on ${dog.birth_date}` : ''}${dog.color_code ? ` with a recorded coat color of ${dog.color_code}` : ''}. ${Pronoun} was documented in official AKC stud book volume records (${dog.source_file || 'AKC Stud Book'}).`;
  }

  if (dog.breeders && dog.breeders.length > 0) {
    summary += ` Bred by ${dog.breeders.join(', ')}.`;
  }
  if (dog.owners && dog.owners.length > 0) {
    summary += ` Owned by ${dog.owners.join(', ')}.`;
  }

  if (articleMentions.length > 0) {
    summary += ` Featured in historical breed chronicles and periodicals: ${articleMentions.join(', ')}.`;
  }

  return {
    summary,
    lineageStory,
    breedingImpact,
    historicalEra,
    bloodlineTags,
  };
}
