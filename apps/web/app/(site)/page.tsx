import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import { Img } from '@/components/img';
import Link from '@/components/link';
import { ArrowRight, Clock, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { formatAUD } from '@sda/shared';
import { getPublishedCars, getPublicSettings } from '@/lib/data/public';
import { carCoverUrl } from '@/lib/images';
import { CategoryRail } from '@/components/site/home/category-rail';
import { CountUp } from '@/components/site/home/count-up';
import { HeroSearch } from '@/components/site/home/hero-search';
import { LatestCars } from '@/components/site/home/latest-cars';
import { FinanceCalculator } from '@/components/site/finance-calculator';
import { EnquiryForm } from '@/components/site/forms/enquiry-form';
import { carName, hoursRows, mapsUrl, telHref, transmissionLabel } from '@/components/site/lib/format';
import { CATEGORIES, filterOptions } from '@/components/site/lib/inventory';
import { Container, Headline, Kicker, LogoMark } from '@/components/site/primitives';

const PRICE_STEPS = [15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 60_000, 80_000, 100_000];

export async function loader() {
  return Promise.all([getPublishedCars().catch(() => []), getPublicSettings()]);
}

export default function HomePage() {
  const [cars, settings] = useLoaderData() as LoaderData<typeof loader>;
  const b = settings.business;
  const available = cars.filter((c) => c.status === 'available');
  const opts = filterOptions(cars);
  const priceSteps = PRICE_STEPS.filter((p, i) => p <= opts.maxPrice || PRICE_STEPS[i - 1]! < opts.maxPrice);
  const featured = [...available].sort((a, b2) => b2.priceCents - a.priceCents)[0];
  const sortedPrices = available.map((c) => c.priceCents).sort((a, z) => a - z);
  const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)] ?? 3_000_000;
  const categories = CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    image: c.image,
    href: `/cars?${c.query}`,
    count: cars.filter(c.match).length,
  }));

  // Art-directed hero: static files (no image optimiser on a static host).
  const desktopSrcSet = '/images/hero/hero.webp';
  const mobileSrcSet = '/images/hero/hero-mobile.webp';
  const mobileImg = { src: mobileSrcSet, alt: '', width: 1792, height: 2240, sizes: '100vw', decoding: 'async' as const };

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="dark bg-brand-black text-foreground relative isolate overflow-hidden">
        <picture>
          <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
          <source srcSet={mobileSrcSet} />
          <img
            {...mobileImg}
            srcSet={mobileSrcSet}
            fetchPriority="high"
            className="sda-settle absolute inset-0 -z-10 size-full object-cover object-[60%_center] md:object-right"
          />
        </picture>
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,10,11,0.55)_0%,rgba(10,10,11,0)_30%,rgba(10,10,11,0.15)_55%,rgba(10,10,11,0.95)_100%)] md:bg-[linear-gradient(90deg,rgba(10,10,11,0.85)_0%,rgba(10,10,11,0.35)_45%,rgba(10,10,11,0)_70%),linear-gradient(180deg,rgba(10,10,11,0.5)_0%,rgba(10,10,11,0)_25%,rgba(10,10,11,0)_60%,rgba(10,10,11,0.9)_100%)]"
        />
        <Container className="flex min-h-[min(100svh,58rem)] flex-col pt-[calc(var(--sda-header-h)+3rem)] pb-6 sm:pb-10">
          <div className="max-w-2xl">
            <p className="sda-rise flex items-center gap-3 text-sm font-medium text-white/80" style={{ '--d': '60ms' } as React.CSSProperties}>
              <span aria-hidden className="sda-blade" />
              Used cars, utes &amp; SUVs · {b.address.suburb}, Perth
            </p>
            <h1
              className="font-display mt-5 text-[clamp(3rem,9.5vw,6rem)] leading-[0.92] font-black tracking-[-0.035em] text-white"
              style={{ fontStretch: '115%' }}
            >
              <span className="sda-line" style={{ '--i': 0 } as React.CSSProperties}>
                <span>Drive it</span>
              </span>
              <span className="sda-line" style={{ '--i': 1 } as React.CSSProperties}>
                <span>before you</span>
              </span>
              <span className="sda-line" style={{ '--i': 2 } as React.CSSProperties}>
                <span className="text-brand-chrome">decide.</span>
              </span>
            </h1>
            <p className="sda-rise mt-6 max-w-md text-base text-pretty text-white/75 sm:text-lg" style={{ '--d': '420ms' } as React.CSSProperties}>
              Quality used cars in Perth with real photos, honest kilometres and online test-drive booking in live time slots.
            </p>
          </div>

          <div className="sda-rise mt-auto pt-12" style={{ '--d': '560ms' } as React.CSSProperties}>
            <HeroSearch
              makes={opts.makes}
              modelsByMake={opts.modelsByMake}
              years={opts.years}
              priceSteps={priceSteps}
              count={cars.length}
            />
          </div>
        </Container>
      </section>

      {/* ---------------- Trust strip ---------------- */}
      <section aria-label="Dealership details" className="border-b">
        <Container>
          <ul className="grid grid-cols-1 divide-y text-sm sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <TrustItem icon={<ShieldCheck />} label="Licensed WA dealer" value={<span className="font-mono">{b.dealerLicenceNo}</span>} />
            <TrustItem
              icon={<MapPin />}
              label="Visit the yard"
              value={
                <a href={mapsUrl(b)} target="_blank" rel="noopener" className="underline-offset-4 hover:underline">
                  {b.address.line1}, {b.address.suburb}
                </a>
              }
            />
            <TrustItem icon={<Clock />} label="Opening hours" value={hoursRows(b.hours)[0] ?? b.hours} />
            <TrustItem
              icon={<Phone />}
              label="Call the team"
              value={
                <a href={telHref(b.phone)} className="sda-num underline-offset-4 hover:underline">
                  {b.phone}
                </a>
              }
            />
          </ul>
        </Container>
      </section>

      {/* ---------------- Statement + bento ---------------- */}
      <section className="bg-background py-20 sm:py-28">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Headline lead="We sell more than cars." muted="We sell the drive home." />
            <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-base text-pretty sm:text-lg">
              Utes for the work week, SUVs for the school run, hatches for a first set of keys. {b.name} buys carefully, prices
              clearly and lets you drive before you decide.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3 md:grid-rows-[minmax(15rem,1fr)_minmax(15rem,1fr)]">
            <div className="relative min-h-60 overflow-hidden rounded-xl md:min-h-0">
              <Img
                src="/images/about/ute-red-dirt.webp"
                alt="A dual-cab ute on a red-dirt Pilbara road at golden hour"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>

            <div className="dark bg-brand-black text-foreground relative flex flex-col overflow-hidden rounded-xl p-6 sm:p-8 md:row-span-2">
              <LogoMark className="h-12 self-start" />
              <div className="my-auto py-10">
                <p className="text-muted-foreground text-sm font-medium">Est.</p>
                <p className="font-display mt-1 text-4xl leading-none font-black text-white sm:text-5xl" style={{ fontStretch: '118%' }}>
                  {b.address.suburb}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span aria-hidden className="sda-blade w-10" />
                  <span className="text-brand-chrome text-xs font-semibold tracking-[0.4em] uppercase">{b.address.state}</span>
                  <span aria-hidden className="sda-blade sda-blade-rev w-10" />
                </div>
              </div>
              <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
                Every car is listed with its real photos, kilometres and stock number, and you can book a time to drive it online.
              </p>
              <p className="mt-4 font-mono text-xs text-white/50">{b.dealerLicenceNo}</p>
            </div>

            <div className="relative min-h-[26rem] overflow-hidden rounded-xl md:row-span-2 md:min-h-0">
              <Img
                src="/images/about/suv-beach.webp"
                alt="A family SUV with the tailgate open at a Western Australian beach"
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <p
                className="font-display absolute inset-x-6 bottom-6 text-2xl leading-tight font-extrabold text-white sm:text-3xl"
                style={{ fontStretch: '110%' }}
              >
                Weekends start
                <br />
                at the tailgate.
              </p>
            </div>

            <div className="bg-brand-red flex min-h-60 flex-col justify-between rounded-xl p-6 text-white sm:p-8 md:min-h-0">
              <p className="font-display text-[clamp(3.5rem,7vw,5rem)] leading-none font-black" style={{ fontStretch: '115%' }}>
                <CountUp value={cars.length} className="sda-num" />
              </p>
              <div>
                <p className="text-base font-semibold">Cars on the yard right now</p>
                <a href={`mailto:${b.email}`} className="mt-3 inline-block text-sm text-white/85 underline-offset-4 hover:underline">
                  {b.email}
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- Categories ---------------- */}
      <section className="bg-brand-stone py-20 sm:py-28">
        <Container>
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <Kicker>Browse by body type</Kicker>
              <Headline className="mt-4" lead="Find your fit" muted="for every WA road." />
            </div>
            <p className="text-muted-foreground max-w-sm text-base text-pretty md:text-right">
              From Pilbara-ready dual cabs to city hatches. Pick a shape and see what’s on the yard today.
            </p>
          </div>
          <div className="mt-10">
            <CategoryRail items={categories} />
          </div>
        </Container>
      </section>

      {/* ---------------- Trade-in promo ---------------- */}
      <section className="bg-background pt-20 sm:pt-28">
        <Container>
          <div className="dark text-foreground relative isolate overflow-hidden rounded-2xl bg-[#c3221b]">
            <Img
              src="/images/promo/trade-in.webp"
              alt=""
              fill
              sizes="(min-width: 1280px) 1216px, 100vw"
              className="-z-10 object-cover object-[78%_center]"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#b81f18]/85 via-[#b81f18]/40 to-transparent md:via-transparent" />
            <div className="flex min-h-[24rem] max-w-lg flex-col justify-center p-7 sm:min-h-[26rem] sm:p-12">
              <p className="text-sm font-medium text-white/85">Trade-in valuations</p>
              <h2 className="font-display mt-3 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1] font-black text-white" style={{ fontStretch: '112%' }}>
                Your old car is
                <br />
                your deposit.
              </h2>
              <p className="mt-4 max-w-sm text-base text-white/90">
                Send us the details and up to six photos. We’ll come back with a trade-in figure you can put towards your next car.
              </p>
              <Link
                href="/trade-in"
                className="sda-press bg-brand-black mt-7 inline-flex h-12 w-fit items-center gap-3 rounded-full pr-1.5 pl-6 text-sm font-semibold text-white hover:bg-black"
              >
                Value my trade-in
                <span className="grid size-9 place-items-center rounded-full bg-white text-black">
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- Latest cars ---------------- */}
      <section className="bg-background py-20 sm:py-28">
        <Container>
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <Kicker>Latest arrivals</Kicker>
              <Headline className="mt-4" lead="Fresh on the yard" muted="this week." />
            </div>
          </div>
          <div className="mt-10">
            {available.length ? (
              <LatestCars cars={available} total={cars.length} />
            ) : (
              <p className="text-muted-foreground">New stock is on the way. Call us on {b.phone} to hear what’s coming in.</p>
            )}
          </div>
        </Container>
      </section>

      {/* ---------------- Featured car ---------------- */}
      {featured ? (
        <section className="dark bg-brand-black text-foreground relative overflow-hidden py-20 sm:py-28">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[28rem] opacity-40 [mask-image:linear-gradient(180deg,#000_0%,transparent_100%)]">
            <Img src="/images/featured/featured-wide.webp" alt="" fill sizes="100vw" className="object-cover" />
          </div>
          <Container className="relative">
            <div className="mx-auto max-w-2xl text-center">
              <Headline lead="Step inside" muted="the standout of the yard." mutedClassName="text-white/45" />
              <p className="text-muted-foreground mx-auto mt-5 max-w-lg text-base text-pretty">
                Our pick this week. See it in person, take it for a drive, or put a deposit down to hold it.
              </p>
            </div>

            <div className="bg-brand-graphite mt-12 grid overflow-hidden rounded-2xl lg:grid-cols-[1.35fr_1fr]">
              <div className="bg-brand-stone relative aspect-[4/3] lg:aspect-auto lg:min-h-[28rem]">
                <Img
                  src={carCoverUrl(featured.images, 'full')}
                  alt={featured.images?.[0]?.alt || carName(featured)}
                  fill
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col p-6 sm:p-10">
                <Kicker className="text-white/80">Featured</Kicker>
                <h3 className="font-display mt-4 text-3xl leading-tight font-extrabold text-white sm:text-4xl" style={{ fontStretch: '110%' }}>
                  {carName(featured)}
                </h3>
                <p className="text-muted-foreground mt-1">{featured.variant}</p>

                <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5 border-y border-white/10 py-6">
                  <Stat label="Odometer">
                    <CountUp value={featured.km} className="sda-num" />
                    <span className="text-muted-foreground ml-1 text-sm font-semibold">km</span>
                  </Stat>
                  <Stat label="Year">
                    <span className="sda-num">{featured.year}</span>
                  </Stat>
                  <Stat label="Gearbox">
                    {transmissionLabel(featured.transmission)}
                  </Stat>
                </dl>

                <div className="mt-auto flex flex-wrap items-end justify-between gap-6 pt-8">
                  <div>
                    <p className="text-muted-foreground text-xs">Price</p>
                    <p className="font-display sda-num text-4xl font-black text-white" style={{ fontStretch: '112%' }}>
                      {formatAUD(featured.priceCents)}
                    </p>
                  </div>
                  <Link
                    href={`/cars/${featured.slug}`}
                    className="sda-press bg-brand-red hover:bg-brand-red-hover inline-flex h-12 items-center gap-3 rounded-full pr-1.5 pl-6 text-sm font-semibold text-white"
                  >
                    View this car
                    <span className="grid size-9 place-items-center rounded-full bg-white text-black">
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ---------------- Finance / search promo ---------------- */}
      <section className="bg-background py-20 sm:py-28">
        <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
          <div>
            <Kicker>Finance</Kicker>
            <Headline className="mt-4" lead="Know the weekly" muted="before you test drive." />
            <p className="text-muted-foreground mt-6 max-w-md text-base text-pretty sm:text-lg">
              Play with the price, deposit and term to see an indicative repayment, then browse cars that fit the number.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex gap-3">
                <span aria-hidden className="sda-blade mt-2 w-4" />
                Indicative rate of {settings.finance.indicativeRatePct}% p.a. – estimate only
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="sda-blade mt-2 w-4" />
                Terms from 1 to 7 years, weekly or monthly
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="sda-blade mt-2 w-4" />
                Trade-ins can go towards your deposit
              </li>
            </ul>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/cars"
                className="sda-press bg-brand-black inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white hover:bg-black"
              >
                Browse used cars <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/finance"
                className="sda-press inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold ring-1 ring-black/15 hover:bg-black/5"
              >
                More about finance
              </Link>
            </div>
          </div>
          <FinanceCalculator
            compact
            priceCents={medianPrice}
            ratePct={settings.finance.indicativeRatePct}
            disclaimer={settings.finance.disclaimer}
          />
        </Container>
      </section>

      {/* ---------------- Enquiry CTA ---------------- */}
      <section className="dark bg-brand-graphite text-foreground py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div>
            <Headline lead="Can’t see the one?" muted="We’ll go and find it." mutedClassName="text-white/45" />
            <p className="text-muted-foreground mt-6 max-w-md text-base text-pretty sm:text-lg">
              Tell us the make, budget and what it needs to do. New stock arrives every week and we’ll let you know when a match comes in.
            </p>
            <div className="mt-8 space-y-1 text-sm">
              <a href={telHref(b.phone)} className="sda-num block text-xl font-semibold text-white">
                {b.phone}
              </a>
              <p className="text-muted-foreground">{b.hours}</p>
            </div>
          </div>
          <EnquiryForm tone="dark" submitLabel="Send my wish list" />
        </Container>
      </section>
    </>
  );
}

function TrustItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 py-5 lg:px-6 lg:first:pl-0">
      <span aria-hidden className="text-brand-red [&>svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="text-muted-foreground block text-xs">{label}</span>
        <span className="block truncate font-medium">{value}</span>
      </span>
    </li>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-display mt-1 text-2xl font-extrabold text-white sm:text-3xl" style={{ fontStretch: '108%' }}>
        {children}
      </dd>
    </div>
  );
}
