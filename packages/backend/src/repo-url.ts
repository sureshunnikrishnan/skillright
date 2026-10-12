function isBitbucketHost(sourceHost: string, repoUrl: string): boolean {
  return sourceHost.toLowerCase().includes('bitbucket') || repoUrl.includes('bitbucket.org');
}

/** Exact browse URL for a repo root, or a specific branch/ref when provided (GitHub + Bitbucket). */
export function repoBrowseUrl(repoUrl: string, sourceHost: string, ref?: string): string {
  const base = repoUrl.replace(/\/$/, '');
  const trimmedRef = ref?.trim();
  if (!trimmedRef) return base;

  // Keep `/` in branch names as path segments (e.g. feature/foo)
  const refPath = trimmedRef
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  if (isBitbucketHost(sourceHost, base)) {
    return `${base}/src/${refPath}`;
  }
  return `${base}/tree/${refPath}`;
}
