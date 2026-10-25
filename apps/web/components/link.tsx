/** App link: React Router `Link` for internal paths (keeps the `href` prop), plain <a> for external/tel/mailto. */
import { type AnchorHTMLAttributes, type Ref } from 'react';
import { Link as RouterLink } from 'react-router';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  replace?: boolean;
  /** `false` keeps the scroll position (search-param updates). */
  scroll?: boolean;
  /** Accepted for compatibility; route modules are lazy-loaded on navigation. */
  prefetch?: boolean | null;
  ref?: Ref<HTMLAnchorElement>;
};

const EXTERNAL = /^([a-z][a-z\d+.-]*:|\/\/)/i;

export default function Link({ href, replace, scroll, prefetch: _prefetch, ...rest }: LinkProps) {
  if (EXTERNAL.test(href)) return <a href={href} {...rest} />;
  return <RouterLink to={href} replace={replace} preventScrollReset={scroll === false} {...rest} />;
}
