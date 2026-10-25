import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import { type Metadata, useJsonLd } from '@/lib/meta';
import Link from '@/components/link';
import { formatAUD } from '@sda/shared';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getPublicSettings } from '@/lib/data/public';
import { addressOneLine, telHref } from '@/components/site/lib/format';
import { Container, PageHero } from '@/components/site/primitives';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about test drives, deposits, trade-ins, finance and visiting Solid Drive Auto WA in Perth.',
  alternates: { canonical: '/faq' },
};

export async function loader() {
  return getPublicSettings();
}

export default function FaqPage() {
  const s = useLoaderData() as LoaderData<typeof loader>;
  const b = s.business;
  const deposit = formatAUD(s.deposit.amountCents);
  const faqs: { q: string; a: string; link?: { href: string; label: string } }[] = [
    {
      q: 'How do I book a test drive?',
      a: `Open any available car and choose “Book a test drive or inspection”. Pick a day and one of the live time slots, add your details and you’re booked. Each booking is ${s.booking.slotMinutes} minutes and you’ll get an email with a link to change or cancel it.`,
      link: { href: '/cars', label: 'Browse cars' },
    },
    {
      q: 'What do I need to bring to a test drive?',
      a: 'Your current driver licence. If you’re trading in, bring your car too so we can look it over while you drive.',
    },
    {
      q: 'Can I hold a car before I visit?',
      a: `Yes. Most cars can be reserved online with a fixed ${deposit} deposit, paid securely by card, Apple Pay or Google Pay. The car is taken off the market as soon as the payment is confirmed.`,
      link: { href: '/deposit-terms', label: 'Read the deposit terms' },
    },
    {
      q: 'Is the deposit refundable?',
      a: `No. The ${deposit} deposit is non-refundable, including if you decide not to go ahead. It comes off the price when you complete the purchase.`,
    },
    {
      q: 'Do you take trade-ins?',
      a: 'Yes. Send us the details and up to six photos for a valuation, and you can put the trade-in value towards your next car.',
      link: { href: '/trade-in', label: 'Value my trade-in' },
    },
    {
      q: 'Can I get finance?',
      a: `Our calculator gives an indicative repayment using a ${s.finance.indicativeRatePct}% p.a. rate. It’s an estimate only – talk to us about finance options and lender approval.`,
      link: { href: '/finance', label: 'Try the calculator' },
    },
    {
      q: 'Where are you and when are you open?',
      a: `${addressOneLine(b)}. ${b.hours}.`,
      link: { href: '/contact', label: 'Get directions' },
    },
    {
      q: 'What if a car I like is marked Reserved?',
      a: 'Another buyer has paid a deposit on it. You can still send an enquiry and we’ll let you know if it becomes available again.',
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  useJsonLd(jsonLd);

  return (
    <>
      <PageHero crumbs={[{ href: '/faq', label: 'FAQ' }]} title="Good questions." muted="Straight answers." />
      <section className="bg-background py-12 sm:py-16">
        <Container className="grid gap-12 lg:grid-cols-[1fr_20rem]">
          <Accordion type="single" collapsible className="max-w-3xl border-t">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`}>
                <AccordionTrigger className="py-5 text-base font-semibold sm:text-lg">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground max-w-[65ch] text-base leading-relaxed">
                  <p>{f.a}</p>
                  {f.link ? (
                    <Link href={f.link.href} className="text-foreground mt-3 inline-block font-semibold underline underline-offset-4">
                      {f.link.label}
                    </Link>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <aside>
            <div className="dark bg-brand-black text-foreground rounded-2xl p-6">
              <p className="font-display text-xl font-extrabold text-white">Still wondering?</p>
              <p className="text-muted-foreground mt-2 text-sm">Call the team or send a message and we’ll get back to you.</p>
              <a href={telHref(b.phone)} className="sda-num mt-5 block text-xl font-semibold text-white">
                {b.phone}
              </a>
              <Link href="/contact" className="sda-press bg-brand-red mt-5 inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white">
                Contact us
              </Link>
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}
