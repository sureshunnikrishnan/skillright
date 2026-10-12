import { listRepos } from '@skillright/backend';
import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { RepoCard } from '@/components/RepoCard';
import { SoftEmpty, SoftPanel, SoftShell } from '@/components/SoftShell';
import { SubmitButton } from '@/components/SubmitButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { indexRepoAction } from '@/lib/actions';
import { withDb } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Repos',
};

export default async function ReposPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const repos = withDb((db) => listRepos(db));
  const skillTotal = repos.reduce((sum, repo) => sum + repo.skillCount, 0);

  return (
    <SoftShell>
      <PageHeader
        title="Browse Repositories"
        description={
          repos.length === 0
            ? 'Index GitHub or Bitbucket repos and remove them from the local catalog.'
            : `${repos.length} indexed repo${repos.length === 1 ? '' : 's'} · ${skillTotal} skill${skillTotal === 1 ? '' : 's'}.`
        }
      />
      <Flash notice={params.notice} error={params.error} />

      <SoftPanel tone="lavender" className="mb-8">
        <p className="mb-5 text-sm text-violet-900/70">
          Extracts all skills in the given repo and add into the skill registry
        </p>
        <form action={indexRepoAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-1.5 sm:col-span-2 xl:col-span-2">
            <Label htmlFor="repoUrl">Repository URL (GitHub or Bitbucket workspace root)</Label>
            <Input
              id="repoUrl"
              name="repoUrl"
              required
              placeholder="https://bitbucket.org/workspace/repo"
              className="rounded-full bg-white/80"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ref">Branch name (slashes allowed)</Label>
            <Input
              id="ref"
              name="ref"
              placeholder="main or feature/login"
              className="rounded-full bg-white/80"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="token">Auth Token (required for Bitbucket)</Label>
            <Input
              id="token"
              name="token"
              type="password"
              autoComplete="off"
              className="rounded-full bg-white/80"
            />
          </div>
          <div className="flex items-end sm:col-span-2 xl:col-span-4">
            <SubmitButton pendingLabel="Indexing…" className="rounded-full">
              <Download />
              Index
            </SubmitButton>
          </div>
        </form>
      </SoftPanel>

      {repos.length === 0 ? (
        <SoftEmpty>No repositories yet. Index one above to get started.</SoftEmpty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {repos.map((repo) => (
            <RepoCard key={repo.repoUrl} repo={repo} />
          ))}
        </div>
      )}
    </SoftShell>
  );
}
