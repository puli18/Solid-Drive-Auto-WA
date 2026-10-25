import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import Link from '@/components/link';
import { ArrowRight } from 'lucide-react';
import { getPublicSettings } from '@/lib/data/public';
import { FinanceCalculator } from '@/components/site/finance-calculator';
import { telHref } from '@/components/site/lib/format';
import { Container, Headline, PageHero } from '@/components/site/primitives';

export const metadata: Metadata = {
  title: 'Car finance calculator',
  description: 'Estimate weekly and monthly repayments on a used car from Solid Drive Auto WA. Indicative only.',
  alternates: { canonical: '/finance' },
};

const POINTS = [
  { title: 'Price', text: 'Start with the car’s price. Every car page has this calculator pre-filled.' },
  { title: 'Deposit or trade-in', text: 'Anything you put down – cash or your trade-in value – reduces the amount financed.' },
  { title: 'Term', text: 'Longer terms lower the repayment but add interest. Pick between 1 and 7 years.' },
  { title: 'Rate', text: 'We start with an indicative rate. Your actual rate depends on the lender and your situation.' },
];

export async function loader() {
  return getPublicSettings();
}

export default function FinancePage() {
  const s = useLoaderData() as LoaderData<typeof loader>;
  return (
    <>
      <PageHero
        crumbs={[{ href: '/finance', label: 'Finance' }]}
        title="Know the weekly"
        muted="before you commit."
        intro="An honest estimate of repayments, in about ten seconds. No credit check and no personal details needed."
      />
      <section className="bg-background py-12 sm:py-16">
        <Container className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div>
            <FinanceCalculator ratePct={s.finance.indicativeRatePct} disclaimer={s.finance.disclaimer} />
          </div>
          <div>
            <Headline lead="How the estimate works" size="md" />
            <dl className="mt-6 divide-y border-y">
              {POINTS.map((p) => (
                <div key={p.title} className="py-4">
                  <dt className="font-semibold">{p.title}</dt>
                  <dd className="text-muted-foreground mt-1 text-sm">{p.text}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground mt-6 text-sm">
              Want to talk through options? Call{' '}
              <a href={telHref(s.business.phone)} className="text-foreground sda-num font-medium">
                {s.business.phone}
              </a>{' '}
              or ask when you book a test drive.
            </p>
            <Link
              href="/cars"
              className="sda-press bg-brand-black mt-8 inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
            >
              Find a car that fits <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
