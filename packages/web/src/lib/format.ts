import { repoBrowseUrl } from '@skillright/backend';

export { repoBrowseUrl };

export function skillLabel(skill: { name: string; sha256: string }): string {
  return skill.name || skill.sha256.slice(0, 12);
}

export function shortSha(sha256: string): string {
  return sha256.slice(0, 12);
}

export function hostLabel(sourceHost: string): string {
  if (sourceHost.toLowerCase().includes('bitbucket')) return 'Bitbucket';
  if (sourceHost.toLowerCase().includes('github')) return 'GitHub';
  return sourceHost || 'Unknown';
}

/** Prefer the stored exact link; fall back to building one from root + ref. */
export function skillRepoLink(skill: {
  repoLink?: string;
  repoUrl: string;
  sourceHost: string;
  repoRef?: string;
}): string {
  if (skill.repoLink?.trim()) return skill.repoLink.trim();
  return repoBrowseUrl(skill.repoUrl, skill.sourceHost, skill.repoRef);
}
