import Link from '@/components/link';
import { usePathname } from '@/lib/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, Phone } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { LogoMark } from './primitives';

export const NAV = [
  { href: '/cars', label: 'Cars for sale' },
  { href: '/finance', label: 'Finance' },
  { href: '/trade-in', label: 'Trade-in' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * Fixed header. Transparent over each page's dark opening band, turning solid once the page scrolls.
 */
export function SiteHeader({ phone, telHref, hours }: { phone: string; telHref: string; hours: string }) {
  const pathname = usePathname() ?? '/';
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        'dark text-foreground fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300',
        solid ? 'bg-brand-black/95 border-b border-white/10 backdrop-blur-md' : 'border-b border-transparent bg-transparent',
      )}
    >
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-[var(--sda-header-h)] max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Solid Drive Auto WA – home" className="-ml-1 shrink-0 p-1">
          <LogoMark priority className="h-10 sm:h-11" />
        </Link>

        <nav aria-label="Main" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'relative rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    isActive(item.href) ? 'text-white' : 'text-white/70 hover:text-white',
                  )}
                >
                  {item.label}
                  {isActive(item.href) ? (
                    <span aria-hidden className="bg-brand-red absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <a
            href={telHref}
            className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white md:inline-flex"
          >
            <Phone className="size-4" aria-hidden />
            <span className="sda-num">{phone}</span>
          </a>
          <Link
            href="/cars"
            className="sda-press bg-brand-chrome-light text-brand-black hover:bg-white hidden h-10 items-center gap-2 rounded-full pr-1.5 pl-4 text-sm font-semibold sm:inline-flex"
          >
            Browse cars
            <span className="bg-brand-red grid size-7 place-items-center rounded-full text-white">
              <ArrowRight className="size-3.5" aria-hidden />
            </span>
          </Link>

          <a
            href={telHref}
            aria-label={`Call ${phone}`}
            className="grid size-11 place-items-center rounded-full text-white/90 md:hidden"
          >
            <Phone className="size-5" />
          </a>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="grid size-11 place-items-center rounded-full border border-white/15 text-white lg:hidden"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="dark bg-brand-black text-foreground w-[88vw] max-w-sm border-white/10 p-0">
              <div className="flex h-full flex-col px-6 pt-6 pb-8">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
                <LogoMark className="h-10 self-start" />
                <nav aria-label="Mobile" className="mt-10">
                  <ul className="space-y-1">
                    <li>
                      <Link href="/" className="font-display block py-2 text-3xl font-extrabold" style={{ fontStretch: '110%' }}>
                        Home
                      </Link>
                    </li>
                    {NAV.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive(item.href) ? 'page' : undefined}
                          className={cn(
                            'font-display flex items-center gap-3 py-2 text-3xl font-extrabold',
                            isActive(item.href) ? 'text-white' : 'text-white/75',
                          )}
                          style={{ fontStretch: '110%' }}
                        >
                          {item.label}
                          {isActive(item.href) ? <span aria-hidden className="sda-blade" /> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
                <div className="mt-auto space-y-4 border-t border-white/10 pt-6 text-sm">
                  <a href={telHref} className="flex items-center gap-2 text-base font-semibold text-white">
                    <Phone className="size-4" aria-hidden /> {phone}
                  </a>
                  <p className="text-muted-foreground">{hours}</p>
                  <Link
                    href="/cars"
                    className="sda-press bg-brand-red hover:bg-brand-red-hover flex h-12 items-center justify-center rounded-full font-semibold text-white"
                  >
                    Browse all cars
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
