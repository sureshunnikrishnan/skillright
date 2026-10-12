import type { SkillInstallStatus, SkillSummary } from '@skillright/backend';
import { ArrowRight, ExternalLink, GitBranch, Hash, Tag, User } from 'lucide-react';
import Link from 'next/link';
import { CopyCommand } from '@/components/CopyCommand';
import { InstallStatusBadge } from '@/components/InstallStatusBadge';
import { Badge } from '@/components/ui/badge';
import { categoryTone, formatTagLabel, primaryCategory } from '@/lib/category';
import { hostLabel, shortSha, skillLabel, skillRepoLink } from '@/lib/format';
import { cn } from '@/lib/utils';

function installCommand(skill: SkillSummary): string {
  const id = skill.name.trim() || shortSha(skill.sha256);
  const safe = /\s/.test(id) ? JSON.stringify(id) : id;
  return `skillright install ${safe} --dir ./.cursor/skills`;
}

export function SkillCard({
  skill,
  installStatus,
}: {
  skill: SkillSummary;
  installStatus?: SkillInstallStatus;
}) {
  const name = skillLabel(skill);
  const category = primaryCategory(skill.tags);
  const categoryHref = skill.tags[0] ? `/tags/${skill.tags[0].split('/')[0]}` : '/tags';
  const extraTags = skill.tags.slice(0, 3);

  return (
    <article className="group flex h-full flex-col gap-4 rounded-[1.75rem] bg-[#f8f7fc] p-5 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:bg-violet-50 hover:shadow-md hover:shadow-violet-500/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/skills/${skill.sha256}`}
              className="truncate font-heading text-base font-semibold tracking-tight text-foreground group-hover:text-primary"
            >
              {name}
            </Link>
            <a
              href={skillRepoLink(skill)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Open ${name} repository`}
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
          {installStatus ? (
            <div className="pt-0.5">
              <InstallStatusBadge status={installStatus} />
            </div>
          ) : null}
        </div>
        <Badge asChild variant="outline" className={cn('shrink-0 border-0 ring-1', categoryTone(category))}>
          <Link href={categoryHref}>{formatTagLabel(category)}</Link>
        </Badge>
      </div>

      <p className="line-clamp-3 min-h-[3.75rem] flex-1 text-sm leading-relaxed text-muted-foreground">
        {skill.description || 'No description in front matter.'}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {skill.author ? (
          <Link
            href={`/skills?author=${encodeURIComponent(skill.author)}`}
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <User className="size-3.5" />
            {skill.author}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" />
            (No Author)
          </span>
        )}
        {skill.version ? (
          <span className="inline-flex items-center gap-1">
            <Hash className="size-3.5" />
            v{skill.version}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <GitBranch className="size-3.5" />
          {hostLabel(skill.sourceHost)}
          {skill.repoRef ? (
            <>
              {' · '}
              <Link
                href={`/skills?ref=${encodeURIComponent(skill.repoRef)}`}
                className="transition-colors hover:text-foreground"
              >
                {skill.repoRef}
              </Link>
            </>
          ) : null}
        </span>
        {extraTags.length > 0 ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <Tag className="size-3.5 shrink-0" />
            <span className="truncate">{extraTags.map(formatTagLabel).join(' · ')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Tag className="size-3.5" />
            Untagged
          </span>
        )}
      </div>

      <CopyCommand command={installCommand(skill)} />

      <div className="flex justify-end">
        <Link
          href={`/skills/${skill.sha256}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          View Details
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
