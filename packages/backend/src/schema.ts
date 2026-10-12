import Database from 'better-sqlite3';
import { extractAuthorFromSkillMd } from './author.js';
import { repoBrowseUrl } from './repo-url.js';
import { extractVersionFromSkillMd } from './version.js';

function metadataColumns(db: Database.Database): Set<string> {
  return new Set(
    (db.prepare(`PRAGMA table_info(skill_metadata)`).all() as { name: string }[]).map((column) => column.name),
  );
}

function ensureAuthorColumn(db: Database.Database): void {
  const columns = metadataColumns(db);
  if (!columns.has('author')) {
    db.exec(`ALTER TABLE skill_metadata ADD COLUMN author TEXT`);
  }

  const rows = db
    .prepare(
      `SELECT m.sha256, c.raw_content
       FROM skill_metadata m
       JOIN skill_contents c ON c.sha256 = m.sha256
       WHERE m.author IS NULL OR m.author = ''`,
    )
    .all() as { sha256: string; raw_content: string }[];

  const update = db.prepare(`UPDATE skill_metadata SET author = ? WHERE sha256 = ?`);
  for (const row of rows) {
    const author = extractAuthorFromSkillMd(row.raw_content);
    if (author) update.run(author, row.sha256);
  }
}

function backfillEmptyVersions(db: Database.Database): void {
  const rows = db
    .prepare(
      `SELECT m.sha256, c.raw_content
       FROM skill_metadata m
       JOIN skill_contents c ON c.sha256 = m.sha256
       WHERE m.version IS NULL OR m.version = ''`,
    )
    .all() as { sha256: string; raw_content: string }[];

  const update = db.prepare(`UPDATE skill_metadata SET version = ? WHERE sha256 = ?`);
  for (const row of rows) {
    const version = extractVersionFromSkillMd(row.raw_content);
    if (version) update.run(version, row.sha256);
  }
}

function ensureRepoLinkColumn(db: Database.Database): void {
  const columns = metadataColumns(db);
  if (!columns.has('repo_link')) {
    db.exec(`ALTER TABLE skill_metadata ADD COLUMN repo_link TEXT`);
  }

  const rows = db
    .prepare(
      `SELECT sha256, source_host, repo_url, repo_ref, repo_link
       FROM skill_metadata
       WHERE repo_link IS NULL OR repo_link = ''`,
    )
    .all() as {
      sha256: string;
      source_host: string;
      repo_url: string;
      repo_ref: string;
      repo_link: string | null;
    }[];

  const update = db.prepare(`UPDATE skill_metadata SET repo_link = ? WHERE sha256 = ?`);
  for (const row of rows) {
    update.run(repoBrowseUrl(row.repo_url, row.source_host, row.repo_ref), row.sha256);
  }
}

export function initializeDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_contents (
        sha256 TEXT PRIMARY KEY,
        raw_content TEXT NOT NULL,
        char_count INTEGER NOT NULL,
        line_count INTEGER NOT NULL,
        has_yaml_frontmatter BOOLEAN NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_occurrences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sha256 TEXT NOT NULL,
        source_host TEXT NOT NULL,       -- 'github' | 'bitbucket'
        repo_url TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        skill_dir_path TEXT NOT NULL,    -- e.g., 'skills/code-review'
        indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sha256) REFERENCES skill_contents(sha256)
    );

    -- Updated skill_metadata containing origin repository URL references
    CREATE TABLE IF NOT EXISTS skill_metadata (
        sha256 TEXT PRIMARY KEY,
        skill_name TEXT,
        description TEXT,
        version TEXT,
        author TEXT,
        source_host TEXT NOT NULL,       -- 'github' | 'bitbucket'
        repo_url TEXT NOT NULL,          -- Repository root URL
        repo_ref TEXT NOT NULL,          -- Branch or commit SHA reference
        repo_link TEXT,                 -- Exact browse URL (root + branch)
        tags_json TEXT,
        raw_yaml TEXT,
        FOREIGN KEY(sha256) REFERENCES skill_contents(sha256)
    );

    CREATE TABLE IF NOT EXISTS catalog_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER,
        name TEXT NOT NULL,
        full_path TEXT UNIQUE NOT NULL,
        FOREIGN KEY(parent_id) REFERENCES catalog_nodes(id)
    );

    CREATE TABLE IF NOT EXISTS skill_catalog_mapping (
        sha256 TEXT NOT NULL,
        catalog_node_id INTEGER NOT NULL,
        PRIMARY KEY (sha256, catalog_node_id),
        FOREIGN KEY(sha256) REFERENCES skill_contents(sha256),
        FOREIGN KEY(catalog_node_id) REFERENCES catalog_nodes(id)
    );

    CREATE TABLE IF NOT EXISTS skill_siblings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        occurrence_id INTEGER NOT NULL,
        sibling_relative_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        content TEXT,
        FOREIGN KEY(occurrence_id) REFERENCES skill_occurrences(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
  `);

  ensureAuthorColumn(db);
  ensureRepoLinkColumn(db);
  backfillEmptyVersions(db);

  return db;
}