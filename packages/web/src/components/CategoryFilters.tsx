import Link from 'next/link';
import { formatTagLabel } from '@/lib/category';
import { UNTAGGED_FILTER } from '@/lib/filters';
import { cn } from '@/lib/utils';

export function CategoryFilters({
  categories,
  active,
  basePath = '/skills',
  query,
  repo,
  author,
  ref,
}: {
  categories: string[];
  active?: string;
  basePath?: string;
  query?: string;
  repo?: string;
  author?: string;
  ref?: string;
}) {
  function hrefFor(category?: string) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (repo) params.set('repo', repo);
    if (author) params.set('author', author);
    if (ref) params.set('ref', ref);
    if (category) params.set('tag', category);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const pillClass = (selected: boolean) =>
    cn(
      'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
      selected
        ? 'bg-muted text-foreground'
        : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
    );

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Link href={hrefFor()} className={pillClass(!active)}>
        All
      </Link>
      <Link href={hrefFor(UNTAGGED_FILTER)} className={pillClass(active === UNTAGGED_FILTER)}>
        Untagged
      </Link>
      {categories.map((category) => {
        const selected = active === category || Boolean(active?.startsWith(`${category}/`));
        return (
          <Link key={category} href={hrefFor(category)} className={pillClass(selected)}>
            {formatTagLabel(category)}
          </Link>
        );
      })}
    </div>
  );
}
