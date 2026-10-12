const TONES = [
  'bg-blue-50 text-blue-700 ring-blue-200',
  'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'bg-orange-50 text-orange-700 ring-orange-200',
  'bg-cyan-50 text-cyan-700 ring-cyan-200',
  'bg-amber-50 text-amber-700 ring-amber-200',
  'bg-rose-50 text-rose-700 ring-rose-200',
  'bg-violet-50 text-violet-700 ring-violet-200',
  'bg-teal-50 text-teal-700 ring-teal-200',
] as const;

export function primaryCategory(tags: string[]): string {
  const first = tags[0]?.trim();
  if (!first) return 'Untagged';
  return first.split('/')[0] || first;
}

export function categoryTone(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  return TONES[hash % TONES.length]!;
}

export function formatTagLabel(tag: string): string {
  const leaf = tag.split('/').filter(Boolean).at(-1) ?? tag;
  return leaf
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
