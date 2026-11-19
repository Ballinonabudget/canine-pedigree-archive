import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Canine Pedigree Archive',
    template: '%s · Canine Pedigree Archive',
  },
  description: 'A free archive for tracing a dog’s lineage back through the AKC stud books, from the 1920s onward.',
};

// Applies the saved light/dark choice before first paint so the page doesn't flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="no-print border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-1 px-4 py-6 text-xs text-muted">
            <span>Records from AKC Stud Books. Coverage is uneven.</span>
            <Link href="/about" className="hover:text-fg">
              About the archive
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
