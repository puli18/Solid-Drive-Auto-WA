import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import { Img } from '@/components/img';
import { getPublicSettings } from '@/lib/data/public';
import { TradeInForm } from '@/components/site/forms/trade-in-form';
import { telHref } from '@/components/site/lib/format';
import { Container, PageHero } from '@/components/site/primitives';

export const metadata: Metadata = {
  title: 'Trade-in valuation',
  description: 'Get a trade-in valuation for your car in Perth. Send the details and up to six photos and put the value towards your next car.',
  alternates: { canonical: '/trade-in' },
};

const STEPS = [
  { title: 'Tell us about it', text: 'Make, model, kilometres and a few photos. Two minutes on your phone.' },
  { title: 'We come back with a figure', text: 'Our buyer reviews it and contacts you with a trade-in value.' },
  { title: 'Put it towards your next car', text: 'Use it as your deposit, or bring it in and we’ll finalise on the day.' },
];

export async function loader() {
  return getPublicSettings();
}

export default function TradeInPage() {
  const settings = useLoaderData() as LoaderData<typeof loader>;
  const b = settings.business;
  return (
    <>
      <PageHero
        crumbs={[{ href: '/trade-in', label: 'Trade-in' }]}
        title="Your old car,"
        muted="your next deposit."
        intro="Get a trade-in valuation without driving across town. Send the details and photos and we’ll get back to you."
      />
      <section className="bg-background py-12 sm:py-16">
        <Container className="grid gap-14 lg:grid-cols-[1fr_22rem] lg:gap-16">
          <TradeInForm />
          <aside className="space-y-8">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              <Img src="/images/promo/trade-in.webp" alt="" fill sizes="(min-width: 1024px) 22rem, 100vw" className="object-cover object-[80%_center]" />
            </div>
            <ol className="space-y-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="bg-brand-black sda-num grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white">{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{s.title}</span>
                    <span className="text-muted-foreground block text-sm">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground text-sm">
              Rather talk it through? Call{' '}
              <a href={telHref(b.phone)} className="text-foreground sda-num font-medium">
                {b.phone}
              </a>
              .
            </p>
          </aside>
        </Container>
      </section>
    </>
  );
}
