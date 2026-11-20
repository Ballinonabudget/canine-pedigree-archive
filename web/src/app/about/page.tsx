import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About the archive',
  description: 'Where the pedigree records come from, how they were cleaned, and what is missing.',
};

export default function About() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 text-[15px] leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">About the archive</h1>
      <p className="mt-4">
        Every record here comes from scans of AKC Stud Books collected around 2008. Each stud book entry lists a dog, its sire and dam, its breeders and owners,
        and the issue it was published in. Linking those entries together builds the pedigrees.
      </p>
      <h2 className="mt-8 text-lg font-semibold">What the labels mean</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          <strong>Stud book entry</strong>: the dog has its own row in a stud book we have.
        </li>
        <li>
          <strong>Parent reference only</strong>: the dog appears only as the sire or dam of another dog. We know its name and registration number, little else.
        </li>
        <li>
          <strong>Unregistered / import</strong>: the records name the dog but give no AKC registration number.
        </li>
        <li>
          <strong>“around August 1981”</strong>: the stud book issue was worked out from neighbouring pages. <strong>“(approximate)”</strong> means it was
          estimated from the birth dates on the page.
        </li>
      </ul>
      <h2 className="mt-8 text-lg font-semibold">What’s missing</h2>
      <p className="mt-2">
        The scans don’t cover every year. For American Staffordshire Terriers the records are thin for 1953–1970, 1981–1982 and 1989–1993, so many pedigrees stop
        after two or three generations. The chart on the{' '}
        <Link href="/amstaff#coverage" className="text-accent hover:underline">
          breed page
        </Link>{' '}
        shows coverage by year, and the{' '}
        <Link href="/about/coverage" className="text-accent hover:underline">
          coverage page
        </Link>{' '}
        shows how deep the pedigrees go and how each entry was dated. Dogs registered as Staffordshire Terriers before the breed was renamed in 1972 are included as AmStaffs, with the original name
        noted.
      </p>
      <h2 id="corrections" className="mt-8 scroll-mt-20 text-lg font-semibold">Corrections</h2>
      <p className="mt-2">
        The records were read from old scans, so some names, dates and registration numbers are wrong. Each dog’s Details tab shows every row it was read
        from, as printed.{' '}
        {CONTACT_EMAIL ? (
          <>
            To report a mistake, use the “Report an error” link on the dog’s Details tab, or email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>{' '}
            with the dog’s registration number and what’s wrong.
          </>
        ) : (
          'A way to send corrections will be listed here.'
        )}
      </p>
      <p className="mt-4 text-muted">
        Owner and breeder names are shown as the stud books printed them. Many are initials only, so one name can refer to more than one person.
      </p>
    </article>
  );
}
