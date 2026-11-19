'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, Copy, Printer, Share2 } from 'lucide-react';

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="no-print rounded p-1 text-faint hover:text-fg"
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        } catch {
          /* share sheet dismissed */
        }
      }}
      className="no-print inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:text-fg"
    >
      <Share2 className="size-3.5" aria-hidden />
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}

/** Remembers the last pedigree depth and applies it when the URL doesn't name one. */
export function GensMemory({ gens }: { gens: number }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    try {
      if (params.get('gens')) localStorage.setItem('gens', String(gens));
      else {
        const saved = Number(localStorage.getItem('gens'));
        if (saved >= 2 && saved <= 9 && saved !== gens) {
          const next = new URLSearchParams(params);
          next.set('gens', String(saved));
          router.replace(`${path}?${next}`, { scroll: false });
        }
      }
    } catch {
      /* storage blocked */
    }
  }, [gens, params, path, router]);
  return null;
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
    >
      <Printer className="size-3.5" aria-hidden />
      Print
    </button>
  );
}

/** Today's date, filled in on the client (the page itself is cached, so it can't know when it's printed). */
export function TodayDate() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }, []);
  return <span ref={ref} />;
}
