'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, Award, ExternalLink } from 'lucide-react';

interface Article {
  id: number;
  title: string;
  breed: string;
  publication_era: string;
  summary_rewrite: string;
  mentioned_dogs: string[];
  source_image_url?: string;
}

interface ChroniclesProps {
  onSelectDog: (regOrName: string) => void;
}

export const ChroniclesTab: React.FC<ChroniclesProps> = ({ onSelectDog }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/articles')
      .then((res) => res.json())
      .then((data) => setArticles(data.articles || []))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            Amstaff & Breed Chronicles
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Historical articles, foundation letters, and champion periodical write-ups linked directly to pedigree records.
          </p>
        </div>
        <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-mono border border-slate-700">
          {articles.length} Archived Features
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {articles.map((art) => (
          <article
            key={art.id}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl hover:border-slate-700 transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-lg font-bold text-slate-100 leading-snug">
                {art.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
                  <Calendar className="w-3 h-3 text-emerald-400" />
                  {art.publication_era || 'Historical Archive'}
                </span>
                <span className="text-[11px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-2.5 py-1 rounded-full font-semibold">
                  {art.breed}
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line mb-4 font-normal">
              {art.summary_rewrite}
            </p>

            {art.mentioned_dogs && art.mentioned_dogs.length > 0 && (
              <div className="pt-4 border-t border-slate-800/80">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Featured / Mentioned Dogs:
                </span>
                <div className="flex flex-wrap gap-2">
                  {art.mentioned_dogs.map((dogName, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectDog(dogName)}
                      className="inline-flex items-center gap-1.5 text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 px-2.5 py-1 rounded-lg transition-colors group"
                    >
                      <Award className="w-3 h-3 text-amber-400" />
                      <span>{dogName}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
};
