'use client';

import React, { useState, useEffect } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { PedigreeTree } from '@/components/PedigreeTree';
import { TestMatingSimulator } from '@/components/TestMatingSimulator';
import { ChroniclesTab } from '@/components/ChroniclesTab';
import { Dna, GitBranch, Users, BookOpen, Award, ShieldCheck, Heart } from 'lucide-react';

export default function Home() {
  const [selectedReg, setSelectedReg] = useState<string>('RA486186'); // Default to BEARCAT
  const [dogData, setDogData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pedigree' | 'progeny' | 'siblings' | 'simulator' | 'chronicles'>('pedigree');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDog = async (reg: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dog/${encodeURIComponent(reg)}`);
      if (res.ok) {
        const data = await res.json();
        setDogData(data);
        setSelectedReg(reg);
      } else {
        // If query was by name from chronicles, search first
        const sRes = await fetch(`/api/search?q=${encodeURIComponent(reg)}`);
        const sData = await sRes.json();
        if (sData.dogs && sData.dogs.length > 0) {
          fetchDog(sData.dogs[0].reg_number);
          return;
        }
      }
    } catch (err) {
      console.error('Error fetching dog:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDog(selectedReg);
  }, []);

  const handleSelectDog = (regOrName: string) => {
    fetchDog(regOrName);
    if (activeTab === 'chronicles' || activeTab === 'simulator') {
      setActiveTab('pedigree');
    }
    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Dna className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                PEDIGREES<span className="text-emerald-400">.ARCHIVE</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-mono">
                PostgreSQL Relational Pedigree Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'simulator'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span>Test Mating</span>
            </button>
            <button
              onClick={() => setActiveTab('chronicles')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'chronicles'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Chronicles</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section & Search Bar */}
      <section className="relative pt-8 pb-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          Canine Pedigree & Historical Archive
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto mb-6">
          High-speed relational family trees, 8-generation Wright's COI calculations, and digitized historical breed chronicles.
        </p>

        <SearchBar onSelectDog={handleSelectDog} />
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 w-full">
        {isLoading && !dogData ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : dogData?.dog ? (
          <div className="space-y-6">
            {/* Active Dog Profile Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                      dogData.dog.sex === 'D'
                        ? 'text-sky-400 bg-sky-950/60 border-sky-800/60'
                        : 'text-rose-400 bg-rose-950/60 border-rose-800/60'
                    }`}>
                      {dogData.dog.sex === 'D' ? 'Male (Dog)' : 'Female (Bitch)'}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                      {dogData.dog.breed}
                    </span>
                    {dogData.dog.is_stub && (
                      <span className="text-xs text-amber-400 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded-full">
                        Auto-Stitched Stub
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
                    {dogData.dog.titles && (
                      <span className="text-amber-400">{dogData.dog.titles}</span>
                    )}
                    <span>{dogData.dog.name}</span>
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="font-mono text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/60">
                      AKC: {dogData.dog.reg_number}
                    </span>
                    {dogData.dog.birth_date && <span>Whelp Date: {dogData.dog.birth_date}</span>}
                    {dogData.dog.color_code && <span>Color: {dogData.dog.color_code}</span>}
                    {dogData.dog.source_file && (
                      <span className="text-slate-500 font-mono text-[11px]">
                        Scan: {dogData.dog.source_file}
                      </span>
                    )}
                  </div>

                  {/* Breeders & Owners */}
                  {(dogData.dog.breeders?.length > 0 || dogData.dog.owners?.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap gap-4 text-xs">
                      {dogData.dog.breeders?.length > 0 && (
                        <div>
                          <span className="text-slate-500 font-semibold uppercase text-[10px] block">Breeder(s)</span>
                          <span className="text-slate-300 font-medium">{dogData.dog.breeders.join(', ')}</span>
                        </div>
                      )}
                      {dogData.dog.owners?.length > 0 && (
                        <div>
                          <span className="text-slate-500 font-semibold uppercase text-[10px] block">Owner(s)</span>
                          <span className="text-slate-300 font-medium">{dogData.dog.owners.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Wright's COI Badge */}
                <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
                  <div className="text-left md:text-right">
                    <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1 md:justify-end">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Wright's COI (8-Gen)
                    </span>
                    <div className="text-3xl font-black text-emerald-400 mt-0.5">
                      {dogData.coi?.coiPercent ?? 0}%
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('simulator')}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-semibold mt-1"
                  >
                    Simulate Mating →
                  </button>
                </div>
              </div>

              {/* Sub-Tabs Navigation */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('pedigree')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'pedigree'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Pedigree Tree (4-5 Gen)</span>
                </button>

                <button
                  onClick={() => setActiveTab('progeny')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'progeny'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Progeny & Offspring ({dogData.progeny?.length ?? 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('siblings')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'siblings'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>
                    Siblings (
                    {(dogData.siblings?.fullSiblings?.length ?? 0) +
                      (dogData.siblings?.halfSiblings?.length ?? 0)}
                    )
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('simulator')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'simulator'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Test Mating Simulator</span>
                </button>

                <button
                  onClick={() => setActiveTab('chronicles')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === 'chronicles'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Amstaff Chronicles</span>
                </button>
              </div>
            </div>

            {/* Tab Views */}
            {activeTab === 'pedigree' && dogData.tree && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-emerald-400" />
                    Interactive Ancestor Tree (Click any ancestor to recenter)
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">4-Generation Relational CTE</span>
                </div>
                <PedigreeTree root={dogData.tree} onSelectDog={handleSelectDog} />
              </div>
            )}

            {activeTab === 'progeny' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Recorded Offspring Produced ({dogData.progeny?.length ?? 0})
                </h3>
                {dogData.progeny?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dogData.progeny.map((pup: any) => (
                      <div
                        key={pup.reg_number}
                        onClick={() => handleSelectDog(pup.reg_number)}
                        className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-emerald-500/60 cursor-pointer group transition-all"
                      >
                        <div className="text-sm font-bold text-slate-100 group-hover:text-emerald-400">
                          {pup.titles && <span className="text-amber-400 mr-1">{pup.titles}</span>}
                          {pup.name}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                          <span className="font-mono text-emerald-400">{pup.reg_number}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pup.sex === 'D' ? 'text-sky-400 bg-sky-950' : 'text-rose-400 bg-rose-950'
                          }`}>
                            {pup.sex === 'D' ? 'Male' : 'Female'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No offspring rows recorded yet for this dog in the current batch.</p>
                )}
              </div>
            )}

            {activeTab === 'siblings' && (
              <div className="space-y-6">
                {/* Full Siblings */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
                  <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-400" />
                    Full Siblings (Same Sire & Same Dam) ({dogData.siblings?.fullSiblings?.length ?? 0})
                  </h3>
                  {dogData.siblings?.fullSiblings?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dogData.siblings.fullSiblings.map((sib: any) => (
                        <div
                          key={sib.reg_number}
                          onClick={() => handleSelectDog(sib.reg_number)}
                          className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-emerald-500/60 cursor-pointer group transition-all"
                        >
                          <div className="text-sm font-bold text-slate-100 group-hover:text-emerald-400">
                            {sib.name}
                          </div>
                          <span className="font-mono text-xs text-emerald-400">{sib.reg_number}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No full siblings recorded in this batch.</p>
                  )}
                </div>

                {/* Half Siblings */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
                  <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-400" />
                    Half Siblings (Shared Sire or Dam) ({dogData.siblings?.halfSiblings?.length ?? 0})
                  </h3>
                  {dogData.siblings?.halfSiblings?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dogData.siblings.halfSiblings.map((sib: any) => (
                        <div
                          key={sib.reg_number}
                          onClick={() => handleSelectDog(sib.reg_number)}
                          className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-sky-500/60 cursor-pointer group transition-all"
                        >
                          <div className="text-sm font-bold text-slate-100 group-hover:text-sky-400">
                            {sib.name}
                          </div>
                          <span className="font-mono text-xs text-sky-400">{sib.reg_number}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No half siblings recorded in this batch.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'simulator' && (
              <TestMatingSimulator onSelectDog={handleSelectDog} />
            )}

            {activeTab === 'chronicles' && (
              <ChroniclesTab onSelectDog={handleSelectDog} />
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">
            No dog selected. Search above to begin.
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        Canine Pedigree Archive • Built with Next.js 15, PostgreSQL & Google Gemini • $0 Recurring Hosting
      </footer>
    </div>
  );
}
