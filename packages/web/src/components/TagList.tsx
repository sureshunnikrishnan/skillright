import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export function TagList({ tags, hrefBase = '/tags' }: { tags: string[]; hrefBase?: string }) {
  if (tags.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" asChild>
          <Link href={`${hrefBase}/${tag}`}>{tag}</Link>
        </Badge>
      ))}
    </div>
  );
}
