import { useLoaderData } from 'react-router';
import type { LoaderData } from '@/lib/route';
import { type Metadata, useJsonLd } from '@/lib/meta';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { getPublicSettings } from '@/lib/data/public';
import { EnquiryForm } from '@/components/site/forms/enquiry-form';
import { addressLines, hoursRows, mapsEmbedUrl, mapsUrl, telHref } from '@/components/site/lib/format';
import { Container, PageHero } from '@/components/site/primitives';

export const metadata: Metadata = {
  title: 'Contact & directions',
  description: 'Find Solid Drive Auto WA in Perth: address, opening hours, phone and an enquiry form.',
  alternates: { canonical: '/contact' },
};

export async function loader() {
  return getPublicSettings();
}

export default function ContactPage() {
  const s = useLoaderData() as LoaderData<typeof loader>;
  const b = s.business;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: b.name,
    telephone: b.phone,
    email: b.email,
    openingHours: b.hours,
    address: {
      '@type': 'PostalAddress',
      streetAddress: [b.address.line1, b.address.line2].filter(Boolean).join(', '),
      addressLocality: b.address.suburb,
      addressRegion: b.address.state,
      postalCode: b.address.postcode,
      addressCountry: 'AU',
    },
  };
  useJsonLd(jsonLd);

  return (
    <>
      <PageHero
        crumbs={[{ href: '/contact', label: 'Contact' }]}
        title="Come for a drive."
        muted="Or just say hello."
        intro="Call, send a message, or drop into the yard during opening hours."
      />
      <section className="bg-background py-12 sm:py-16">
        <Container className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="space-y-8">
            <ul className="grid gap-6 sm:grid-cols-2">
              <Info icon={<MapPin />} label="Address">
                {addressLines(b).map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
                <a href={mapsUrl(b)} target="_blank" rel="noopener" className="mt-1 inline-block text-sm font-semibold underline underline-offset-4">
                  Get directions
                </a>
              </Info>
              <Info icon={<Clock />} label="Opening hours">
                {hoursRows(b.hours).map((h) => (
                  <span key={h} className="block">
                    {h}
                  </span>
                ))}
              </Info>
              <Info icon={<Phone />} label="Phone">
                <a href={telHref(b.phone)} className="sda-num text-lg font-semibold">
                  {b.phone}
                </a>
              </Info>
              <Info icon={<Mail />} label="Email">
                <a href={`mailto:${b.email}`} className="break-all underline-offset-4 hover:underline">
                  {b.email}
                </a>
              </Info>
            </ul>
            <div className="bg-brand-stone aspect-[4/3] overflow-hidden rounded-2xl">
              <iframe
                title={`Map showing ${b.name}`}
                src={mapsEmbedUrl(b)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="size-full border-0 grayscale-[35%]"
              />
            </div>
            <p className="text-muted-foreground font-mono text-xs">
              {b.name} · ABN {b.abn} · {b.dealerLicenceNo}
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl" style={{ fontStretch: '108%' }}>
              Send us a message
            </h2>
            <p className="text-muted-foreground mt-2 mb-6">We’ll get back to you as soon as we can.</p>
            <EnquiryForm />
          </div>
        </Container>
      </section>
    </>
  );
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span aria-hidden className="bg-brand-stone text-brand-red grid size-10 shrink-0 place-items-center rounded-full [&>svg]:size-4">
        {icon}
      </span>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <div className="mt-1 font-medium">{children}</div>
      </div>
    </li>
  );
}
