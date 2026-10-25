/**
 * Document <head> metadata for a client-rendered SPA (replaces Next's `metadata` / `generateMetadata`).
 * Route modules export `metadata` (static) or `meta(loaderData)` (dynamic); lib/route.tsx applies it with
 * the section's defaults/title template via `useDocumentMeta`.
 */
import { useEffect } from 'react';
import { DEMO_MODE } from './data/mode';
import { publicEnv } from './env';

export interface Metadata {
  title?: string | { absolute: string };
  description?: string;
  alternates?: { canonical?: string };
  robots?: { index?: boolean; follow?: boolean; [key: string]: unknown };
  referrer?: string;
  openGraph?: {
    type?: string;
    title?: string;
    description?: string;
    url?: string;
    images?: { url: string; alt?: string }[];
  };
  twitter?: { card?: string; title?: string; description?: string; images?: string[] };
}

export interface MetaDefaults {
  title: string;
  template: string;
  description?: string;
  robots?: Metadata['robots'];
}

export const SITE_META: MetaDefaults = {
  title: 'Solid Drive Auto WA – Quality used cars in Perth',
  template: '%s | Solid Drive Auto WA',
  description: 'Quality used cars, utes and SUVs in Perth, Western Australia. Book a test drive online.',
};

export const ADMIN_META: MetaDefaults = {
  title: 'Admin',
  template: '%s · SDA Admin',
  description: SITE_META.description,
  robots: { index: false, follow: false },
};

const ATTR = 'data-sda-meta';
const abs = (url: string) => (/^https?:/.test(url) ? url : `${publicEnv.siteUrl}${url.startsWith('/') ? '' : '/'}${url}`);

function setTag(head: HTMLElement, tag: 'meta' | 'link', attrs: Record<string, string>) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.setAttribute(ATTR, '');
  head.appendChild(el);
}

function robotsContent(r: NonNullable<Metadata['robots']>): string {
  return [r.index === false ? 'noindex' : 'index', r.follow === false ? 'nofollow' : 'follow'].join(', ');
}

export function applyDocumentMeta(meta: Metadata | undefined, defaults: MetaDefaults): void {
  const m = meta ?? {};
  const title =
    typeof m.title === 'object' ? m.title.absolute : m.title ? defaults.template.replace('%s', m.title) : defaults.title;
  document.title = title;

  const head = document.head;
  head.querySelectorAll(`[${ATTR}]`).forEach((el) => el.remove());
  const description = m.description ?? defaults.description;
  const descEl = head.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (descEl) descEl.content = description ?? '';

  const robots = DEMO_MODE ? { index: false, follow: false } : (m.robots ?? defaults.robots);
  if (robots && !head.querySelector(`meta[name="robots"]:not([${ATTR}])`)) setTag(head, 'meta', { name: 'robots', content: robotsContent(robots) });
  if (m.referrer) setTag(head, 'meta', { name: 'referrer', content: m.referrer });
  if (m.alternates?.canonical) setTag(head, 'link', { rel: 'canonical', href: abs(m.alternates.canonical) });

  const og = m.openGraph;
  if (og) {
    if (og.type) setTag(head, 'meta', { property: 'og:type', content: og.type });
    setTag(head, 'meta', { property: 'og:title', content: og.title ?? title });
    if (og.description ?? description) setTag(head, 'meta', { property: 'og:description', content: (og.description ?? description)! });
    if (og.url) setTag(head, 'meta', { property: 'og:url', content: abs(og.url) });
    for (const img of og.images ?? []) {
      setTag(head, 'meta', { property: 'og:image', content: abs(img.url) });
      if (img.alt) setTag(head, 'meta', { property: 'og:image:alt', content: img.alt });
    }
    setTag(head, 'meta', { property: 'og:site_name', content: 'Solid Drive Auto WA' });
  }
  const tw = m.twitter;
  if (tw) {
    if (tw.card) setTag(head, 'meta', { name: 'twitter:card', content: tw.card });
    if (tw.title) setTag(head, 'meta', { name: 'twitter:title', content: tw.title });
    if (tw.description) setTag(head, 'meta', { name: 'twitter:description', content: tw.description });
    for (const img of tw.images ?? []) setTag(head, 'meta', { name: 'twitter:image', content: abs(img) });
  }
}

/** Set title, description, robots, canonical and Open Graph/Twitter tags for the current page. */
export function useDocumentMeta(meta: Metadata | undefined, defaults: MetaDefaults = SITE_META): void {
  const key = JSON.stringify(meta ?? null);
  useEffect(() => {
    applyDocumentMeta(meta, defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialised metadata
  }, [key, defaults]);
}

/** Adds a schema.org JSON-LD <script> to <head> while the page is mounted (React won't render <script> on the client). */
export function useJsonLd(data: object): void {
  const json = JSON.stringify(data);
  useEffect(() => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.text = json.replace(/</g, '\\u003c');
    document.head.appendChild(el);
    return () => el.remove();
  }, [json]);
}
