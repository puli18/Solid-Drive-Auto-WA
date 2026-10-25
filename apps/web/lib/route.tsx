/**
 * Route-module glue for React Router's lazy routes.
 *
 * A page module (app/.../page.tsx) may export:
 *   default            – the page component (reads data with useLoaderData())
 *   loader             – data loader (calls @/lib/data functions; throw notFound() for 404s)
 *   metadata | meta()  – static metadata, or a function of the loader data (see lib/meta.ts)
 *   shouldRevalidate   – optional; by default a page's loader only re-runs when the pathname changes
 *                        (search-param updates such as /cars filters are handled in the component)
 */
import { type ComponentType } from 'react';
import { type LoaderFunction, type ShouldRevalidateFunction, useLoaderData } from 'react-router';
import { type Metadata, type MetaDefaults, SITE_META, useDocumentMeta } from './meta';

export interface RouteModule {
  default: ComponentType;
  loader?: LoaderFunction;
  metadata?: Metadata;
  meta?: (data: never) => Metadata;
  shouldRevalidate?: ShouldRevalidateFunction;
}

/** Loader data type for `useLoaderData() as LoaderData<typeof loader>`. */
export type LoaderData<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

export const revalidateOnPathChange: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) =>
  currentUrl.pathname !== nextUrl.pathname ? defaultShouldRevalidate : false;

/** Lazy page route: code-split module + loader + document metadata. */
export function page(load: () => Promise<RouteModule>, defaults: MetaDefaults = SITE_META) {
  return async () => {
    const mod = await load();
    const Page = mod.default;
    const meta = mod.meta as ((data: unknown) => Metadata) | undefined;
    function Component() {
      const data = useLoaderData();
      useDocumentMeta(meta ? meta(data) : mod.metadata, defaults);
      return <Page />;
    }
    return { Component, loader: mod.loader, shouldRevalidate: mod.shouldRevalidate ?? revalidateOnPathChange };
  };
}

/** Lazy layout route (renders <Outlet/> itself). */
export function layout(load: () => Promise<RouteModule>) {
  return async () => {
    const mod = await load();
    return { Component: mod.default, loader: mod.loader, shouldRevalidate: mod.shouldRevalidate ?? revalidateOnPathChange };
  };
}
