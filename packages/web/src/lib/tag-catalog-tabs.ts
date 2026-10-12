export const TAG_CATALOG_TABS = ['hierarchy', 'cards'] as const;
export type TagCatalogTab = (typeof TAG_CATALOG_TABS)[number];

export function isTagCatalogTab(value: string | undefined): value is TagCatalogTab {
  return TAG_CATALOG_TABS.includes(value as TagCatalogTab);
}
