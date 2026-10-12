import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { load as loadYaml } from 'js-yaml';
import type Database from 'better-sqlite3';
import { skillPackageDirName, type SkillSummary } from './registry.js';

export const PROJECT_DIR_SETTING = 'project_dir';
export const PROJECT_SKILLS_REL = path.join('.cursor', 'skills');

export interface LocalSkill {
  dirName: string;
  path: string;
  name: string;
  sha256: string;
}

export type SkillInstallStatus = 'installed' | 'modified' | 'missing';

export interface ProjectContext {
  projectDir: string | null;
  projectName: string | null;
  skillsRoot: string | null;
  skillsRootExists: boolean;
  localSkills: LocalSkill[];
}

function expandUserPath(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

function parseSkillName(content: string): string {
  if (!content.startsWith('---')) return '';
  const end = content.indexOf('\n---', 3);
  if (end === -1) return '';
  try {
    const parsed = loadYaml(content.slice(4, end).trim()) as { name?: unknown };
    return typeof parsed?.name === 'string' ? parsed.name.trim() : '';
  } catch {
    return '';
  }
}

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function deleteSetting(db: Database.Database, key: string): void {
  db.prepare(`DELETE FROM app_settings WHERE key = ?`).run(key);
}

export function getProjectDir(db: Database.Database): string | null {
  const stored = getSetting(db, PROJECT_DIR_SETTING);
  return stored ? path.resolve(stored) : null;
}

export function setProjectDir(db: Database.Database, dir: string): string {
  const resolved = path.resolve(expandUserPath(dir));
  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory does not exist: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${resolved}`);
  }
  setSetting(db, PROJECT_DIR_SETTING, resolved);
  return resolved;
}

export function clearProjectDir(db: Database.Database): void {
  deleteSetting(db, PROJECT_DIR_SETTING);
}

export function projectSkillsRoot(projectDir: string): string {
  return path.join(path.resolve(expandUserPath(projectDir)), PROJECT_SKILLS_REL);
}

/** Scan project/.cursor/skills/<name>/SKILL.md for locally installed skill packages. */
export function scanLocalSkills(projectDir: string): LocalSkill[] {
  const root = projectSkillsRoot(projectDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return [];
  }

  const results: LocalSkill[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(root, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMd) || !fs.statSync(skillMd).isFile()) continue;

    const content = fs.readFileSync(skillMd, 'utf8');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const name = parseSkillName(content) || entry.name;
    results.push({
      dirName: entry.name,
      path: path.join(root, entry.name),
      name,
      sha256,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function getProjectContext(db: Database.Database): ProjectContext {
  const projectDir = getProjectDir(db);
  if (!projectDir) {
    return {
      projectDir: null,
      projectName: null,
      skillsRoot: null,
      skillsRootExists: false,
      localSkills: [],
    };
  }

  const skillsRoot = projectSkillsRoot(projectDir);
  const skillsRootExists = fs.existsSync(skillsRoot) && fs.statSync(skillsRoot).isDirectory();
  return {
    projectDir,
    projectName: path.basename(projectDir),
    skillsRoot,
    skillsRootExists,
    localSkills: scanLocalSkills(projectDir),
  };
}

export function findLocalSkill(
  skill: SkillSummary,
  localSkills: LocalSkill[],
): LocalSkill | undefined {
  const packageDir = skillPackageDirName(skill);
  const skillName = skill.name.trim().toLowerCase();

  return (
    localSkills.find((local) => local.sha256 === skill.sha256) ??
    localSkills.find((local) => local.dirName === packageDir) ??
    (skillName
      ? localSkills.find((local) => local.name.trim().toLowerCase() === skillName)
      : undefined)
  );
}

export function skillInstallStatus(
  skill: SkillSummary,
  localSkills: LocalSkill[],
): SkillInstallStatus {
  const match = findLocalSkill(skill, localSkills);
  if (!match) return 'missing';
  if (match.sha256 === skill.sha256) return 'installed';
  return 'modified';
}
