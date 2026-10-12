export const SKILL_DETAIL_TABS = ['overview', 'sources', 'tags'] as const;
export type SkillDetailTab = (typeof SKILL_DETAIL_TABS)[number];

const LEGACY_TAB_MAP: Record<string, SkillDetailTab> = {
  content: 'sources',
  files: 'sources',
  siblings: 'sources',
};

export function isSkillDetailTab(value: string | undefined): value is SkillDetailTab {
  return SKILL_DETAIL_TABS.includes(value as SkillDetailTab);
}

export function resolveSkillDetailTab(value: string | undefined): SkillDetailTab {
  if (!value) return 'overview';
  if (isSkillDetailTab(value)) return value;
  return LEGACY_TAB_MAP[value] ?? 'overview';
}
