import {
  getCatalogTree,
  getProjectContext,
  listSkills,
  searchSkills,
  skillInstallStatus,
} from '@skillright/backend';
import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import { CategoryFilters } from '@/components/CategoryFilters';
import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { SkillCard } from '@/components/SkillCard';
import { SoftEmpty, SoftPanel, SoftShell } from '@/components/SoftShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { withDb } from '@/lib/db';
import { isUntaggedFilter } from '@/lib/filters';

export const metadata: Metadata = {
  title: 'Skill',
};

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    repo?: string;
    author?: string;
    ref?: string;
    notice?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const tag = params.tag?.trim() ?? '';
  const repo = params.repo?.trim() ?? '';
  const author = params.author?.trim() ?? '';
  const ref = params.ref?.trim() ?? '';
  const untaggedOnly = isUntaggedFilter(tag);

  const { skills, categories, project } = withDb((db) => {
    let listed;
    if (q) {
      listed = searchSkills(db, q, 100);
      if (untaggedOnly) {
        listed = listed.filter((skill) => skill.tags.length === 0);
      } else if (tag) {
        listed = listed.filter((skill) =>
          skill.tags.some((skillTag) => skillTag === tag || skillTag.startsWith(`${tag}/`)),
        );
      }
      if (repo) {
        const needle = repo.toLowerCase();
        listed = listed.filter((skill) => skill.repoUrl.toLowerCase().includes(needle));
      }
      if (author) {
        const needle = author.toLowerCase();
        listed = listed.filter((skill) => skill.author.toLowerCase().includes(needle));
      }
      if (ref) {
        const needle = ref.toLowerCase();
        listed = listed.filter((skill) => skill.repoRef.toLowerCase().includes(needle));
      }
    } else if (untaggedOnly) {
      const filters: { repo?: string; author?: string; ref?: string } = {};
      if (repo) filters.repo = repo;
      if (author) filters.author = author;
      if (ref) filters.ref = ref;
      listed = listSkills(db, filters).filter((skill) => skill.tags.length === 0);
    } else {
      const filters: { tag?: string; repo?: string; author?: string; ref?: string } = {};
      if (tag) filters.tag = tag;
      if (repo) filters.repo = repo;
      if (author) filters.author = author;
      if (ref) filters.ref = ref;
      listed = listSkills(db, filters);
    }

    const roots = getCatalogTree(db).map((node) => node.name);
    return { skills: listed, categories: roots, project: getProjectContext(db) };
  });

  const showInstallStatus = Boolean(project.projectDir);
  const installedInView = showInstallStatus
    ? skills.filter((skill) => skillInstallStatus(skill, project.localSkills) !== 'missing').length
    : 0;

  return (
    <SoftShell>
      <PageHeader
        title="Browse Skills"
        description={`Explore ${skills.length} indexed skill${skills.length === 1 ? '' : 's'}${
          categories.length > 0 ? ` across ${categories.length} top-level tag${categories.length === 1 ? '' : 's'}` : ''
        }${
          showInstallStatus
            ? ` · ${installedInView} installed in ${project.projectName}`
            : ''
        }.`}
      />
      <Flash notice={params.notice} error={params.error} />

      <SoftPanel tone="lavender" className="mb-6">
        <form method="get" action="/skills">
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          {repo ? <input type="hidden" name="repo" value={repo} /> : null}
          {author ? <input type="hidden" name="author" value={author} /> : null}
          {ref ? <input type="hidden" name="ref" value={ref} /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Search name, description, author, branch, tags, or content"
              className="h-12 rounded-full border-violet-200/80 bg-white/80 pr-28 pl-10 shadow-sm"
            />
            <Button type="submit" size="sm" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full">
              <Search />
              Search
            </Button>
          </div>
        </form>
      </SoftPanel>

      <div className="mb-6">
        <CategoryFilters
          categories={categories}
          {...(tag ? { active: tag } : {})}
          {...(q ? { query: q } : {})}
          {...(repo ? { repo } : {})}
          {...(author ? { author } : {})}
          {...(ref ? { ref } : {})}
        />
      </div>

      {skills.length === 0 ? (
        <SoftEmpty>
          {untaggedOnly
            ? 'No untagged skills. Every indexed skill has at least one tag.'
            : 'No skills matched. Index a repository from Repos, or clear filters.'}
        </SoftEmpty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {skills.map((skill) => (
              <SkillCard
                key={skill.sha256}
                skill={skill}
                {...(showInstallStatus
                  ? { installStatus: skillInstallStatus(skill, project.localSkills) }
                  : {})}
              />
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{skills.length} skill(s)</p>
        </>
      )}
    </SoftShell>
  );
}
