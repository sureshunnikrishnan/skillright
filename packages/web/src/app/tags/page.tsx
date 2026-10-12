import { getCatalogTree } from '@skillright/backend';
import type { Metadata } from 'next';
import { CatalogTree } from '@/components/CatalogTree';
import { PageHeader } from '@/components/PageHeader';
import { SoftEmpty, SoftPanel, SoftShell } from '@/components/SoftShell';
import { TagCard } from '@/components/TagCard';
import { TagCatalogTabs } from '@/components/TagCatalogTabs';
import { withDb } from '@/lib/db';
import { isTagCatalogTab } from '@/lib/tag-catalog-tabs';

export const metadata: Metadata = {
  title: 'Tag Catalog',
};

function countSkillsDeep(nodes: ReturnType<typeof getCatalogTree>): number {
  return nodes.reduce(
    (sum, node) => sum + node.skills.length + countSkillsDeep(node.children),
    0,
  );
}

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const query = await searchParams;
  const catalog = withDb((db) => getCatalogTree(db));
  const attachments = countSkillsDeep(catalog);
  const defaultTab = isTagCatalogTab(query.tab) ? query.tab : 'hierarchy';

  return (
    <SoftShell>
      <PageHeader
        title="Tag catalog"
        description={
          catalog.length === 0
            ? 'Hierarchical tags attached to skills. Index a repository or add tags to get started.'
            : `${catalog.length} top-level tag${catalog.length === 1 ? '' : 's'} · ${attachments} skill attachment${attachments === 1 ? '' : 's'}.`
        }
      />

      {catalog.length === 0 ? (
        <SoftEmpty>Catalog is empty. Index a repository or add tags to skills.</SoftEmpty>
      ) : (
        <TagCatalogTabs
          defaultTab={defaultTab}
          hierarchy={
            <SoftPanel tone="mist">
              <CatalogTree nodes={catalog} />
            </SoftPanel>
          }
          cards={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {catalog.map((node) => (
                <TagCard key={node.id} node={node} />
              ))}
            </div>
          }
        />
      )}
    </SoftShell>
  );
}
