'use client';

import React, { useState } from 'react';
import { Dna, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface SimulatorProps {
  onSelectDog: (reg: string) => void;
}

export const TestMatingSimulator: React.FC<SimulatorProps> = ({ onSelectDog }) => {
  const [sireReg, setSireReg] = useState('R926876'); // CH TRYARR SPACE CAPTAIN
  const [damReg, setDamReg] = useState('RA246503');  // MOUNT SHIRE KUUIPO OF HAIKU CD
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sireReg.trim() || !damReg.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coi?sire=${encodeURIComponent(sireReg.trim())}&dam=${encodeURIComponent(damReg.trim())}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
          <Dna className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">Virtual Test Mating & Wright's COI Simulator</h3>
          <p className="text-xs text-slate-400">
            Calculate exact 8-generation Wright's Inbreeding Coefficient (COI %) and trace shared ancestors before breeding.
          </p>
        </div>
      </div>

      <form onSubmit={handleSimulate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Proposed Sire Registration
          </label>
          <input
            type="text"
            value={sireReg}
            onChange={(e) => setSireReg(e.target.value)}
            placeholder="e.g. R926876"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Proposed Dam Registration
          </label>
          <input
            type="text"
            value={damReg}
            onChange={(e) => setDamReg(e.target.value)}
            placeholder="e.g. RA246503"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Calculate Predicted COI</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-rose-950/50 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Predicted Offspring COI</span>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                {result.coiPercent}%
              </div>
              <span className="text-[11px] text-slate-500">
                {result.coiPercent < 6.25 ? 'Low Inbreeding (Safe Outcross)' : result.coiPercent < 12.5 ? 'Moderate Linebreeding' : 'Close Inbreeding'}
              </span>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Sire Evaluation</span>
              <div className="text-sm font-semibold text-slate-200 mt-1 line-clamp-1">
                {result.sire ? result.sire.name : 'Unknown Sire'}
              </div>
              <span className="text-xs font-mono text-emerald-400">{sireReg}</span>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Dam Evaluation</span>
              <div className="text-sm font-semibold text-slate-200 mt-1 line-clamp-1">
                {result.dam ? result.dam.name : 'Unknown Dam'}
              </div>
              <span className="text-xs font-mono text-rose-400">{damReg}</span>
            </div>
          </div>

          {/* Shared Ancestors List */}
          {result.commonAncestors && result.commonAncestors.length > 0 ? (
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Shared Common Ancestors ({result.commonAncestors.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.commonAncestors.map((anc: any) => (
                  <div
                    key={anc.reg_number}
                    onClick={() => onSelectDog(anc.reg_number)}
                    className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl hover:border-emerald-500/50 cursor-pointer flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400">
                        {anc.name}
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">{anc.reg_number}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-400">+{anc.contributionPercent}%</div>
                      <span className="text-[10px] text-slate-500">{anc.paths} pedigree paths</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
              No common ancestors found in current recorded generations (Complete Outcross).
            </div>
          )}
        </div>
      )}
    </div>
  );
};
