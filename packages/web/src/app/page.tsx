import { getCatalogTree, getStats, listRepos, listSkills } from '@skillright/backend';
import type { Metadata } from 'next';
import { DashboardHome } from '@/components/DashboardHome';
import { withDb } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function DashboardPage() {
  const { stats, skills, repos, catalog } = withDb((db) => ({
    stats: getStats(db),
    skills: listSkills(db),
    repos: listRepos(db),
    catalog: getCatalogTree(db),
  }));

  return <DashboardHome stats={stats} skills={skills} repos={repos} catalog={catalog} />;
}
