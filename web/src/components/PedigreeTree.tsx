'use client';

import React from 'react';
import { PedigreeNode } from '@/lib/pedigree';

interface PedigreeTreeProps {
  root: PedigreeNode;
  onSelectDog: (reg: string) => void;
}

export const PedigreeTree: React.FC<PedigreeTreeProps> = ({ root, onSelectDog }) => {
  return (
    <div className="w-full overflow-x-auto pb-6 pt-2">
      <div className="min-w-[1050px] flex items-center justify-start space-x-6">
        {/* Gen 0: Target Dog */}
        <div className="w-64 flex-shrink-0">
          <DogCard node={root} isTarget onSelectDog={onSelectDog} />
        </div>

        {/* Gen 1: Parents (Sire & Dam) */}
        <div className="w-64 flex-shrink-0 flex flex-col justify-around h-[520px]">
          <DogCard node={root.sire} label="Sire (Father)" onSelectDog={onSelectDog} />
          <DogCard node={root.dam} label="Dam (Mother)" onSelectDog={onSelectDog} />
        </div>

        {/* Gen 2: Grandparents */}
        <div className="w-64 flex-shrink-0 flex flex-col justify-around h-[520px]">
          <DogCard node={root.sire?.sire} label="Paternal Grandsire" onSelectDog={onSelectDog} />
          <DogCard node={root.sire?.dam} label="Paternal Granddam" onSelectDog={onSelectDog} />
          <DogCard node={root.dam?.sire} label="Maternal Grandsire" onSelectDog={onSelectDog} />
          <DogCard node={root.dam?.dam} label="Maternal Granddam" onSelectDog={onSelectDog} />
        </div>

        {/* Gen 3: Great-Grandparents */}
        <div className="w-64 flex-shrink-0 flex flex-col justify-around h-[520px]">
          <DogCard node={root.sire?.sire?.sire} label="GG-Sire" compact onSelectDog={onSelectDog} />
          <DogCard node={root.sire?.sire?.dam} label="GG-Dam" compact onSelectDog={onSelectDog} />
          <DogCard node={root.sire?.dam?.sire} label="GG-Sire" compact onSelectDog={onSelectDog} />
          <DogCard node={root.sire?.dam?.dam} label="GG-Dam" compact onSelectDog={onSelectDog} />
          <DogCard node={root.dam?.sire?.sire} label="GG-Sire" compact onSelectDog={onSelectDog} />
          <DogCard node={root.dam?.sire?.dam} label="GG-Dam" compact onSelectDog={onSelectDog} />
          <DogCard node={root.dam?.dam?.sire} label="GG-Sire" compact onSelectDog={onSelectDog} />
          <DogCard node={root.dam?.dam?.dam} label="GG-Dam" compact onSelectDog={onSelectDog} />
        </div>
      </div>
    </div>
  );
};

interface DogCardProps {
  node?: PedigreeNode | null;
  label?: string;
  isTarget?: boolean;
  compact?: boolean;
  onSelectDog: (reg: string) => void;
}

const DogCard: React.FC<DogCardProps> = ({ node, label, isTarget, compact, onSelectDog }) => {
  if (!node) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-3 text-center text-xs text-slate-500 ${compact ? 'py-1.5' : 'py-3'}`}>
        {label && <span className="block text-[10px] uppercase font-semibold text-slate-600 mb-0.5">{label}</span>}
        Unknown / Not Ingested
      </div>
    );
  }

  const isMale = node.sex === 'D';
  const sexColor = isMale ? 'text-sky-400 bg-sky-950/60 border-sky-800/60' : 'text-rose-400 bg-rose-950/60 border-rose-800/60';

  return (
    <div
      onClick={() => onSelectDog(node.reg_number)}
      className={`group relative cursor-pointer rounded-xl border transition-all duration-200 
        ${isTarget 
          ? 'border-emerald-500/80 bg-slate-900/95 shadow-lg shadow-emerald-950/30 ring-2 ring-emerald-500/30' 
          : 'border-slate-800 bg-slate-900/80 hover:border-emerald-500/60 hover:bg-slate-850 hover:shadow-md'
        } ${compact ? 'p-2' : 'p-3'}`}
    >
      <div className="flex items-center justify-between mb-1">
        {label && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {label}
          </span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${sexColor}`}>
          {isMale ? 'Male (D)' : 'Female (B)'}
        </span>
      </div>

      <div className="font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors line-clamp-1 text-sm">
        {node.titles && <span className="text-amber-400 font-bold mr-1">{node.titles}</span>}
        {node.name}
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-mono text-emerald-400/90">{node.reg_number}</span>
        <span className="text-[10px] text-slate-500 group-hover:text-slate-300">Recenter →</span>
      </div>
    </div>
  );
};
