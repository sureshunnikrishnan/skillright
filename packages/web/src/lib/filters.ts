export const UNTAGGED_FILTER = '__untagged__';

export function isUntaggedFilter(tag: string): boolean {
  return tag === UNTAGGED_FILTER;
}
