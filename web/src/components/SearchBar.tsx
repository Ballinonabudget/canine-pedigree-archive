'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Dog as DogIcon, User, Sparkles } from 'lucide-react';

interface SearchResult {
  dogs: Array<{
    reg_number: string;
    name: string;
    titles?: string;
    sex: string;
    breed: string;
    birth_date?: string;
    is_stub: boolean;
  }>;
  people: Array<{
    id: number;
    full_name: string;
    dog_count: number;
  }>;
}

interface SearchBarProps {
  onSelectDog: (reg: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSelectDog }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ dogs: [], people: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ dogs: [], people: [] });
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="Search by Dog Name, AKC Reg Number (e.g. RA486186), or Breeder/Owner..."
          className="w-full pl-11 pr-10 py-3.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 shadow-xl transition-all"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Live Dropdown Results */}
      {isOpen && (results.dogs.length > 0 || results.people.length > 0) && (
        <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[460px] overflow-y-auto divide-y divide-slate-800">
          {/* Dogs Section */}
          {results.dogs.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Canine Records ({results.dogs.length})</span>
                <DogIcon className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              {results.dogs.map((dog) => (
                <div
                  key={dog.reg_number}
                  onClick={() => {
                    onSelectDog(dog.reg_number);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="px-3 py-2.5 rounded-xl hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div className="flex flex-col">
                    <div className="text-sm font-semibold text-slate-100 group-hover:text-emerald-400 flex items-center gap-1.5">
                      {dog.titles && <span className="text-amber-400 font-bold">{dog.titles}</span>}
                      <span>{dog.name}</span>
                      {dog.is_stub && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700">
                          Stub
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-emerald-400/90">{dog.reg_number}</span>
                      <span>•</span>
                      <span>{dog.breed}</span>
                      {dog.birth_date && (
                        <>
                          <span>•</span>
                          <span>Whelped: {dog.birth_date}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${dog.sex === 'D' ? 'text-sky-400 bg-sky-950/60 border-sky-800/50' : 'text-rose-400 bg-rose-950/60 border-rose-800/50'}`}>
                    {dog.sex === 'D' ? 'Male' : 'Female'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* People Section */}
          {results.people.length > 0 && (
            <div className="p-2 bg-slate-950/40">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Breeders & Owners ({results.people.length})</span>
                <User className="w-3.5 h-3.5 text-sky-400" />
              </div>
              {results.people.map((person) => (
                <div
                  key={person.id}
                  className="px-3 py-2 rounded-xl text-xs text-slate-300 flex items-center justify-between"
                >
                  <span className="font-medium text-slate-200">{person.full_name}</span>
                  <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                    {person.dog_count} linked {person.dog_count === 1 ? 'dog' : 'dogs'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
