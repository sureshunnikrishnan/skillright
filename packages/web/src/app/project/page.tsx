import {
  findLocalSkill,
  getProjectContext,
  listSkills,
  skillInstallStatus,
  type LocalSkill,
  type SkillInstallStatus,
  type SkillSummary,
} from '@skillright/backend';
import { ArrowRight, FolderOpen, FolderSearch } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Flash } from '@/components/Flash';
import { InstallStatusBadge } from '@/components/InstallStatusBadge';
import { PageHeader } from '@/components/PageHeader';
import { ProjectDirForm } from '@/components/ProjectDirForm';
import { SoftEmpty, SoftPanel, SoftShell } from '@/components/SoftShell';
import { withDb } from '@/lib/db';
import { skillLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const project = withDb((db) => getProjectContext(db));
  return { title: project.projectName ?? 'Current Project' };
}

type Filter = 'all' | SkillInstallStatus | 'local-only';

function isFilter(value: string | undefined): value is Filter {
  return (
    value === 'all' ||
    value === 'installed' ||
    value === 'modified' ||
    value === 'missing' ||
    value === 'local-only'
  );
}

function StatusRow({
  name,
  description,
  status,
  href,
  meta,
}: {
  name: string;
  description?: string;
  status: SkillInstallStatus | 'local-only';
  href?: string;
  meta?: string;
}) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-heading text-sm font-semibold tracking-tight text-foreground">
            {name}
          </p>
          {status === 'local-only' ? (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 ring-1 ring-sky-200/80">
              Local only
            </span>
          ) : (
            <InstallStatusBadge status={status} />
          )}
        </div>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {meta ? <p className="mt-1 truncate text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      {href ? <ArrowRight className="size-4 shrink-0 text-muted-foreground" /> : null}
    </>
  );

  const className = cn(
    'flex items-start gap-3 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-black/5 transition',
    href && 'hover:bg-violet-50 hover:ring-violet-200/80',
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export default async function ProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; status?: string }>;
}) {
  const params = await searchParams;
  const filter: Filter = isFilter(params.status) ? params.status : 'all';

  const { project, catalogSkills } = withDb((db) => ({
    project: getProjectContext(db),
    catalogSkills: listSkills(db),
  }));

  if (!project.projectDir) {
    return (
      <SoftShell>
        <PageHeader
          title="Current Project"
          description="Select a project folder to see which catalog skills are installed locally."
        />
        <Flash notice={params.notice} error={params.error} />

        <SoftPanel tone="lavender">
          <div className="mb-5 inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
            <FolderSearch className="mr-1.5 size-3.5" />
            Choose a project
          </div>
          <h2 className="mb-2 font-heading text-xl font-bold tracking-tight">No project selected</h2>
          <p className="mb-5 max-w-xl text-sm text-violet-900/70">
            Point Skillright at a project root. It scans{' '}
            <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">.cursor/skills</code> and
            compares installed packages with your catalog.
          </p>
          <Suspense fallback={<div className="h-11 rounded-full bg-white/60" aria-hidden />}>
            <ProjectDirForm projectDir={null} variant="panel" returnTo="/project" />
          </Suspense>
        </SoftPanel>
      </SoftShell>
    );
  }

  type CatalogEntry = { kind: 'catalog'; skill: SkillSummary; status: SkillInstallStatus };
  type LocalEntry = { kind: 'local'; local: LocalSkill };

  const catalogEntries: CatalogEntry[] = catalogSkills.map((skill) => ({
    kind: 'catalog',
    skill,
    status: skillInstallStatus(skill, project.localSkills),
  }));

  const matchedLocalPaths = new Set(
    catalogEntries
      .map((entry) => findLocalSkill(entry.skill, project.localSkills)?.path)
      .filter((path): path is string => Boolean(path)),
  );

  const localOnly: LocalEntry[] = project.localSkills
    .filter((local) => !matchedLocalPaths.has(local.path))
    .map((local) => ({ kind: 'local', local }));

  const counts = {
    all: catalogEntries.length + localOnly.length,
    installed: catalogEntries.filter((e) => e.status === 'installed').length,
    modified: catalogEntries.filter((e) => e.status === 'modified').length,
    missing: catalogEntries.filter((e) => e.status === 'missing').length,
    'local-only': localOnly.length,
  };

  const visibleCatalog =
    filter === 'all'
      ? catalogEntries
      : filter === 'local-only'
        ? []
        : catalogEntries.filter((entry) => entry.status === filter);

  const visibleLocal = filter === 'all' || filter === 'local-only' ? localOnly : [];

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'installed', label: 'Installed' },
    { id: 'modified', label: 'Modified' },
    { id: 'missing', label: 'Not installed' },
    { id: 'local-only', label: 'Local only' },
  ];

  return (
    <SoftShell>
      <PageHeader
        title={project.projectName ?? 'Current Project'}
        description={`Install status against ${catalogSkills.length} catalog skill${
          catalogSkills.length === 1 ? '' : 's'
        }.`}
      />
      <Flash notice={params.notice} error={params.error} />

      <SoftPanel tone="mist" className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-primary">
              <FolderOpen className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground" title={project.projectDir}>
                {project.projectDir}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Skills root:{' '}
                <code className="rounded bg-white/80 px-1.5 py-0.5">{project.skillsRoot}</code>
                {!project.skillsRootExists ? ' (missing)' : null}
                {' · '}
                {project.localSkills.length} local package
                {project.localSkills.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['Installed', counts.installed, 'text-emerald-700'],
                ['Modified', counts.modified, 'text-amber-800'],
                ['Not installed', counts.missing, 'text-slate-600'],
                ['Local only', counts['local-only'], 'text-sky-800'],
              ] as const
            ).map(([label, value, color]) => (
              <div
                key={label}
                className="rounded-2xl bg-white/80 px-3 py-2 text-center ring-1 ring-black/5"
              >
                <p className={cn('font-heading text-xl font-bold tabular-nums', color)}>{value}</p>
                <p className="text-[0.65rem] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </SoftPanel>

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((item) => {
          const active = filter === item.id;
          const href = item.id === 'all' ? '/project' : `/project?status=${item.id}`;
          return (
            <Link
              key={item.id}
              href={href}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition',
                active
                  ? 'bg-primary text-primary-foreground ring-primary'
                  : 'bg-muted/50 text-muted-foreground ring-border hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
              <span className="ml-1.5 tabular-nums opacity-80">{counts[item.id]}</span>
            </Link>
          );
        })}
      </div>

      {visibleCatalog.length === 0 && visibleLocal.length === 0 ? (
        <SoftEmpty>
          {catalogSkills.length === 0
            ? 'No skills in the catalog yet. Index a repository from Repos, then return here.'
            : 'No skills match this filter.'}
        </SoftEmpty>
      ) : (
        <div className="grid gap-2">
          {visibleCatalog.map((entry) => (
            <StatusRow
              key={entry.skill.sha256}
              name={skillLabel(entry.skill)}
              {...(entry.skill.description ? { description: entry.skill.description } : {})}
              status={entry.status}
              href={`/skills/${entry.skill.sha256}`}
              meta={entry.skill.repoUrl}
            />
          ))}
          {visibleLocal.map((entry) => (
            <StatusRow
              key={entry.local.path}
              name={entry.local.name}
              description="Present under .cursor/skills but not matched to a catalog skill."
              status="local-only"
              meta={entry.local.path}
            />
          ))}
        </div>
      )}
    </SoftShell>
  );
}
