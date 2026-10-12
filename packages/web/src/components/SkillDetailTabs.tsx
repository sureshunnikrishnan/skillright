'use client';

import { BookOpen, FolderTree, Tags } from 'lucide-react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SkillDetailTab } from '@/lib/skill-detail-tabs';
import { cn } from '@/lib/utils';

const triggerClass =
  'rounded-full border-0 px-4 py-2 data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none';

export function SkillDetailTabs({
  defaultTab = 'overview',
  overview,
  sources,
  tags,
  counts,
}: {
  defaultTab?: SkillDetailTab;
  overview: React.ReactNode;
  sources: React.ReactNode;
  tags: React.ReactNode;
  counts: {
    tags: number;
    recommendations: number;
    sources: number;
  };
}) {
  const [tab, setTab] = useState<SkillDetailTab>(defaultTab);
  const [sourcesKey, setSourcesKey] = useState(0);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = value as SkillDetailTab;
        setTab(next);
        if (next === 'sources') setSourcesKey((key) => key + 1);
      }}
      className="gap-6"
    >
      <TabsList className="gap-2 border-0">
        <TabsTrigger value="overview" className={cn(triggerClass)}>
          <BookOpen />
          Overview
        </TabsTrigger>
        <TabsTrigger value="sources" className={cn(triggerClass)}>
          <FolderTree />
          Sources
          {counts.sources > 0 ? (
            <span className="rounded-full bg-foreground/10 px-1.5 text-[0.7rem] tabular-nums text-muted-foreground">
              {counts.sources}
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="tags" className={cn(triggerClass)}>
          <Tags />
          Tags
          {counts.tags + counts.recommendations > 0 ? (
            <span className="rounded-full bg-foreground/10 px-1.5 text-[0.7rem] tabular-nums text-muted-foreground">
              {counts.tags}
              {counts.recommendations > 0 ? `+${counts.recommendations}` : ''}
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="sources">
        <div key={sourcesKey}>{sources}</div>
      </TabsContent>
      <TabsContent value="tags">{tags}</TabsContent>
    </Tabs>
  );
}
