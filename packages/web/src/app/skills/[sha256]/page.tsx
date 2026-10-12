import {
  getProjectContext,
  getSkill,
  recommendTags,
  skillInstallStatus,
  skillPackageDirName,
} from '@skillright/backend';
import { Check, Download, Plus, Trash2, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmForm } from '@/components/ConfirmForm';
import { Flash } from '@/components/Flash';
import { InstallStatusBadge } from '@/components/InstallStatusBadge';
import { PageHeader } from '@/components/PageHeader';
import { SkillDetailTabs } from '@/components/SkillDetailTabs';
import { SkillFilesPanel } from '@/components/SkillFilesPanel';
import { SoftPanel, SoftShell } from '@/components/SoftShell';
import { SubmitButton } from '@/components/SubmitButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addTagsAction,
  applyRecommendedTagAction,
  installSkillAction,
  removeSkillAction,
  removeTagAction,
} from '@/lib/actions';
import { withDb } from '@/lib/db';
import { hostLabel, shortSha, skillLabel } from '@/lib/format';
import { resolveSkillDetailTab } from '@/lib/skill-detail-tabs';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sha256: string }>;
}): Promise<Metadata> {
  const { sha256 } = await params;
  const skill = withDb((db) => getSkill(db, sha256));
  return { title: skill ? skillLabel(skill) : 'Skill' };
}

export default async function SkillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sha256: string }>;
  searchParams: Promise<{ notice?: string; error?: string; tab?: string }>;
}) {
  const { sha256 } = await params;
  const query = await searchParams;
  const data = withDb((db) => {
    const skill = getSkill(db, sha256);
    if (!skill) return null;
    const project = getProjectContext(db);
    return {
      skill,
      recommendations: recommendTags(db, sha256, { limit: 8 }),
      project,
      installStatus: project.projectDir
        ? skillInstallStatus(skill, project.localSkills)
        : null,
    };
  });

  if (!data) notFound();
  const { skill, recommendations, project, installStatus } = data;
  const name = skillLabel(skill);
  const packageDir = skillPackageDirName(skill);
  const recommendationCount = recommendations?.recommendations.length ?? 0;
  const defaultTab = resolveSkillDetailTab(query.tab);
  const defaultInstallDir = project.skillsRoot ?? '';
  const fileCount = 1 + skill.siblings.length;

  return (
    <SoftShell>
      <PageHeader title={name} description={skill.description || 'No description in front matter.'}>
        {installStatus ? <InstallStatusBadge status={installStatus} /> : null}
        <ConfirmForm
          action={removeSkillAction}
          message={`Remove ${name} from the local registry? This does not change the source repository.`}
          hidden={{ id: skill.sha256 }}
          pendingLabel="Removing…"
          className="rounded-full"
        >
          <Trash2 />
          Remove skill
        </ConfirmForm>
      </PageHeader>
      <Flash notice={query.notice} error={query.error} />

      <SkillDetailTabs
        defaultTab={defaultTab}
        counts={{
          tags: skill.tags.length,
          recommendations: recommendationCount,
          sources: fileCount,
        }}
        overview={
          <div className="grid gap-4">
            <SoftPanel tone="lavender">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-xl font-bold tracking-tight">Install for agents</h2>
                {installStatus ? <InstallStatusBadge status={installStatus} /> : null}
              </div>
              <p className="mb-5 text-sm text-violet-900/70">
                {project.projectDir ? (
                  <>
                    Project{' '}
                    <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">{project.projectName}</code>{' '}
                    is set. Install into{' '}
                    <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">
                      {project.skillsRoot}/{packageDir}/
                    </code>
                    , or override the destination below.
                  </>
                ) : (
                  <>
                    Write this skill into a local folder agents can load. Set a project in the top bar, or
                    enter a skills root (for example{' '}
                    <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">
                      /path/to/project/.cursor/skills
                    </code>
                    ). Files go to{' '}
                    <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">
                      &lt;folder&gt;/{packageDir}/
                    </code>
                    .
                  </>
                )}
              </p>
              <form action={installSkillAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <input type="hidden" name="sha256" value={skill.sha256} />
                <div className="grid gap-1.5">
                  <Label htmlFor="dir">Destination folder path</Label>
                  <Input
                    id="dir"
                    name="dir"
                    required={!project.projectDir}
                    defaultValue={defaultInstallDir}
                    placeholder="~/.cursor/skills or /path/to/project/.cursor/skills"
                    className="rounded-full bg-white/80"
                    autoComplete="off"
                  />
                </div>
                <SubmitButton pendingLabel="Installing…" className="rounded-full">
                  <Download />
                  {installStatus === 'installed' || installStatus === 'modified' ? 'Reinstall' : 'Install'}
                </SubmitButton>
              </form>
            </SoftPanel>

            <SoftPanel tone="mist">
              <h2 className="mb-1 font-heading text-xl font-bold tracking-tight">Metadata</h2>
              <p className="mb-5 text-sm text-muted-foreground">Indexed package details for this skill.</p>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-black/5">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Author</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {skill.author ? (
                      <Link
                        href={`/skills?author=${encodeURIComponent(skill.author)}`}
                        className="transition-colors hover:text-primary"
                      >
                        {skill.author}
                      </Link>
                    ) : (
                      '(No Author)'
                    )}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-black/5">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Version</dt>
                  <dd className="mt-1 text-sm font-medium">{skill.version || '—'}</dd>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-black/5">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Host</dt>
                  <dd className="mt-1 text-sm font-medium">{hostLabel(skill.sourceHost)}</dd>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-black/5 sm:col-span-2">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Repository</dt>
                  <dd className="mt-1 text-sm break-all">
                    <a
                      className="font-medium text-primary hover:underline"
                      href={skill.repoUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {skill.repoUrl}
                    </a>
                    {skill.repoRef ? (
                      <span className="text-muted-foreground"> @{skill.repoRef}</span>
                    ) : null}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-black/5 sm:col-span-2">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">sha256</dt>
                  <dd className="mt-1 font-mono text-xs break-all text-muted-foreground">{skill.sha256}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">Short: {shortSha(skill.sha256)}</dd>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-black/5">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tags</dt>
                  <dd className="mt-1 text-sm font-medium">{skill.tags.length}</dd>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-black/5">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sources</dt>
                  <dd className="mt-1 text-sm font-medium">{fileCount}</dd>
                </div>
              </dl>
            </SoftPanel>
          </div>
        }
        sources={<SkillFilesPanel skillContent={skill.content} siblings={skill.siblings} />}
        tags={
          <div className="grid gap-4 lg:grid-cols-2">
            <SoftPanel tone="card">
              <h2 className="mb-1 font-heading text-xl font-bold tracking-tight">Current tags</h2>
              <p className="mb-5 text-sm text-muted-foreground">Manage catalog tags attached to this skill.</p>
              <div className="grid gap-4">
                {skill.tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tags yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {skill.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 rounded-full pr-0.5">
                        <Link href={`/tags/${tag}`}>{tag}</Link>
                        <form action={removeTagAction} className="inline">
                          <input type="hidden" name="sha256" value={skill.sha256} />
                          <input type="hidden" name="tag" value={tag} />
                          <Button type="submit" variant="ghost" size="icon-xs" aria-label={`Remove tag ${tag}`}>
                            <X />
                          </Button>
                        </form>
                      </Badge>
                    ))}
                  </div>
                )}
                <form action={addTagsAction} className="grid gap-2">
                  <input type="hidden" name="sha256" value={skill.sha256} />
                  <Label htmlFor="tags">Add tags</Label>
                  <Input
                    id="tags"
                    name="tags"
                    placeholder="quality engineering/code-review"
                    className="rounded-full"
                  />
                  <SubmitButton className="rounded-full">
                    <Plus />
                    Add
                  </SubmitButton>
                </form>
              </div>
            </SoftPanel>

            <SoftPanel tone="mist">
              <h2 className="mb-1 font-heading text-xl font-bold tracking-tight">Recommended tags</h2>
              <p className="mb-5 text-sm text-muted-foreground">Suggested from the catalog and skill content.</p>
              {!recommendations || recommendations.recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recommendations.</p>
              ) : (
                <ul className="grid gap-3">
                  {recommendations.recommendations.map((rec) => (
                    <li key={rec.tag} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-border">
                      <form action={applyRecommendedTagAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="sha256" value={skill.sha256} />
                        <input type="hidden" name="tag" value={rec.tag} />
                        <Badge variant="outline" className="rounded-full">
                          {rec.tag}
                        </Badge>
                        <span className="flex-1 text-xs text-muted-foreground">
                          {rec.source} · {rec.reason}
                        </span>
                        <SubmitButton variant="outline" size="sm" className="rounded-full">
                          <Check />
                          Apply
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </SoftPanel>
          </div>
        }
      />
    </SoftShell>
  );
}
