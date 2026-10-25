import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import type { Metadata } from '@/lib/meta';
import { Img } from '@/components/img';
import Link from '@/components/link';
import { ArrowRight } from 'lucide-react';
import { getPublishedCars, getPublicSettings } from '@/lib/data/public';
import { Container, Headline, PageHero } from '@/components/site/primitives';

export const metadata: Metadata = {
  title: 'About us',
  description: 'Solid Drive Auto WA is a licensed used-car dealer in Perth, Western Australia.',
  alternates: { canonical: '/about' },
};

const PRINCIPLES = [
  {
    title: 'The real car, online',
    text: 'Every listing shows the actual car, its kilometres and stock number. What you see is what’s parked on the yard.',
  },
  {
    title: 'Drive before you decide',
    text: 'Book a test drive or inspection in a live time slot. No phone tag, no waiting for a call back.',
  },
  {
    title: 'Clear numbers',
    text: 'Prices are on every car, the finance estimate is one tap away, and the holding deposit is a fixed amount with no surcharge.',
  },
];

export async function loader() {
  return Promise.all([getPublicSettings(), getPublishedCars().catch(() => [])]);
}

export default function AboutPage() {
  const [s, cars] = useLoaderData() as LoaderData<typeof loader>;
  const b = s.business;
  return (
    <>
      <PageHero
        crumbs={[{ href: '/about', label: 'About' }]}
        title="A local yard"
        muted="with nothing to hide."
        intro={`${b.name} is a licensed motor vehicle dealer in ${b.address.suburb}, Perth. We sell quality used cars, utes and SUVs to people who want a straight deal.`}
      />

      <section className="bg-background py-16 sm:py-24">
        <Container>
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl md:aspect-auto md:min-h-[26rem]">
              <Img src="/images/showroom/yard.webp" alt="The car yard at blue hour" fill sizes="(min-width: 768px) 58vw, 100vw" className="object-cover" />
            </div>
            <div className="grid gap-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl md:aspect-auto">
                <Img src="/images/about/detail-showroom.webp" alt="Headlight and wheel detail in the showroom" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
              </div>
              <div className="bg-brand-red flex flex-col justify-between rounded-xl p-6 text-white">
                <p className="font-display sda-num text-6xl leading-none font-black" style={{ fontStretch: '115%' }}>
                  {cars.length}
                </p>
                <p className="mt-6 font-semibold">Cars on the yard right now</p>
              </div>
            </div>
          </div>

          <div className="mt-20 grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <Headline lead="How we do it." muted="Three simple rules." />
            <dl className="divide-y border-y">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="grid gap-2 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
                  <dt className="font-display text-lg font-extrabold" style={{ fontStretch: '106%' }}>
                    {p.title}
                  </dt>
                  <dd className="text-muted-foreground">{p.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      <section className="dark bg-brand-black text-foreground py-16 sm:py-24">
        <Container className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <Headline lead="Come and see us." muted={`${b.address.suburb}, ${b.address.state}.`} mutedClassName="text-white/45" />
          <div className="flex flex-wrap gap-3">
            <Link href="/cars" className="sda-press bg-brand-red inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white">
              Browse cars <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/contact" className="sda-press inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-white ring-1 ring-white/25">
              Directions & hours
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
