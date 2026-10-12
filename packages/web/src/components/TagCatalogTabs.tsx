'use client';

import { FolderTree, LayoutGrid } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TagCatalogTab } from '@/lib/tag-catalog-tabs';
import { cn } from '@/lib/utils';

export function TagCatalogTabs({
  defaultTab = 'hierarchy',
  hierarchy,
  cards,
}: {
  defaultTab?: TagCatalogTab;
  hierarchy: React.ReactNode;
  cards: React.ReactNode;
}) {
  return (
    <Tabs defaultValue={defaultTab} className="gap-6">
      <TabsList className="gap-2 border-0">
        <TabsTrigger
          value="hierarchy"
          className={cn(
            'rounded-full border-0 px-4 py-2 data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none',
          )}
        >
          <FolderTree />
          Hierarchy
        </TabsTrigger>
        <TabsTrigger
          value="cards"
          className={cn(
            'rounded-full border-0 px-4 py-2 data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none',
          )}
        >
          <LayoutGrid />
          Cards
        </TabsTrigger>
      </TabsList>

      <TabsContent value="hierarchy">{hierarchy}</TabsContent>
      <TabsContent value="cards">{cards}</TabsContent>
    </Tabs>
  );
}
