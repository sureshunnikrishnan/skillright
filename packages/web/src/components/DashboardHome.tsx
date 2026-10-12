import type { CatalogTreeNode, RepoSummary, SkillSummary } from '@skillright/backend';
import {
  ArrowRight,
  BookOpen,
  Crosshair,
  Download,
  FolderTree,
  GitBranch,
  Tags,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatTagLabel } from '@/lib/category';
import { hostLabel, skillLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

function countSkillsDeep(nodes: CatalogTreeNode[]): number {
  return nodes.reduce(
    (sum, node) => sum + node.skills.length + countSkillsDeep(node.children),
    0,
  );
}

function topLevelSeries(catalog: CatalogTreeNode[]): { label: string; value: number; path: string }[] {
  return catalog
    .map((node) => ({
      label: formatTagLabel(node.name),
      value: countSkillsDeep([node]),
      path: node.fullPath,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function AreaChart({ series }: { series: { label: string; value: number }[] }) {
  const width = 640;
  const height = 220;
  const padX = 16;
  const padY = 24;
  const max = Math.max(...series.map((item) => item.value), 1);

  if (series.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Tag a few skills to see distribution here.
      </div>
    );
  }

  const points = series.map((item, index) => {
    const x =
      series.length === 1
        ? width / 2
        : padX + (index / (series.length - 1)) * (width - padX * 2);
    const y = height - padY - (item.value / max) * (height - padY * 2);
    return { ...item, x, y };
  });

  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Skills by tag">
        <defs>
          <linearGradient id="skillArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#skillArea)" />
        <polyline
          points={line}
          fill="none"
          stroke="#6366f1"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="4" fill="#4f46e5" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between gap-2 px-1 text-[0.7rem] text-muted-foreground">
        {series.map((item) => (
          <span key={item.label} className="min-w-0 truncate text-center">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProgressGauge({ percent, labeled, total }: { percent: number; labeled: number; total: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const bars = 18;
  const filled = Math.round((clamped / 100) * bars);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 py-6">
      <div className="relative flex h-36 w-full max-w-[16rem] items-end justify-center gap-1">
        {Array.from({ length: bars }, (_, index) => {
          const active = index < filled;
          const height = 28 + Math.sin((index / (bars - 1)) * Math.PI) * 88;
          return (
            <div
              key={index}
              className={cn(
                'w-2 rounded-full transition-colors',
                active ? 'bg-violet-500' : 'bg-violet-100',
              )}
              style={{ height }}
            />
          );
        })}
        <div className="absolute inset-x-0 bottom-8 text-center">
          <p className="font-heading text-3xl font-bold tracking-tight text-foreground">{clamped}%</p>
          <p className="text-sm text-muted-foreground">Tagged</p>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {labeled} of {total} skill{total === 1 ? '' : 's'} have at least one tag
      </p>
    </div>
  );
}

export function DashboardHome({
  stats,
  skills,
  repos,
  catalog,
}: {
  stats: { skills: number; occurrences: number; repos: number; catalogNodes: number };
  skills: SkillSummary[];
  repos: RepoSummary[];
  catalog: CatalogTreeNode[];
}) {
  const series = topLevelSeries(catalog);
  const featuredRepo = [...repos].sort((a, b) => b.skillCount - a.skillCount)[0];
  const recent = skills.slice(0, 4);
  const taggedCount = skills.filter((skill) => skill.tags.length > 0).length;
  const taggedPercent = stats.skills === 0 ? 0 : Math.round((taggedCount / stats.skills) * 100);
  const attachments = countSkillsDeep(catalog);

  return (
    <div className="overflow-hidden rounded-[2rem] bg-card p-5 shadow-sm ring-1 ring-black/5 sm:p-7">
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Skill explainers
        </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A soft overview of your skill registry — skills, repos, and tags at a glance.
          </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 font-heading text-2xl font-bold tracking-tight">Summary</h2>

        <div className="grid gap-4 xl:grid-cols-12">
          <div className="flex flex-col justify-between rounded-[1.75rem] bg-gradient-to-br from-[#ebe4ff] via-[#f3e8ff] to-[#e8f1ff] p-6 xl:col-span-5">
            <div>
              <p className="text-sm text-violet-900/70">Skills indexed</p>
              <p className="mt-1 font-heading text-5xl font-bold tracking-tight text-foreground tabular-nums sm:text-6xl">
                {stats.skills}
              </p>
              <p className="mt-2 text-sm text-violet-900/60">
                across {stats.repos} repositor{stats.repos === 1 ? 'y' : 'ies'}
              </p>
            </div>
            <Link
              href="/skills"
              className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium text-foreground shadow-sm ring-1 ring-violet-200/80 transition hover:bg-white"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-violet-500 text-white">
                <Crosshair className="size-4" />
              </span>
              What skills are in your registry?
              <ArrowRight className="ml-auto size-4 text-muted-foreground" />
            </Link>
          </div>

          <div className="flex flex-col justify-between rounded-[1.75rem] bg-[#f3f4f6] p-6 xl:col-span-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Recent Repository</p>
              {featuredRepo ? (
                <div className="mt-5 flex items-start gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                    <GitBranch className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-lg font-semibold tracking-tight">
                      {featuredRepo.repoName}
                    </p>
                    <p className="text-xs text-muted-foreground">{hostLabel(featuredRepo.sourceHost)}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">No repositories indexed yet.</p>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {featuredRepo ? (
                <>
                  <Button asChild size="sm" className="rounded-full">
                    <Link href={`/skills?repo=${encodeURIComponent(featuredRepo.repoName)}`}>
                      <BookOpen />
                      View
                    </Link>
                  </Button>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {featuredRepo.skillCount} skill{featuredRepo.skillCount === 1 ? '' : 's'}
                  </span>
                </>
              ) : (
                <Button asChild size="sm" className="rounded-full">
                  <Link href="/repos">
                    <Download />
                    Index
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-card p-6 ring-1 ring-border xl:col-span-4">
            <p className="mb-4 text-sm font-medium text-muted-foreground">Registry snapshot</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Skills', value: stats.skills, icon: BookOpen },
                { label: 'Repos', value: stats.repos, icon: GitBranch },
                { label: 'Tags', value: stats.catalogNodes, icon: Tags },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-muted/80 px-3 py-4 text-center ring-1 ring-black/5"
                >
                  <item.icon className="mx-auto mb-2 size-4 text-muted-foreground" />
                  <p className="font-heading text-2xl font-bold tabular-nums tracking-tight">{item.value}</p>
                  <p className="mt-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {attachments} skill attachment{attachments === 1 ? '' : 's'} in the tag tree
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 font-heading text-2xl font-bold tracking-tight">Registry chart</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[1.75rem] bg-[#f8f7fc] p-5 ring-1 ring-black/5 lg:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Skills by top-level tag</p>
              <Link
                href="/tags"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
              >
                <FolderTree className="size-3.5" />
                Tag catalog
              </Link>
            </div>
            <AreaChart series={series} />
          </div>
          <div className="rounded-[1.75rem] bg-card p-2 ring-1 ring-border">
            <ProgressGauge percent={taggedPercent} labeled={taggedCount} total={stats.skills} />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="font-heading text-2xl font-bold tracking-tight">Recent skills</h2>
          <Link
            href="/skills"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
          >
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-[1.5rem] bg-muted/60 px-5 py-8 text-sm text-muted-foreground">
            No skills yet. Index a GitHub or Bitbucket repository to get started.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((skill) => (
              <Link
                key={skill.sha256}
                href={`/skills/${skill.sha256}`}
                className="group rounded-[1.5rem] bg-muted/50 p-4 ring-1 ring-black/5 transition hover:bg-violet-50 hover:ring-violet-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-heading font-semibold tracking-tight group-hover:text-primary">
                      {skillLabel(skill)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {skill.description || 'No description in front matter.'}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(skill.tags.length > 0 ? skill.tags.slice(0, 2) : ['Untagged']).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white px-2.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground ring-1 ring-border"
                    >
                      {tag === 'Untagged' ? tag : formatTagLabel(tag)}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
