/** Small server-safe building blocks shared across public pages. */
import { Img } from '@/components/img';
import Link from '@/components/link';
import { cn } from '@/lib/utils';

export function Container({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)} {...props} />;
}

/** The SDA WA mark (cropped transparent logo – dark backgrounds only). */
export function LogoMark({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Img
      src="/brand/sda-mark.webp"
      alt="SDA WA – Solid Drive Auto WA"
      width={320}
      height={204}
      priority={priority}
      sizes="96px"
      className={cn('h-10 w-auto', className)}
    />
  );
}

export function LogoFull({ className }: { className?: string }) {
  return (
    <Img
      src="/brand/sda-full.webp"
      alt="Solid Drive Auto WA"
      width={480}
      height={382}
      sizes="200px"
      className={cn('h-auto w-40', className)}
    />
  );
}

/** Kicker: the logo's tapered red blade + a short sentence-case label. Used sparingly, not on every section. */
export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-3 text-sm font-medium', className)}>
      <span aria-hidden className="sda-blade" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Two-tone headline: a heavy lead line and a muted second line (the reference's rhythm).
 * `as` defaults to h2.
 */
export function Headline({
  lead,
  muted,
  as: Tag = 'h2',
  size = 'lg',
  className,
  mutedClassName,
}: {
  lead: React.ReactNode;
  muted?: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  size?: 'xl' | 'lg' | 'md';
  className?: string;
  mutedClassName?: string;
}) {
  const sizes = {
    xl: 'text-[clamp(2.5rem,7vw,5.25rem)] leading-[0.95]',
    lg: 'text-[clamp(2rem,4.6vw,3.5rem)] leading-[1]',
    md: 'text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.05]',
  } as const;
  return (
    <Tag
      className={cn('font-display font-extrabold tracking-[-0.03em] text-balance', sizes[size], className)}
      style={{ fontStretch: '112%' }}
    >
      <span className="block">{lead}</span>
      {muted ? <span className={cn('text-brand-steel block', mutedClassName)}>{muted}</span> : null}
    </Tag>
  );
}

/** Dark band that opens every inner page (sits under the transparent fixed header). */
export function PageHero({
  title,
  muted,
  intro,
  crumbs,
  children,
  className,
}: {
  title: React.ReactNode;
  muted?: React.ReactNode;
  intro?: React.ReactNode;
  crumbs?: { href: string; label: string }[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('dark bg-brand-black text-foreground relative overflow-hidden', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(80% 120% at 100% 0%, color-mix(in oklab, var(--brand-red) 18%, transparent) 0%, transparent 55%), radial-gradient(60% 80% at 0% 100%, color-mix(in oklab, var(--brand-chrome) 8%, transparent) 0%, transparent 60%)',
        }}
      />
      <Container className="relative pt-[calc(var(--sda-header-h)+2.5rem)] pb-12 sm:pb-16">
        {crumbs?.length ? <Crumbs items={crumbs} /> : null}
        <Headline as="h1" size="lg" lead={title} muted={muted} className="mt-4 max-w-4xl" />
        {intro ? <div className="text-muted-foreground mt-5 max-w-2xl text-base text-pretty sm:text-lg">{intro}</div> : null}
        {children}
      </Container>
    </section>
  );
}

export function Crumbs({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
        <li>
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1.5">
            <span aria-hidden className="opacity-50">
              /
            </span>
            {i === items.length - 1 ? (
              <span aria-current="page" className="text-foreground/80 line-clamp-1">
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="hover:text-foreground transition-colors">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
