import { Link } from '@tanstack/react-router';
import type { Framework } from 'fumadocs-core/framework';

/** Adapts public URLs to router paths, keeping base paths and fragments intact. */
export const SiteLink: Framework['Link'] = ({
  href = '',
  prefetch = true,
  ...props
}) => {
  if (!href.startsWith('/') || href.startsWith('//'))
    return <a href={href} {...props} />;
  const url = new URL(href, 'https://calendarpit.invalid');
  const base = import.meta.env.BASE_URL;
  const path = url.pathname.startsWith(base)
    ? `/${url.pathname.slice(base.length)}`
    : url.pathname;
  if (url.search) {
    return (
      <a href={`${base}${path.slice(1)}${url.search}${url.hash}`} {...props} />
    );
  }
  return (
    <Link
      to={path}
      hash={decodeURIComponent(url.hash.slice(1))}
      preload={prefetch ? 'intent' : false}
      {...props}
    />
  );
};
