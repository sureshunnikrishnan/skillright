import type { CatalogTreeNode } from '@skillright/backend';
import { ArrowRight, FolderTree, Layers } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { categoryTone, formatTagLabel } from '@/lib/category';
import { skillLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

function countSkills(node: CatalogTreeNode): number {
  return node.skills.length + node.children.reduce((sum, child) => sum + countSkills(child), 0);
}

function countDescendants(node: CatalogTreeNode): number {
  return node.children.length + node.children.reduce((sum, child) => sum + countDescendants(child), 0);
}

export function TagCard({ node }: { node: CatalogTreeNode }) {
  const skillCount = countSkills(node);
  const childCount = countDescendants(node);
  const previewSkills = node.skills.slice(0, 3);
  const previewChildren = node.children.slice(0, 4);

  return (
    <article className="group flex h-full flex-col gap-4 rounded-[1.75rem] bg-gradient-to-br from-[#ebe4ff]/70 via-[#f8f7fc] to-[#e8f1ff]/70 p-5 ring-1 ring-violet-100 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-500/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link
            href={`/tags/${node.fullPath}`}
            className="block truncate font-heading text-base font-semibold tracking-tight text-foreground group-hover:text-primary"
          >
            {formatTagLabel(node.name)}
          </Link>
          <p className="truncate font-mono text-xs text-muted-foreground">{node.fullPath}</p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 border-0 ring-1', categoryTone(node.name))}>
          {skillCount} skill{skillCount === 1 ? '' : 's'}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Layers className="size-3.5" />
          {skillCount} attached
        </span>
        <span className="inline-flex items-center gap-1">
          <FolderTree className="size-3.5" />
          {childCount} child{childCount === 1 ? '' : 'ren'}
        </span>
      </div>

      {previewChildren.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {previewChildren.map((child) => (
            <Badge key={child.id} variant="secondary" asChild className="rounded-full bg-white/80">
              <Link href={`/tags/${child.fullPath}`}>{formatTagLabel(child.name)}</Link>
            </Badge>
          ))}
          {node.children.length > previewChildren.length ? (
            <Badge variant="outline" className="rounded-full">
              +{node.children.length - previewChildren.length}
            </Badge>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No child tags under this node.</p>
      )}

      {previewSkills.length > 0 ? (
        <ul className="space-y-1.5 border-t border-violet-200/60 pt-3 text-sm">
          {previewSkills.map((skill) => (
            <li key={skill.sha256} className="truncate">
              <Link className="text-foreground/90 hover:text-primary hover:underline" href={`/skills/${skill.sha256}`}>
                {skillLabel(skill)}
              </Link>
            </li>
          ))}
          {node.skills.length > previewSkills.length ? (
            <li className="text-xs text-muted-foreground">
              +{node.skills.length - previewSkills.length} more on this node
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-auto flex justify-end">
        <Link
          href={`/tags/${node.fullPath}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Browse tag
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
