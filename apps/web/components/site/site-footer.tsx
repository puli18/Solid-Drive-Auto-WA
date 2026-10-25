import Link from '@/components/link';
import type { PublicSettings } from '@/lib/data/public';
import { addressLines, hoursRows, mapsUrl, telHref } from './lib/format';
import { Container, LogoFull } from './primitives';

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { href: '/cars', label: 'All cars for sale' },
      { href: '/cars?body=ute,cab-chassis', label: 'Utes' },
      { href: '/cars?body=suv', label: 'SUVs' },
      { href: '/cars?drive=4x4', label: '4x4 & AWD' },
      { href: '/finance', label: 'Finance calculator' },
      { href: '/trade-in', label: 'Value my trade-in' },
    ],
  },
  {
    title: 'Dealership',
    links: [
      { href: '/about', label: 'About us' },
      { href: '/contact', label: 'Contact & directions' },
      { href: '/warranty', label: 'Warranty' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Website terms' },
      { href: '/deposit-terms', label: 'Deposit terms' },
    ],
  },
] as const;

export function SiteFooter({ settings }: { settings: PublicSettings }) {
  const b = settings.business;
  return (
    <footer className="dark bg-brand-black text-foreground relative overflow-hidden">
      <Container className="pt-16 sm:pt-24">
        {/* Signature: giant brushed-chrome wordmark, like the badge lettering on the logo. */}
        <div className="@container">
          <p aria-hidden className="sda-wordmark text-[12.2cqi]">
            SOLID DRIVE
          </p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <span aria-hidden className="sda-blade w-16" />
          {/* Negative right margin cancels the trailing letter-spacing so the text sits optically centred. */}
          <span className="text-brand-chrome -mr-[0.5em] text-xs font-semibold tracking-[0.5em] uppercase">Auto · WA</span>
          <span aria-hidden className="sda-blade sda-blade-rev w-16" />
        </div>

        <div className="mt-14 grid gap-12 border-t border-white/10 pt-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="space-y-6">
            <LogoFull className="w-32" />
            <address className="text-muted-foreground text-sm leading-relaxed not-italic">
              {addressLines(b).map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
              <a href={mapsUrl(b)} target="_blank" rel="noopener" className="text-foreground mt-2 inline-block underline-offset-4 hover:underline">
                Get directions
              </a>
            </address>
            <div className="text-sm">
              <a href={telHref(b.phone)} className="sda-num block text-lg font-semibold text-white">
                {b.phone}
              </a>
              <a href={`mailto:${b.email}`} className="text-muted-foreground hover:text-foreground">
                {b.email}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="font-sans text-sm font-semibold text-white">{col.title}</h2>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-muted-foreground hover:text-foreground transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <div>
              <h2 className="font-sans text-sm font-semibold text-white">Opening hours</h2>
              <ul className="text-muted-foreground mt-4 space-y-2.5 text-sm">
                {hoursRows(b.hours).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="text-muted-foreground mt-14 flex flex-col gap-3 border-t border-white/10 py-8 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {b.name}. ABN <span className="sda-num">{b.abn}</span>
          </p>
          <p>
            Licensed motor vehicle dealer · <span className="sda-num font-mono">{b.dealerLicenceNo}</span>
          </p>
        </div>
      </Container>
    </footer>
  );
}
