import type { Metadata } from '@/lib/meta';
import Link from '@/components/link';
import { ArrowRight } from 'lucide-react';
import { Container, Headline } from '@/components/site/primitives';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <section className="dark bg-brand-black text-foreground relative overflow-hidden">
      <Container className="flex min-h-[80svh] flex-col justify-center pt-[calc(var(--sda-header-h)+3rem)] pb-20">
        <p className="sda-wordmark text-[clamp(6rem,24vw,16rem)]" aria-hidden>
          404
        </p>
        <Headline as="h1" className="mt-6" lead="Wrong turn." muted="This page isn’t on the map." mutedClassName="text-white/45" />
        <p className="text-muted-foreground mt-5 max-w-md">The car may have been sold or the link has changed. Here’s how to get back on the road.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/cars" className="sda-press bg-brand-red inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white">
            Browse cars <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/" className="sda-press inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-white ring-1 ring-white/25">
            Home
          </Link>
        </div>
      </Container>
    </section>
  );
}
