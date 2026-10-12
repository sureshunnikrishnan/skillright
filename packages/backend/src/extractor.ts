import crypto from 'crypto';
import path from 'path';
import axios from 'axios';
import * as fflate from 'fflate';
import { load as loadYaml } from 'js-yaml';
import Database from 'better-sqlite3';
import { extractAuthorFromSkillMd } from './author.js';
import { config as appConfig } from './config.js';
import { repoBrowseUrl } from './repo-url.js';
import { theme } from './theme.js';
import { extractVersionFromSkillMd } from './version.js';

export interface RepoConfig {
  repoUrl: string;
  ref?: string;
  authToken?: string; // Overrides env token if specified
}

interface FrontMatter {
  name?: string;
  description?: string;
  version?: string | number;
  author?: string;
  metadata?: { author?: unknown; version?: unknown; [key: string]: unknown };
  tags?: string[] | string;
}

export interface CatalogTreeNode {
  id: number;
  name: string;
  fullPath: string;
  children: CatalogTreeNode[];
  skills: { sha256: string; name: string; description: string; repoUrl: string; repoRef: string }[];
}

export class SkillExtractor {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  private detectHost(repoUrl: string): 'github' | 'bitbucket' {
    const domain = new URL(repoUrl).hostname.toLowerCase();
    if (domain.includes('bitbucket')) return 'bitbucket';
    if (domain.includes('github')) return 'github';
    throw new Error(`Unsupported host domain: ${repoUrl}`);
  }

  /** Archive APIs require the repository root only (no /tree/, /branch/, /src/, …). */
  private normalizeRepoUrl(repoUrl: string, host: 'github' | 'bitbucket'): string {
    const url = new URL(repoUrl);
    const parts = url.pathname
      .replace(/\/$/, '')
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean);

    if (parts.length < 2) {
      throw new Error(
        host === 'bitbucket'
          ? 'Bitbucket URL must be https://bitbucket.org/{workspace}/{repo} (workspace repository root).'
          : 'GitHub URL must be https://github.com/{owner}/{repo} (repository root).',
      );
    }
    if (parts.length > 2) {
      throw new Error(
        host === 'bitbucket'
          ? 'Bitbucket URL must be the workspace repository root ' +
              '(https://bitbucket.org/{workspace}/{repo}), not a branch or file browse path. ' +
              `Remove path segments after the repo name (got /${parts.slice(2).join('/')}).`
          : 'GitHub URL must be the repository root ' +
              '(https://github.com/{owner}/{repo}), not a branch or file browse path. ' +
              `Remove path segments after the repo name (got /${parts.slice(2).join('/')}).`,
      );
    }
    return `${url.origin}/${parts[0]}/${parts[1]}`;
  }

  /** Trim whitespace and ignore leading/trailing slashes; inner slashes are kept. */
  private normalizeRef(ref: string): string {
    const normalized = ref.trim().replace(/^\/+|\/+$/g, '');
    if (!normalized) {
      throw new Error('Branch/ref name is required.');
    }
    return normalized;
  }

  private buildArchiveUrl(repoUrl: string, host: 'github' | 'bitbucket', ref: string): string {
    const encodedRef = encodeURIComponent(ref);
    return host === 'github'
      ? `${repoUrl}/archive/refs/heads/${encodedRef}.zip`
      : `${repoUrl}/get/${encodedRef}.zip`;
  }

  private archiveDownloadError(
    err: unknown,
    host: 'github' | 'bitbucket',
    archiveUrl: string,
  ): Error {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401) {
        return new Error(
          host === 'bitbucket'
            ? 'Bitbucket authentication failed (401). Provide a valid token via BITBUCKET_TOKEN ' +
                'or --token / Auth Token. The token needs the read:repository:bitbucket scope ' +
                '(Bearer auth for access tokens).'
            : 'GitHub authentication failed (401). Check that GITHUB_TOKEN (or the provided token) is valid.',
        );
      }
      if (status === 404) {
        return new Error(
          host === 'bitbucket'
            ? 'Bitbucket repository or branch not found (404). Use a workspace URL ' +
                '(https://bitbucket.org/{workspace}/{repo}) and the correct branch name ' +
                `(tried ${archiveUrl}).`
            : `GitHub repository or ref not found (404) (tried ${archiveUrl}).`,
        );
      }
      if (status != null) {
        return new Error(
          `Failed to download repository archive (HTTP ${status}): ${archiveUrl}`,
        );
      }
    }
    return err instanceof Error ? err : new Error(String(err));
  }

  public async processRepository(repoConfig: RepoConfig): Promise<void> {
    const host = this.detectHost(repoConfig.repoUrl);
    const repoUrl = this.normalizeRepoUrl(repoConfig.repoUrl, host);
    const ref = this.normalizeRef(repoConfig.ref || appConfig.defaultRef);
    const archiveUrl = this.buildArchiveUrl(repoUrl, host, ref);

    // Resolve Auth Token: Override -> Env Token
    const authToken =
      repoConfig.authToken ||
      (host === 'github' ? appConfig.githubToken : appConfig.bitbucketToken);

    if (host === 'bitbucket' && !authToken) {
      throw new Error(
        'A Bitbucket token is required. Set BITBUCKET_TOKEN or pass --token / Auth Token ' +
          '(scope: read:repository:bitbucket).',
      );
    }

    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = host === 'github' ? `token ${authToken}` : `Bearer ${authToken}`;
    }

    console.log(`${theme.success('[+]')} ${theme.info('Downloading archive:')} ${theme.path(archiveUrl)}`);
    let response;
    try {
      response = await axios.get(archiveUrl, {
        headers,
        responseType: 'arraybuffer',
      });
    } catch (err: unknown) {
      throw this.archiveDownloadError(err, host, archiveUrl);
    }

    const zipBuffer = new Uint8Array(response.data);
    const unzippedFiles = fflate.unzipSync(zipBuffer);
    const filePaths = Object.keys(unzippedFiles);

    const skillFiles = filePaths.filter(
      (fp) => fp.endsWith('/SKILL.md') || fp === 'SKILL.md'
    );

    console.log(
      `  ${theme.muted('->')} ${theme.success('Found')} ${theme.info(String(skillFiles.length))} ${theme.muted('skill package(s) in')} ${theme.path(repoUrl)}`,
    );
    const repoName = new URL(repoUrl).pathname.replace(/^\//, '').replace(/\.git$/, '');

    for (const skillFile of skillFiles) {
      const rawContent = new TextDecoder('utf-8').decode(unzippedFiles[skillFile]);
      const sha256 = crypto.createHash('sha256').update(rawContent).digest('hex');
      const skillDir = path.dirname(skillFile);

      const transaction = this.db.transaction(() => {
        // 1. Store Skill Contents
        this.db.prepare(`
          INSERT OR IGNORE INTO skill_contents (sha256, raw_content, char_count, line_count, has_yaml_frontmatter)
          VALUES (?, ?, ?, ?, ?)
        `).run(sha256, rawContent, rawContent.length, rawContent.split('\n').length, rawContent.startsWith('---') ? 1 : 0);

        // 2. Record Occurrence (idempotent per sha256 + repo + skill dir)
        const existing = this.db.prepare(`
          SELECT id FROM skill_occurrences
          WHERE sha256 = ? AND repo_url = ? AND skill_dir_path = ?
        `).get(sha256, repoUrl, skillDir) as { id: number } | undefined;

        let occurrenceId: number;
        if (existing) {
          occurrenceId = existing.id;
          this.db.prepare(`DELETE FROM skill_siblings WHERE occurrence_id = ?`).run(occurrenceId);
        } else {
          const occResult = this.db.prepare(`
            INSERT INTO skill_occurrences (sha256, source_host, repo_url, repo_name, skill_dir_path)
            VALUES (?, ?, ?, ?, ?)
          `).run(sha256, host, repoUrl, repoName, skillDir);
          occurrenceId = occResult.lastInsertRowid as number;
        }

        // 3. Parse Metadata & Store Repository Reference Metadata
        this.parseAndBuildCatalog(sha256, rawContent, host, repoUrl, ref);

        // 4. Extract Sibling Files
        this.extractSiblings(unzippedFiles, filePaths, skillDir, occurrenceId);
      });

      transaction();
    }
  }

  private parseAndBuildCatalog(
    sha256: string,
    content: string,
    sourceHost: string,
    repoUrl: string,
    repoRef: string
  ): void {
    let parsed: FrontMatter | null = null;
    let rawYaml: string | null = null;
    const rawTags: string[] = [];

    if (content.startsWith('---')) {
      try {
        const parts = content.split('---');
        if (parts.length >= 3) {
          rawYaml = parts[1] ?? null;
          const loaded = loadYaml(parts[1]!) as FrontMatter;
          if (typeof loaded === 'object' && loaded !== null) {
            parsed = loaded;
            if (Array.isArray(parsed.tags)) {
              parsed.tags.forEach((t) => typeof t === 'string' && rawTags.push(t.trim()));
            } else if (typeof parsed.tags === 'string') {
              parsed.tags.split(',').forEach((t) => rawTags.push(t.trim()));
            }
          }
        }
      } catch {
        // Ignore invalid YAML syntax; still store author/version from body when possible.
      }
    }

    const repoLink = repoBrowseUrl(repoUrl, sourceHost, repoRef);
    const version = extractVersionFromSkillMd(content);
    const author = extractAuthorFromSkillMd(content);

    // Always upsert metadata so version/author from body are kept even without front matter
    this.db.prepare(`
      INSERT INTO skill_metadata
        (sha256, skill_name, description, version, author, source_host, repo_url, repo_ref, repo_link, tags_json, raw_yaml)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sha256) DO UPDATE SET
        skill_name = excluded.skill_name,
        description = excluded.description,
        version = excluded.version,
        author = excluded.author,
        tags_json = excluded.tags_json,
        raw_yaml = excluded.raw_yaml,
        repo_ref = CASE
          WHEN skill_metadata.repo_url = excluded.repo_url THEN excluded.repo_ref
          ELSE skill_metadata.repo_ref
        END,
        repo_link = CASE
          WHEN skill_metadata.repo_url = excluded.repo_url THEN excluded.repo_link
          ELSE skill_metadata.repo_link
        END
    `).run(
      sha256,
      String(parsed?.name || ''),
      String(parsed?.description || ''),
      version,
      author,
      sourceHost,
      repoUrl,
      repoRef,
      repoLink,
      JSON.stringify(rawTags),
      rawYaml,
    );

    for (const rawTag of rawTags) {
      const normalizedTag = rawTag.replace(/:/g, '/').toLowerCase();
      const segments = normalizedTag.split('/').filter(Boolean);

      let currentParentId: number | null = null;
      let currentPath = '';

      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        let node = this.db.prepare(`SELECT id FROM catalog_nodes WHERE full_path = ?`).get(currentPath) as
          | { id: number }
          | undefined;

        if (!node) {
          const result = this.db.prepare(`
            INSERT INTO catalog_nodes (parent_id, name, full_path)
            VALUES (?, ?, ?)
          `).run(currentParentId, segment, currentPath);
          currentParentId = result.lastInsertRowid as number;
        } else {
          currentParentId = node.id;
        }
      }

      if (currentParentId !== null) {
        this.db.prepare(`
          INSERT OR IGNORE INTO skill_catalog_mapping (sha256, catalog_node_id)
          VALUES (?, ?)
        `).run(sha256, currentParentId);
      }
    }
  }

  private extractSiblings(
    filesMap: Record<string, Uint8Array>,
    allFilePaths: string[],
    skillDir: string,
    occurrenceId: number
  ): void {
    const insertSibling = this.db.prepare(`
      INSERT INTO skill_siblings (occurrence_id, sibling_relative_path, file_type, size_bytes, content)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const filePath of allFilePaths) {
      if (
        filePath.startsWith(skillDir) &&
        !filePath.endsWith('/SKILL.md') &&
        filesMap[filePath]!.length > 0
      ) {
        const relPath = path.relative(skillDir, filePath);
        const fileExt = path.extname(filePath).replace('.', '').toLowerCase() || 'unknown';
        const fileData = filesMap[filePath];
        const sizeBytes = fileData!.length;

        let textContent: string | null = null;
        const textExts = new Set([
          'py', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
          'sh', 'bash', 'zsh',
          'json', 'jsonc', 'yaml', 'yml', 'toml', 'xml', 'html', 'css', 'scss',
          'md', 'mdx', 'txt', 'rst',
          'rs', 'go', 'java', 'kt', 'rb', 'php', 'sql', 'graphql', 'proto',
          'dockerfile', 'gitignore', 'env', 'ini', 'cfg', 'conf',
        ]);
        if (sizeBytes < 100_000 && textExts.has(fileExt)) {
          try {
            const decoded = new TextDecoder('utf-8', { fatal: true }).decode(fileData);
            if (!decoded.includes('\u0000')) {
              textContent = decoded;
            }
          } catch {
            textContent = null;
          }
        }

        insertSibling.run(occurrenceId, relPath, fileExt, sizeBytes, textContent);
      }
    }
  }

  /** Export Catalog Tree with Repository Metadata included */
  public getCatalogTree(): CatalogTreeNode[] {
    const allNodes = this.db.prepare(`SELECT * FROM catalog_nodes`).all() as { id: number; parent_id: number | null; name: string; full_path: string }[];
    const nodeMap = new Map();
    const roots: CatalogTreeNode[] = [];

    for (const node of allNodes) {
      const skills = this.db.prepare(`
        SELECT m.sha256, m.skill_name as name, m.description, m.repo_url as repoUrl, m.repo_ref as repoRef
        FROM skill_catalog_mapping map
        JOIN skill_metadata m ON map.sha256 = m.sha256
        WHERE map.catalog_node_id = ?
      `).all(node.id) as { sha256: string; name: string; description: string; repoUrl: string; repoRef: string }[];

      nodeMap.set(node.id, {
        id: node.id,
        name: node.name,
        fullPath: node.full_path,
        children: [],
        skills,
      });
    }

    for (const node of allNodes) {
      const treeNode = nodeMap.get(node.id)!;
      if (node.parent_id === null) {
        roots.push(treeNode);
      } else {
        const parentNode = nodeMap.get(node.parent_id);
        if (parentNode) {
          parentNode.children.push(treeNode);
        }
      }
    }

    return roots;
  }
}