import { getCatalogTree, listSkills, type CatalogTreeNode } from '@skillright/backend';
import { Tags } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { SkillCard } from '@/components/SkillCard';
import { SoftEmpty, SoftShell } from '@/components/SoftShell';
import { Button } from '@/components/ui/button';
import { formatTagLabel } from '@/lib/category';
import { withDb } from '@/lib/db';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string[] }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return { title: tag.join('/') };
}

function findNode(nodes: CatalogTreeNode[], fullPath: string): CatalogTreeNode | undefined {
  for (const node of nodes) {
    if (node.fullPath === fullPath) return node;
    const nested = findNode(node.children, fullPath);
    if (nested) return nested;
  }
  return undefined;
}

export default async function TagDetailPage({
  params,
}: {
  params: Promise<{ tag: string[] }>;
}) {
  const { tag } = await params;
  const fullPath = tag.join('/');
  const { node, skills } = withDb((db) => ({
    node: findNode(getCatalogTree(db), fullPath),
    skills: listSkills(db, { tag: fullPath }),
  }));

  if (!node && skills.length === 0) notFound();

  return (
    <SoftShell>
      <PageHeader
        title={formatTagLabel(fullPath.split('/').at(-1) ?? fullPath)}
        description={`Skills tagged with ${fullPath}${node?.children.length ? ` · ${node.children.length} child node(s)` : ''}.`}
      >
        <Button variant="outline" asChild className="rounded-full">
          <Link href="/tags">
            <Tags />
            All tags
          </Link>
        </Button>
      </PageHeader>

      {node && node.children.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {node.children.map((child) => (
            <Link
              key={child.id}
              href={`/tags/${child.fullPath}`}
              className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-violet-50 hover:text-foreground"
            >
              {formatTagLabel(child.name)}
            </Link>
          ))}
        </div>
      ) : null}

      {skills.length === 0 ? (
        <SoftEmpty>No skills under this tag.</SoftEmpty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {skills.map((skill) => (
              <SkillCard key={skill.sha256} skill={skill} />
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{skills.length} skill(s)</p>
        </>
      )}
    </SoftShell>
  );
}
