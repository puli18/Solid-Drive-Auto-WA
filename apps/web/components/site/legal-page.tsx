import { paragraphs } from './lib/format';
import { Container, PageHero } from './primitives';

/** Long-form text page (privacy, terms, deposit terms, warranty). Text is edited in admin settings/legal. */
export function LegalPage({
  title,
  muted,
  text,
  crumb,
  aside,
  children,
}: {
  title: string;
  muted?: string;
  text: string;
  crumb: { href: string; label: string };
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const paras = paragraphs(text);
  return (
    <>
      <PageHero crumbs={[crumb]} title={title} muted={muted} />
      <section className="bg-background py-12 sm:py-16">
        <Container className="grid gap-12 lg:grid-cols-[1fr_20rem]">
          <div className="max-w-[70ch]">
            <div className="sda-prose text-base text-black/80">
              {paras.length ? paras.map((p, i) => <p key={i}>{p}</p>) : <p>This page is being updated. Please contact us for details.</p>}
            </div>
            {children}
          </div>
          {aside ? <aside className="text-sm">{aside}</aside> : null}
        </Container>
      </section>
    </>
  );
}
