'use client';

import React from 'react';
import { Dog } from '@/lib/pedigree';
import { DogBio } from '@/lib/bio';
import { 
  FileText, 
  Calendar, 
  Dna, 
  Award, 
  User, 
  ShieldCheck, 
  BookOpen, 
  Sparkles,
  Info
} from 'lucide-react';

interface DogBioCardProps {
  dog: Dog;
  bio?: DogBio;
  progenyCount: number;
  articleMentions?: string[];
  onSelectDog: (reg: string) => void;
}

export const DogBioCard: React.FC<DogBioCardProps> = ({
  dog,
  bio,
  progenyCount,
  articleMentions = [],
  onSelectDog,
}) => {
  const isMale = dog.sex === 'D';
  const sexLabel = isMale ? 'Male (Dog / D)' : 'Female (Bitch / B)';
  const sexBadge = isMale 
    ? 'text-sky-400 bg-sky-950/70 border-sky-800' 
    : 'text-rose-400 bg-rose-950/70 border-rose-800';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* 1. Header with Name & Bloodline Tags */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs px-3 py-1 rounded-full font-bold border ${sexBadge}`}>
              {sexLabel}
            </span>
            <span className="text-xs bg-slate-800 text-slate-300 font-semibold px-3 py-1 rounded-full border border-slate-700">
              {dog.breed}
            </span>
            {dog.is_stub ? (
              <span className="text-xs bg-amber-950/60 text-amber-300 border border-amber-800/70 px-3 py-1 rounded-full flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>Foundation Lineage Stub (Via Progeny)</span>
              </span>
            ) : (
              <span className="text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800/70 px-3 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified AKC Whelp Entry</span>
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
            {dog.titles && <span className="text-amber-400">{dog.titles}</span>}
            <span>{dog.name}</span>
          </h2>

          {bio?.bloodlineTags && bio.bloodlineTags.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Strains:
              </span>
              {bio.bloodlineTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[11px] bg-slate-800/80 text-emerald-400 border border-slate-700 px-2.5 py-0.5 rounded-lg font-mono font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats Block */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center min-w-[95px]">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Offspring</span>
            <span className="text-xl font-extrabold text-emerald-400">{progenyCount}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center min-w-[110px]">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Chronicles</span>
            <span className="text-xl font-extrabold text-amber-400">{articleMentions.length}</span>
          </div>
        </div>
      </div>

      {/* 2. Official Registration & Canine Vital Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">AKC Reg Number</span>
          <span className="font-mono text-sm font-bold text-emerald-400 mt-0.5 block truncate">
            {dog.reg_number}
          </span>
        </div>

        <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Date of Birth (DOB)</span>
          <span className="text-sm font-semibold text-slate-200 mt-0.5 block">
            {dog.birth_date || bio?.historicalEra || 'Archival Record'}
          </span>
        </div>

        <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Sex (D/B)</span>
          <span className="text-sm font-semibold text-slate-200 mt-0.5 block">
            {dog.sex === 'D' ? 'Dog (Male)' : dog.sex === 'B' ? 'Bitch (Female)' : 'Undetermined'}
          </span>
        </div>

        <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Color & Markings</span>
          <span className="text-sm font-semibold text-slate-200 mt-0.5 block truncate" title={dog.color_code || 'Standard'}>
            {dog.color_code || 'Breed Standard'}
          </span>
        </div>

        <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Sire Reference</span>
          <span className="text-sm font-mono font-semibold text-sky-400 mt-0.5 block truncate">
            {dog.sire_reg ? (
              <button 
                onClick={() => onSelectDog(dog.sire_reg!)}
                className="hover:underline text-left"
              >
                {dog.sire_reg}
              </button>
            ) : 'Pending Ingest'}
          </span>
        </div>

        <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Dam Reference</span>
          <span className="text-sm font-mono font-semibold text-rose-400 mt-0.5 block truncate">
            {dog.dam_reg ? (
              <button 
                onClick={() => onSelectDog(dog.dam_reg!)}
                className="hover:underline text-left"
              >
                {dog.dam_reg}
              </button>
            ) : 'Pending Ingest'}
          </span>
        </div>
      </div>

      {/* 3. Breeders, Kennels & Owners Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Breeders Card */}
        <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <User className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Breeder / Kennel Information
            </span>
          </div>
          {dog.breeders && dog.breeders.length > 0 ? (
            <div className="space-y-1">
              {dog.breeders.map((breeder, i) => (
                <div key={i} className="text-sm font-semibold text-slate-200">
                  {breeder}
                </div>
              ))}
              <p className="text-[11px] text-slate-400 mt-1">
                Official breeder of record in American Kennel Club archives.
              </p>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              Breeder record linked via progeny entries in subsequent stud book sheets.
            </div>
          )}
        </div>

        {/* Owners Card */}
        <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-sky-400">
            <Award className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Owner / Handler Information
            </span>
          </div>
          {dog.owners && dog.owners.length > 0 ? (
            <div className="space-y-1">
              {dog.owners.map((owner, i) => (
                <div key={i} className="text-sm font-semibold text-slate-200">
                  {owner}
                </div>
              ))}
              <p className="text-[11px] text-slate-400 mt-1">
                Owner of record at the time of official registry publication.
              </p>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              Ownership transferred or recorded across subsequent stud book volumes.
            </div>
          )}
        </div>
      </div>

      {/* 4. Full Historical Biography / Narrative Profile */}
      <div className="p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 text-amber-400">
          <FileText className="w-4 h-4" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Historical Canine Biography & Profile
          </h3>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed font-normal">
          {bio?.summary || `${dog.name} (${dog.reg_number}) is an official ${dog.breed} pedigree entry.`}
        </p>

        {bio?.lineageStory && (
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Lineage & Bloodline Integration:
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {bio.lineageStory}
            </p>
          </div>
        )}

        {bio?.breedingImpact && (
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Breeding Influence & Production:
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {bio.breedingImpact}
            </p>
          </div>
        )}

        {articleMentions && articleMentions.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block mb-1 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Published In Historical Periodical Features:
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {articleMentions.map((artTitle, i) => (
                <span
                  key={i}
                  className="text-xs bg-amber-950/60 text-amber-300 border border-amber-800/60 px-3 py-1 rounded-xl"
                >
                  "{artTitle}"
                </span>
              ))}
            </div>
          </div>
        )}

        {dog.source_file && (
          <div className="pt-2 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Primary Archival Source Document:</span>
            <span className="text-slate-400">{dog.source_file}</span>
          </div>
        )}
      </div>
    </div>
  );
};
