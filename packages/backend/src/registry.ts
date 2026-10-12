import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { SkillExtractor, type CatalogTreeNode, type RepoConfig } from './extractor.js';
import { repoBrowseUrl } from './repo-url.js';

export interface SkillSummary {
  sha256: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  repoUrl: string;
  repoRef: string;
  /** Exact browse URL (repo root + branch), stored on skill_metadata.repo_link. */
  repoLink: string;
  sourceHost: string;
}

export interface SkillOccurrence {
  id: number;
  sourceHost: string;
  repoUrl: string;
  repoName: string;
  skillDirPath: string;
  indexedAt: string;
}

export interface SkillSibling {
  occurrenceId: number;
  relativePath: string;
  fileType: string;
  sizeBytes: number;
  content: string | null;
}

export interface SkillDetail extends SkillSummary {
  content: string;
  rawYaml: string | null;
  occurrences: SkillOccurrence[];
  siblings: SkillSibling[];
}

export interface RepoSummary {
  repoUrl: string;
  repoName: string;
  sourceHost: string;
  skillCount: number;
}

export interface RegistryStats {
  skills: number;
  occurrences: number;
  repos: number;
  catalogNodes: number;
}

interface MetadataRow {
  sha256: string;
  skill_name: string | null;
  description: string | null;
  version: string | null;
  author: string | null;
  source_host: string;
  repo_url: string;
  repo_ref: string;
  repo_link: string | null;
  tags_json: string | null;
}

function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export function normalizeTagPath(raw: string): string {
  return raw
    .replace(/:/g, '/')
    .toLowerCase()
    .split('/')
    .map((segment) => segment.trim().replace(/\s+/g, '-'))
    .filter(Boolean)
    .join('/');
}

function collectNormalizedTags(rawTags: string[]): { tags: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const tags: string[] = [];
  const invalid: string[] = [];
  for (const raw of rawTags) {
    const tag = normalizeTagPath(raw);
    if (!tag) {
      invalid.push(raw);
      continue;
    }
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return { tags, invalid };
}

function toSummary(row: MetadataRow): SkillSummary {
  const repoUrl = row.repo_url ?? '';
  const repoRef = row.repo_ref ?? '';
  const sourceHost = row.source_host ?? '';
  return {
    sha256: row.sha256,
    name: row.skill_name ?? '',
    description: row.description ?? '',
    version: row.version ?? '',
    author: row.author ?? '',
    tags: parseTags(row.tags_json),
    repoUrl,
    repoRef,
    repoLink: row.repo_link?.trim() || repoBrowseUrl(repoUrl, sourceHost, repoRef),
    sourceHost,
  };
}

const METADATA_SELECT = `
  SELECT
    c.sha256,
    COALESCE(m.skill_name, '') as skill_name,
    COALESCE(m.description, '') as description,
    COALESCE(m.version, '') as version,
    COALESCE(m.author, '') as author,
    COALESCE(o.source_host, m.source_host, '') as source_host,
    COALESCE(o.repo_url, m.repo_url, '') as repo_url,
    COALESCE(m.repo_ref, '') as repo_ref,
    COALESCE(m.repo_link, '') as repo_link,
    m.tags_json
  FROM skill_contents c
  LEFT JOIN skill_metadata m ON m.sha256 = c.sha256
  LEFT JOIN (
    SELECT sha256, source_host, repo_url
    FROM skill_occurrences
    WHERE id IN (SELECT MIN(id) FROM skill_occurrences GROUP BY sha256)
  ) o ON o.sha256 = c.sha256
`;

export function listSkills(
  db: Database.Database,
  filters: { tag?: string; repo?: string; author?: string; ref?: string } = {},
): SkillSummary[] {
  const clauses: string[] = [];
  const params: string[] = [];

  if (filters.tag) {
    clauses.push(`EXISTS (
      SELECT 1 FROM skill_catalog_mapping map
      JOIN catalog_nodes n ON n.id = map.catalog_node_id
      WHERE map.sha256 = c.sha256
        AND (n.full_path = ? OR n.full_path LIKE ?)
    )`);
    params.push(filters.tag.toLowerCase(), `${filters.tag.toLowerCase()}/%`);
  }

  if (filters.repo) {
    clauses.push(`(
      COALESCE(o.repo_url, m.repo_url, '') = ?
      OR COALESCE(o.repo_url, m.repo_url, '') LIKE ?
      OR EXISTS (
        SELECT 1 FROM skill_occurrences occ
        WHERE occ.sha256 = c.sha256
          AND (occ.repo_url = ? OR occ.repo_url LIKE ? OR occ.repo_name LIKE ?)
      )
    )`);
    params.push(filters.repo, `%${filters.repo}%`, filters.repo, `%${filters.repo}%`, `%${filters.repo}%`);
  }

  if (filters.author) {
    clauses.push(`COALESCE(m.author, '') LIKE ? COLLATE NOCASE`);
    params.push(`%${filters.author}%`);
  }

  if (filters.ref) {
    clauses.push(`COALESCE(m.repo_ref, '') LIKE ? COLLATE NOCASE`);
    params.push(`%${filters.ref}%`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`${METADATA_SELECT} ${where} ORDER BY skill_name, c.sha256`).all(...params) as MetadataRow[];
  return rows.map(toSummary);
}

export function searchSkills(db: Database.Database, query: string, limit = 20): SkillSummary[] {
  const like = `%${query}%`;
  const rows = db.prepare(`
    ${METADATA_SELECT}
    WHERE COALESCE(m.skill_name, '') LIKE ? COLLATE NOCASE
       OR COALESCE(m.description, '') LIKE ? COLLATE NOCASE
       OR COALESCE(m.author, '') LIKE ? COLLATE NOCASE
       OR COALESCE(m.repo_ref, '') LIKE ? COLLATE NOCASE
       OR COALESCE(m.tags_json, '') LIKE ? COLLATE NOCASE
       OR c.raw_content LIKE ? COLLATE NOCASE
    ORDER BY
      CASE WHEN COALESCE(m.skill_name, '') LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END,
      skill_name,
      c.sha256
    LIMIT ?
  `).all(like, like, like, like, like, like, like, limit) as MetadataRow[];
  return rows.map(toSummary);
}

export function resolveSkills(db: Database.Database, id: string): SkillSummary[] {
  const trimmed = id.trim();
  if (/^[0-9a-f]{7,64}$/i.test(trimmed)) {
    const rows = db.prepare(`${METADATA_SELECT} WHERE c.sha256 LIKE ? ORDER BY c.sha256`).all(`${trimmed.toLowerCase()}%`) as MetadataRow[];
    if (rows.length > 0) return rows.map(toSummary);
  }

  const exact = db.prepare(`${METADATA_SELECT} WHERE COALESCE(m.skill_name, '') = ? COLLATE NOCASE ORDER BY c.sha256`).all(trimmed) as MetadataRow[];
  if (exact.length > 0) return exact.map(toSummary);

  return (db.prepare(`${METADATA_SELECT} WHERE COALESCE(m.skill_name, '') LIKE ? COLLATE NOCASE ORDER BY skill_name, c.sha256`).all(`%${trimmed}%`) as MetadataRow[]).map(toSummary);
}

export function getSkill(db: Database.Database, sha256: string): SkillDetail | null {
  const meta = db.prepare(`
    SELECT sha256, skill_name, description, version, author, source_host, repo_url, repo_ref, repo_link, tags_json, raw_yaml
    FROM skill_metadata
    WHERE sha256 = ?
  `).get(sha256) as (MetadataRow & { raw_yaml: string | null }) | undefined;
  const contentRow = db.prepare(`SELECT raw_content FROM skill_contents WHERE sha256 = ?`).get(sha256) as { raw_content: string } | undefined;
  if (!contentRow) return null;

  const occurrences = db.prepare(`
    SELECT id, source_host as sourceHost, repo_url as repoUrl, repo_name as repoName,
           skill_dir_path as skillDirPath, indexed_at as indexedAt
    FROM skill_occurrences
    WHERE sha256 = ?
    ORDER BY indexed_at
  `).all(sha256) as SkillOccurrence[];

  const siblings = db.prepare(`
    SELECT occurrence_id as occurrenceId, sibling_relative_path as relativePath,
           file_type as fileType, size_bytes as sizeBytes, content
    FROM skill_siblings
    WHERE occurrence_id IN (SELECT id FROM skill_occurrences WHERE sha256 = ?)
    ORDER BY occurrence_id, sibling_relative_path
  `).all(sha256) as SkillSibling[];

  const primary = occurrences[0];
  const summary = meta
    ? {
        ...toSummary(meta),
        // Occurrences are authoritative for repo root; keep stored exact browse link from metadata.
        ...(primary
          ? { repoUrl: primary.repoUrl, sourceHost: primary.sourceHost }
          : {}),
      }
    : {
        sha256,
        name: '',
        description: '',
        version: '',
        author: '',
        tags: [],
        repoUrl: primary?.repoUrl ?? '',
        repoRef: '',
        repoLink: primary?.repoUrl ?? '',
        sourceHost: primary?.sourceHost ?? '',
      };

  return {
    ...summary,
    content: contentRow.raw_content,
    rawYaml: meta?.raw_yaml ?? null,
    occurrences,
    siblings,
  };
}

export function listRepos(db: Database.Database): RepoSummary[] {
  return db.prepare(`
    SELECT repo_url as repoUrl, repo_name as repoName, source_host as sourceHost,
           COUNT(DISTINCT sha256) as skillCount
    FROM skill_occurrences
    GROUP BY repo_url, repo_name, source_host
    ORDER BY repo_name
  `).all() as RepoSummary[];
}

export function getStats(db: Database.Database): RegistryStats {
  const skills = (db.prepare(`SELECT COUNT(*) as n FROM skill_contents`).get() as { n: number }).n;
  const occurrences = (db.prepare(`SELECT COUNT(*) as n FROM skill_occurrences`).get() as { n: number }).n;
  const repos = (db.prepare(`SELECT COUNT(DISTINCT repo_url) as n FROM skill_occurrences`).get() as { n: number }).n;
  const catalogNodes = (db.prepare(`SELECT COUNT(*) as n FROM catalog_nodes`).get() as { n: number }).n;
  return { skills, occurrences, repos, catalogNodes };
}

export function getCatalogTree(db: Database.Database): CatalogTreeNode[] {
  return new SkillExtractor(db).getCatalogTree();
}

export async function indexRepository(db: Database.Database, repoConfig: RepoConfig): Promise<void> {
  await new SkillExtractor(db).processRepository(repoConfig);
}

function pruneOrphanCatalogNodes(db: Database.Database): void {
  const pruneOrphans = db.prepare(`
    DELETE FROM catalog_nodes
    WHERE id NOT IN (SELECT DISTINCT catalog_node_id FROM skill_catalog_mapping)
      AND id NOT IN (SELECT DISTINCT parent_id FROM catalog_nodes WHERE parent_id IS NOT NULL)
  `);
  while (pruneOrphans.run().changes > 0) {
    // walk from leaves to roots
  }
}

function deleteSkillRows(db: Database.Database, sha256: string): void {
  db.prepare(`DELETE FROM skill_catalog_mapping WHERE sha256 = ?`).run(sha256);
  db.prepare(`DELETE FROM skill_metadata WHERE sha256 = ?`).run(sha256);
  db.prepare(`DELETE FROM skill_contents WHERE sha256 = ?`).run(sha256);
}

export function removeSkill(db: Database.Database, sha256: string): boolean {
  const exists = db.prepare(`SELECT 1 FROM skill_contents WHERE sha256 = ?`).get(sha256);
  if (!exists) return false;

  const tx = db.transaction(() => {
    const occIds = (db.prepare(`SELECT id FROM skill_occurrences WHERE sha256 = ?`).all(sha256) as { id: number }[])
      .map((row) => row.id);

    for (const id of occIds) {
      db.prepare(`DELETE FROM skill_siblings WHERE occurrence_id = ?`).run(id);
    }

    db.prepare(`DELETE FROM skill_occurrences WHERE sha256 = ?`).run(sha256);
    deleteSkillRows(db, sha256);
    pruneOrphanCatalogNodes(db);
  });

  tx();
  return true;
}

function normalizeRepoRef(value: string): string {
  return value.trim().replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase();
}

export function resolveRepos(db: Database.Database, query: string): RepoSummary[] {
  const repos = listRepos(db);
  const needle = normalizeRepoRef(query);
  if (!needle) return [];

  const exactUrl = repos.filter((r) => normalizeRepoRef(r.repoUrl) === needle);
  if (exactUrl.length > 0) return exactUrl;

  const exactName = repos.filter((r) => r.repoName.toLowerCase() === needle);
  if (exactName.length > 0) return exactName;

  return repos.filter(
    (r) => normalizeRepoRef(r.repoUrl).includes(needle) || r.repoName.toLowerCase().includes(needle),
  );
}

export interface RemoveRepoResult {
  repoUrl: string;
  repoName: string;
  removedOccurrences: number;
  deletedSkills: SkillSummary[];
  keptSkills: SkillSummary[];
}

export function removeRepository(db: Database.Database, repoUrl: string): RemoveRepoResult | null {
  const repo = listRepos(db).find((r) => r.repoUrl === repoUrl);
  if (!repo) return null;

  const occurrences = db.prepare(`
    SELECT id, sha256 FROM skill_occurrences WHERE repo_url = ?
  `).all(repoUrl) as { id: number; sha256: string }[];

  const sha256s = [...new Set(occurrences.map((row) => row.sha256))];
  const summaries = new Map(
    sha256s.map((sha) => {
      const detail = getSkill(db, sha);
      const summary: SkillSummary = detail
        ? {
            sha256: detail.sha256,
            name: detail.name,
            description: detail.description,
            version: detail.version,
            author: detail.author,
            tags: detail.tags,
            repoUrl: detail.repoUrl,
            repoRef: detail.repoRef,
            repoLink: detail.repoLink,
            sourceHost: detail.sourceHost,
          }
        : {
            sha256: sha,
            name: '',
            description: '',
            version: '',
            author: '',
            tags: [],
            repoUrl,
            repoRef: '',
            repoLink: repoUrl,
            sourceHost: repo.sourceHost,
          };
      return [sha, summary] as const;
    }),
  );

  const deletedSkills: SkillSummary[] = [];
  const keptSkills: SkillSummary[] = [];

  const tx = db.transaction(() => {
    for (const occ of occurrences) {
      db.prepare(`DELETE FROM skill_siblings WHERE occurrence_id = ?`).run(occ.id);
    }
    db.prepare(`DELETE FROM skill_occurrences WHERE repo_url = ?`).run(repoUrl);

    for (const sha256 of sha256s) {
      const remaining = db.prepare(`
        SELECT source_host as sourceHost, repo_url as repoUrl
        FROM skill_occurrences
        WHERE sha256 = ?
        ORDER BY indexed_at
        LIMIT 1
      `).get(sha256) as { sourceHost: string; repoUrl: string } | undefined;

      const summary = summaries.get(sha256)!;
      if (!remaining) {
        deleteSkillRows(db, sha256);
        deletedSkills.push(summary);
      } else {
        db.prepare(`
          UPDATE skill_metadata
          SET source_host = ?, repo_url = ?, repo_ref = '', repo_link = ?
          WHERE sha256 = ? AND repo_url = ?
        `).run(remaining.sourceHost, remaining.repoUrl, remaining.repoUrl, sha256, repoUrl);
        keptSkills.push(summary);
      }
    }

    pruneOrphanCatalogNodes(db);
  });

  tx();

  return {
    repoUrl: repo.repoUrl,
    repoName: repo.repoName,
    removedOccurrences: occurrences.length,
    deletedSkills,
    keptSkills,
  };
}

function expandUserPath(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

/** Directory name used when installing a skill under a skills root folder. */
export function skillPackageDirName(skill: { name: string; sha256: string }): string {
  const raw = skill.name.trim() || skill.sha256.slice(0, 12);
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || skill.sha256.slice(0, 12);
}

export function exportSkill(db: Database.Database, sha256: string, destDir: string): string {
  const skill = getSkill(db, sha256);
  if (!skill) {
    throw new Error(`Skill not found: ${sha256}`);
  }

  const target = path.resolve(expandUserPath(destDir));
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'SKILL.md'), skill.content, 'utf8');

  const occurrenceId = skill.occurrences[0]?.id;
  const siblings = occurrenceId === undefined
    ? []
    : skill.siblings.filter((s) => s.occurrenceId === occurrenceId);

  for (const sibling of siblings) {
    const destPath = path.join(target, sibling.relativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (sibling.content !== null) {
      fs.writeFileSync(destPath, sibling.content, 'utf8');
    } else {
      fs.writeFileSync(destPath, '');
    }
  }

  return target;
}

/**
 * Install a skill package under a skills root directory (e.g. project
 * `.cursor/skills` or global `~/.cursor/skills`). Writes to
 * `<skillsDir>/<skill-name>/`.
 */
export function installSkill(db: Database.Database, sha256: string, skillsDir: string): string {
  const skill = getSkill(db, sha256);
  if (!skill) {
    throw new Error(`Skill not found: ${sha256}`);
  }
  if (!skillsDir.trim()) {
    throw new Error('A destination folder path is required.');
  }

  const packageDir = path.join(expandUserPath(skillsDir), skillPackageDirName(skill));
  return exportSkill(db, sha256, packageDir);
}

export interface SkillTagsResult {
  sha256: string;
  name: string;
  tags: string[];
  added: string[];
  removed: string[];
  skipped: string[];
}

function ensureSkillMetadata(db: Database.Database, sha256: string): MetadataRow {
  const existing = db.prepare(`
    SELECT sha256, skill_name, description, version, author, source_host, repo_url, repo_ref, repo_link, tags_json
    FROM skill_metadata
    WHERE sha256 = ?
  `).get(sha256) as MetadataRow | undefined;
  if (existing) return existing;

  const origin = db.prepare(`
    SELECT source_host, repo_url
    FROM skill_occurrences
    WHERE sha256 = ?
    ORDER BY indexed_at
    LIMIT 1
  `).get(sha256) as { source_host: string; repo_url: string } | undefined;

  const repoUrl = origin?.repo_url ?? '';
  const sourceHost = origin?.source_host ?? '';
  const repoLink = repoUrl ? repoBrowseUrl(repoUrl, sourceHost) : '';

  db.prepare(`
    INSERT INTO skill_metadata
      (sha256, skill_name, description, version, author, source_host, repo_url, repo_ref, repo_link, tags_json, raw_yaml)
    VALUES (?, '', '', '', '', ?, ?, '', ?, '[]', NULL)
  `).run(sha256, sourceHost, repoUrl, repoLink);

  return {
    sha256,
    skill_name: '',
    description: '',
    version: '',
    author: '',
    source_host: sourceHost,
    repo_url: repoUrl,
    repo_ref: '',
    repo_link: repoLink,
    tags_json: '[]',
  };
}

function ensureCatalogLeaf(db: Database.Database, tag: string): number | null {
  const segments = tag.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  let currentParentId: number | null = null;
  let currentPath = '';

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const node = db.prepare(`SELECT id FROM catalog_nodes WHERE full_path = ?`).get(currentPath) as
      | { id: number }
      | undefined;

    if (!node) {
      const result = db.prepare(`
        INSERT INTO catalog_nodes (parent_id, name, full_path)
        VALUES (?, ?, ?)
      `).run(currentParentId, segment, currentPath);
      currentParentId = result.lastInsertRowid as number;
    } else {
      currentParentId = node.id;
    }
  }

  return currentParentId;
}

function writeSkillTags(db: Database.Database, sha256: string, tags: string[]): void {
  db.prepare(`UPDATE skill_metadata SET tags_json = ? WHERE sha256 = ?`).run(JSON.stringify(tags), sha256);
}

function mapSkillToTag(db: Database.Database, sha256: string, tag: string): void {
  const nodeId = ensureCatalogLeaf(db, tag);
  if (nodeId === null) return;
  db.prepare(`
    INSERT OR IGNORE INTO skill_catalog_mapping (sha256, catalog_node_id)
    VALUES (?, ?)
  `).run(sha256, nodeId);
}

function unmapSkillFromTag(db: Database.Database, sha256: string, tag: string): void {
  const node = db.prepare(`SELECT id FROM catalog_nodes WHERE full_path = ?`).get(tag) as { id: number } | undefined;
  if (!node) return;
  db.prepare(`
    DELETE FROM skill_catalog_mapping
    WHERE sha256 = ? AND catalog_node_id = ?
  `).run(sha256, node.id);
}

function skillExists(db: Database.Database, sha256: string): boolean {
  return Boolean(db.prepare(`SELECT 1 FROM skill_contents WHERE sha256 = ?`).get(sha256));
}

export function addSkillTags(db: Database.Database, sha256: string, rawTags: string[]): SkillTagsResult {
  if (!skillExists(db, sha256)) {
    throw new Error(`Skill not found: ${sha256}`);
  }

  const { tags: requested, invalid } = collectNormalizedTags(rawTags);
  if (requested.length === 0) {
    throw new Error(invalid.length > 0 ? 'No valid tags provided.' : 'At least one tag is required.');
  }

  let result!: SkillTagsResult;
  const tx = db.transaction(() => {
    const meta = ensureSkillMetadata(db, sha256);
    const current = parseTags(meta.tags_json);
    const currentNormalized = new Set(current.map(normalizeTagPath).filter(Boolean));
    const added: string[] = [];
    const skipped: string[] = [];

    for (const tag of requested) {
      if (currentNormalized.has(tag)) {
        skipped.push(tag);
        continue;
      }
      current.push(tag);
      currentNormalized.add(tag);
      mapSkillToTag(db, sha256, tag);
      added.push(tag);
    }

    writeSkillTags(db, sha256, current);
    result = {
      sha256,
      name: meta.skill_name ?? '',
      tags: current,
      added,
      removed: [],
      skipped,
    };
  });
  tx();
  return result;
}

export function removeSkillTags(db: Database.Database, sha256: string, rawTags: string[]): SkillTagsResult {
  if (!skillExists(db, sha256)) {
    throw new Error(`Skill not found: ${sha256}`);
  }

  const { tags: requested, invalid } = collectNormalizedTags(rawTags);
  if (requested.length === 0) {
    throw new Error(invalid.length > 0 ? 'No valid tags provided.' : 'At least one tag is required.');
  }

  const requestedSet = new Set(requested);
  let result!: SkillTagsResult;
  const tx = db.transaction(() => {
    const meta = ensureSkillMetadata(db, sha256);
    const current = parseTags(meta.tags_json);
    const kept: string[] = [];
    const removed: string[] = [];
    const present = new Set<string>();

    for (const tag of current) {
      const normalized = normalizeTagPath(tag);
      if (normalized && requestedSet.has(normalized)) {
        if (!present.has(normalized)) {
          unmapSkillFromTag(db, sha256, normalized);
          removed.push(normalized);
          present.add(normalized);
        }
        continue;
      }
      kept.push(tag);
    }

    const skipped = requested.filter((tag) => !present.has(tag));
    writeSkillTags(db, sha256, kept);
    pruneOrphanCatalogNodes(db);
    result = {
      sha256,
      name: meta.skill_name ?? '',
      tags: kept,
      added: [],
      removed,
      skipped,
    };
  });
  tx();
  return result;
}
