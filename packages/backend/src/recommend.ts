import Database from 'better-sqlite3';
import { getSkill, listSkills, normalizeTagPath, type SkillDetail, type SkillSummary } from './registry.js';

export type TagSource = 'existing' | 'new';

export interface TagRecommendation {
  tag: string;
  source: TagSource;
  score: number;
  reason: string;
}

export interface SkillTagRecommendations {
  sha256: string;
  name: string;
  description: string;
  currentTags: string[];
  recommendations: TagRecommendation[];
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'your', 'you',
  'use', 'used', 'using', 'when', 'what', 'how', 'why', 'are', 'was', 'were',
  'been', 'being', 'have', 'has', 'had', 'not', 'but', 'or', 'nor', 'yet',
  'can', 'will', 'may', 'should', 'must', 'than', 'then', 'also', 'such',
  'skill', 'skills', 'guide', 'guides', 'task', 'tasks', 'user', 'users',
  'agent', 'agents', 'pattern', 'patterns', 'best', 'practice', 'practices',
  'including', 'includes', 'include', 'about', 'over', 'under', 'between',
  'through', 'following', 'follows', 'based', 'like', 'via', 'per', 'any',
  'all', 'each', 'other', 'more', 'most', 'some', 'new', 'old', 'its', 'their',
  'them', 'they', 'our', 'out', 'off', 'own', 'just', 'only', 'very', 'too',
  'code', 'file', 'files', 'project', 'projects', 'work', 'working', 'write',
  'writing', 'read', 'reading', 'make', 'making', 'build', 'building',
  'create', 'creating', 'setup', 'setting', 'help', 'helps', 'need', 'needs',
]);

const GENERIC_DIR_SEGMENTS = new Set([
  'skills', 'skill', 'src', 'lib', 'packages', 'pkg', 'package', 'docs',
  'agents', '.agents', 'node_modules', 'dist', 'build', 'main', 'master',
]);

const GENERIC_PARTS = new Set([
  'api', 'apis', 'app', 'application', 'client', 'component', 'components',
  'data', 'function', 'functions', 'issue', 'issues', 'operation', 'operations',
  'query', 'queries', 'schema', 'server', 'test', 'testing', 'tests', 'type',
  'types', 'tool', 'tools', 'lib', 'core',
]);

const DOMAIN_HINTS: { parent: string; words: string[] }[] = [
  { parent: 'quality', words: ['vitest', 'jest', 'lint', 'eslint', 'qa'] },
  { parent: 'research', words: ['research', 'hyperresearch'] },
  { parent: 'agents', words: ['mcp', 'claude', 'codex', 'llm', 'openai'] },
  { parent: 'tooling', words: ['turbo', 'turborepo', 'monorepo'] },
  { parent: 'cloud', words: ['azure', 'aws', 'gcp', 'vercel', 'deploy', 'lambda'] },
  { parent: 'language', words: ['typescript', 'javascript', 'python'] },
  { parent: 'frontend', words: ['react', 'nextjs', 'next', 'vue', 'antd', 'css'] },
  { parent: 'backend', words: ['graphql', 'apollo', 'mongodb', 'mongoose', 'database', 'postgres', 'sql'] },
];

export function normalizeTag(raw: string): string {
  return normalizeTagPath(raw);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !/^\d+$/.test(token));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function stripFrontMatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const parts = content.split('---');
  if (parts.length < 3) return content;
  return parts.slice(2).join('---').trim();
}

export function listKnownTags(db: Database.Database): Map<string, number> {
  const counts = new Map<string, number>();

  const catalog = db.prepare(`SELECT full_path FROM catalog_nodes`).all() as { full_path: string }[];
  for (const row of catalog) {
    const tag = normalizeTag(row.full_path);
    if (tag) counts.set(tag, Math.max(counts.get(tag) ?? 0, 0));
  }

  const skills = listSkills(db);
  for (const skill of skills) {
    for (const raw of skill.tags) {
      const tag = normalizeTag(raw);
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return counts;
}

function skillTokens(skill: Pick<SkillDetail, 'name' | 'description' | 'content' | 'occurrences'>): {
  tokens: Set<string>;
  haystack: string;
  weighted: string[];
} {
  const dirNames = skill.occurrences.flatMap((occ) =>
    occ.skillDirPath.split(/[\\/]/).filter((seg) => seg && !GENERIC_DIR_SEGMENTS.has(seg.toLowerCase())),
  );
  const body = stripFrontMatter(skill.content).slice(0, 1500);
  const weighted = [
    ...tokenize(skill.name).flatMap((token) => [token, token, token]),
    ...tokenize(skill.description).flatMap((token) => [token, token]),
    ...tokenize(dirNames.join(' ')).flatMap((token) => [token, token]),
    ...tokenize(body),
  ];
  const haystack = `${skill.name} ${skill.description} ${dirNames.join(' ')} ${body}`.toLowerCase();
  return { tokens: new Set(weighted), haystack, weighted };
}

function tagParts(tag: string): string[] {
  return tag.split('/').flatMap((segment) => tokenize(segment.replace(/-/g, ' ')));
}

function scoreExistingTag(tag: string, tokens: Set<string>, haystack: string): { score: number; matched: string[] } {
  const segments = tag.split('/').filter(Boolean);
  const leaf = segments.at(-1) ?? tag;
  const parts = unique(tagParts(leaf));
  const specific = parts.filter((part) => !GENERIC_PARTS.has(part) && part.length >= 4);
  const matchedSpecific = specific.filter((part) => tokens.has(part) || haystack.includes(part));

  if (specific.length >= 2 && matchedSpecific.length < 2) return { score: 0, matched: [] };
  if (specific.length === 1 && matchedSpecific.length === 0) return { score: 0, matched: [] };
  if (specific.length === 0 && !tokens.has(leaf) && !haystack.includes(leaf.replace(/-/g, ' '))) {
    return { score: 0, matched: [] };
  }

  let score = matchedSpecific.length * 3;
  const matched: string[] = [...matchedSpecific];

  if (haystack.includes(tag.replace(/\//g, ' ')) || haystack.includes(tag.replace(/\//g, '-'))) {
    score += 6;
    matched.push(tag);
  } else if (tokens.has(leaf) || haystack.includes(leaf.replace(/-/g, ' '))) {
    score += 4;
    matched.push(leaf);
  }

  for (const parent of segments.slice(0, -1)) {
    if (tokens.has(parent) || haystack.includes(parent)) {
      score += 1;
      matched.push(parent);
    }
  }

  return { score, matched: unique(matched) };
}

function existingReason(matched: string[], similarSkill?: string, usageCount?: number): string {
  const bits: string[] = [];
  if (similarSkill) bits.push(`similar to ${similarSkill}`);
  if (matched.length > 0) bits.push(`matches ${matched.slice(0, 4).map((m) => `"${m}"`).join(', ')}`);
  if (usageCount && usageCount > 0) bits.push(`used by ${usageCount} skill(s)`);
  return bits.join('; ') || 'already in catalog';
}

function addCandidate(
  byTag: Map<string, TagRecommendation>,
  candidate: TagRecommendation,
): void {
  const current = byTag.get(candidate.tag);
  if (!current || candidate.score > current.score) {
    byTag.set(candidate.tag, candidate);
    return;
  }
  if (current.source === 'new' && candidate.source === 'existing') {
    byTag.set(candidate.tag, { ...candidate, score: Math.max(candidate.score, current.score) });
  }
}

function reusableTagsFrom(rec: TagRecommendation): string[] {
  if (rec.reason.startsWith('topic ')) return [rec.tag];
  if (rec.reason.startsWith('domain ') || rec.reason.startsWith('existing catalog domain ')) {
    return [rec.tag.split('/')[0]!];
  }
  if (rec.source === 'existing' && !rec.tag.includes('/')) return [rec.tag];
  return [];
}

function newTagCandidates(
  skill: SkillDetail,
  tokens: Set<string>,
  known: Set<string>,
): TagRecommendation[] {
  const candidates: TagRecommendation[] = [];
  const nameSlug = slugify(skill.name || '');
  const nameParts = new Set(nameSlug.split('-').filter(Boolean));
  if (nameSlug.length >= 3) {
    candidates.push({
      tag: nameSlug,
      source: known.has(nameSlug) ? 'existing' : 'new',
      score: 8,
      reason: 'from skill name',
    });
  }

  const dirSlug = unique(
    skill.occurrences.flatMap((occ) =>
      occ.skillDirPath
        .split(/[\\/]/)
        .map((seg) => slugify(seg))
        .filter((seg) => seg.length >= 3 && !GENERIC_DIR_SEGMENTS.has(seg)),
    ),
  ).at(-1);
  if (dirSlug && dirSlug !== nameSlug) {
    candidates.push({
      tag: dirSlug,
      source: known.has(dirSlug) ? 'existing' : 'new',
      score: 5,
      reason: 'from skill directory',
    });
  }

  const vocab = unique(DOMAIN_HINTS.flatMap((hint) => hint.words)).filter(
    (word) => tokens.has(word) && !nameParts.has(word) && word.length >= 4,
  );
  for (const word of vocab) {
    candidates.push({
      tag: word,
      source: known.has(word) ? 'existing' : 'new',
      score: 4,
      reason: `topic "${word}"`,
    });
  }

  const matchedParents = unique(
    DOMAIN_HINTS.filter((hint) => hint.words.some((word) => tokens.has(word))).map((hint) => hint.parent),
  );
  for (const parent of matchedParents) {
    const hint = DOMAIN_HINTS.find((item) => item.parent === parent)!;
    const nameBoost = hint.words.some((word) => nameParts.has(word)) ? 2 : 0;
    if (known.has(parent)) {
      candidates.push({
        tag: parent,
        source: 'existing',
        score: 5 + nameBoost,
        reason: `existing catalog domain ${parent}`,
      });
    }
    if (nameSlug) {
      const nested = `${parent}/${nameSlug}`;
      candidates.push({
        tag: nested,
        source: known.has(nested) ? 'existing' : 'new',
        score: 6 + nameBoost,
        reason: `domain ${parent} + skill name`,
      });
    } else if (!known.has(parent)) {
      candidates.push({
        tag: parent,
        source: 'new',
        score: 4 + nameBoost,
        reason: `domain ${parent}`,
      });
    }
  }

  return candidates;
}

function pickRecommendations(
  byTag: Map<string, TagRecommendation>,
  current: Set<string>,
  limit: number,
): TagRecommendation[] {
  const ranked = [...byTag.values()]
    .filter((rec) => !current.has(rec.tag))
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'existing' ? -1 : 1;
      return b.score - a.score || a.tag.localeCompare(b.tag);
    });

  const existing = ranked.filter((rec) => rec.source === 'existing' && rec.score >= 3);
  const fresh = ranked.filter((rec) => rec.source === 'new');
  const reservedForNew = Math.min(2, fresh.length, limit);
  const existingRoom = limit - reservedForNew;
  return [...existing.slice(0, existingRoom), ...fresh].slice(0, limit);
}

export function recommendTags(
  db: Database.Database,
  sha256: string,
  options: { limit?: number; extraKnownTags?: Iterable<string> } = {},
): SkillTagRecommendations | null {
  const skill = getSkill(db, sha256);
  if (!skill) return null;

  const limit = options.limit && options.limit > 0 ? options.limit : 5;
  const knownCounts = listKnownTags(db);
  for (const extra of options.extraKnownTags ?? []) {
    const tag = normalizeTag(extra);
    if (tag && !knownCounts.has(tag)) knownCounts.set(tag, 0);
  }
  const allSkills = listSkills(db);
  const known = new Set(knownCounts.keys());
  const current = new Set(skill.tags.map(normalizeTag).filter(Boolean));
  const { tokens, haystack } = skillTokens(skill);
  const byTag = new Map<string, TagRecommendation>();

  for (const [tag, usage] of knownCounts) {
    const { score, matched } = scoreExistingTag(tag, tokens, haystack);
    if (score < 2) continue;
    addCandidate(byTag, {
      tag,
      source: 'existing',
      score,
      reason: existingReason(matched, undefined, usage),
    });
  }

  const others = allSkills.filter((other) => other.sha256 !== skill.sha256 && other.tags.length > 0);
  for (const other of others) {
    const otherTokens = new Set([...tokenize(other.name), ...tokenize(other.description)]);
    const similarity = jaccard(tokens, otherTokens);
    if (similarity < 0.12) continue;
    for (const raw of other.tags) {
      const tag = normalizeTag(raw);
      if (!tag) continue;
      addCandidate(byTag, {
        tag,
        source: 'existing',
        score: Math.round(similarity * 10) + 3,
        reason: existingReason(tagParts(tag).filter((part) => tokens.has(part)), other.name || other.sha256.slice(0, 12)),
      });
    }
  }

  for (const candidate of newTagCandidates(skill, tokens, known)) {
    addCandidate(byTag, candidate);
  }

  return {
    sha256: skill.sha256,
    name: skill.name,
    description: skill.description,
    currentTags: skill.tags.map(normalizeTag).filter(Boolean),
    recommendations: pickRecommendations(byTag, current, limit),
  };
}

export function recommendTagsForSkills(
  db: Database.Database,
  skills: SkillSummary[],
  options: { limit?: number } = {},
): SkillTagRecommendations[] {
  const extraKnown = new Set<string>();
  const results: SkillTagRecommendations[] = [];

  for (const summary of skills) {
    const result = recommendTags(db, summary.sha256, { ...options, extraKnownTags: extraKnown });
    if (!result) continue;
    for (const rec of result.recommendations) {
      for (const tag of reusableTagsFrom(rec)) extraKnown.add(tag);
    }
    results.push(result);
  }

  return results;
}
