import type { CatalogTreeNode } from '@skillright/backend';
import Link from 'next/link';
import { formatTagLabel } from '@/lib/category';
import { skillLabel } from '@/lib/format';

export function CatalogTree({ nodes }: { nodes: CatalogTreeNode[] }) {
  if (nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Catalog is empty. Index a repository or add tags to skills.
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {nodes.map((node) => (
        <li key={node.id}>
          <Link className="font-medium text-primary hover:underline" href={`/tags/${node.fullPath}`}>
            {formatTagLabel(node.name)}
          </Link>
          <span className="ml-2 text-muted-foreground">{node.fullPath}</span>
          {node.skills.length > 0 ? (
            <>
              <span className="ml-2 text-xs text-muted-foreground">
                · {node.skills.length} skill{node.skills.length === 1 ? '' : 's'}
              </span>
              <ul className="mt-1 space-y-1 border-l border-border pl-3">
                {node.skills.map((skill) => (
                  <li key={skill.sha256}>
                    <Link className="hover:underline" href={`/skills/${skill.sha256}`}>
                      {skillLabel(skill)}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{skill.repoUrl}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {node.children.length > 0 ? (
            <div className="mt-2 border-l border-border pl-3">
              <CatalogTree nodes={node.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
