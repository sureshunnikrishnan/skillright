import { getProjectContext } from '@skillright/backend';
import { FolderOpen, FolderX } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ClearProjectButton, ProjectDirForm } from '@/components/ProjectDirForm';
import { ProjectFlash } from '@/components/ProjectFlash';
import { withDb } from '@/lib/db';

export async function AppTopbar() {
  const project = withDb((db) => getProjectContext(db));
  const installedCount = project.localSkills.length;

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-4 lg:px-5">
      <Link
        href="/"
        className="shrink-0 bg-gradient-to-r from-[#6d28d9] via-[#9333ea] to-[#c026d3] bg-clip-text font-heading text-3xl font-black tracking-tight text-transparent sm:text-4xl"
      >
        Skillright.
      </Link>

      <div className="ml-auto flex min-w-0 max-w-3xl flex-1 items-center justify-end gap-2">
        <Suspense fallback={null}>
          <ProjectFlash />
        </Suspense>

        {project.projectDir ? (
          <div className="flex min-w-0 items-center gap-2 rounded-full bg-[#f3f0ff] px-3 py-1.5 ring-1 ring-violet-200/70">
            <FolderOpen className="size-3.5 shrink-0 text-primary" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold text-foreground">{project.projectName}</p>
              <p className="truncate text-[0.65rem] text-muted-foreground" title={project.projectDir}>
                {project.projectDir}
                {installedCount > 0
                  ? ` · ${installedCount} local skill${installedCount === 1 ? '' : 's'}`
                  : project.skillsRootExists
                    ? ' · no local skills yet'
                    : ' · .cursor/skills missing'}
              </p>
            </div>
            <Suspense fallback={null}>
              <ClearProjectButton />
            </Suspense>
          </div>
        ) : (
          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <FolderX className="size-3.5" />
            No project set
          </div>
        )}

        <Suspense
          fallback={
            <div className="h-8 min-w-0 max-w-xs flex-1 rounded-full bg-muted/40" aria-hidden />
          }
        >
          <ProjectDirForm projectDir={project.projectDir} />
        </Suspense>
      </div>
    </header>
  );
}
