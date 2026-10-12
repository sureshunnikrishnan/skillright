import type { RepoSummary } from '@skillright/backend';
import { ArrowRight, ExternalLink, GitBranch, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { ConfirmForm } from '@/components/ConfirmForm';
import { CopyCommand } from '@/components/CopyCommand';
import { Badge } from '@/components/ui/badge';
import { removeRepoAction } from '@/lib/actions';
import { categoryTone } from '@/lib/category';
import { hostLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

function indexCommand(repo: RepoSummary): string {
  return `skillright index ${repo.repoUrl}`;
}

export function RepoCard({ repo }: { repo: RepoSummary }) {
  const host = hostLabel(repo.sourceHost);
  const skillsHref = `/skills?repo=${encodeURIComponent(repo.repoName)}`;

  return (
    <article className="flex h-full flex-col gap-4 rounded-[1.75rem] bg-[#f3f4f6] p-5 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-500/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
              <GitBranch className="size-4" />
            </span>
            <div className="min-w-0">
              <a
                href={repo.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate font-heading text-base font-semibold tracking-tight text-foreground hover:text-primary"
              >
                {repo.repoName}
              </a>
              <p className="truncate font-mono text-xs text-muted-foreground">{repo.repoUrl}</p>
            </div>
            <a
              href={repo.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Open ${repo.repoName}`}
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
        <Badge variant="outline" className={cn('shrink-0 border-0 ring-1', categoryTone(host))}>
          {host}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {repo.skillCount} skill{repo.skillCount === 1 ? '' : 's'}
        </span>
      </div>

      <CopyCommand command={indexCommand(repo)} />

      <div className="mt-auto flex items-center justify-between gap-3">
        <ConfirmForm
          action={removeRepoAction}
          message={`Remove ${repo.repoName} from the local registry? Skills that only exist in this repo will be deleted.`}
          hidden={{ repo: repo.repoUrl }}
          pendingLabel="Removing…"
          variant="outline"
          className="rounded-full"
        >
          <Trash2 />
          Remove
        </ConfirmForm>
        <Link
          href={skillsHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          View skills
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
