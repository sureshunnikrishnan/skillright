'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addSkillTags,
  clearProjectDir,
  config,
  getProjectDir,
  getSkill,
  indexRepository,
  installSkill,
  projectSkillsRoot,
  removeRepository,
  removeSkill,
  removeSkillTags,
  resolveRepos,
  resolveSkills,
  setProjectDir,
} from '@skillright/backend';
import { withDb, withDbAsync } from './db';
import { skillLabel } from './format';

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function withQuery(path: string, key: string, message: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(message)}`;
}

function failRedirect(path: string, message: string): never {
  redirect(withQuery(path, 'error', message));
}

function okRedirect(path: string, message: string): never {
  redirect(withQuery(path, 'notice', message));
}

function projectFailRedirect(path: string, message: string): never {
  redirect(withQuery(path, 'projectError', message));
}

function projectOkRedirect(path: string, message: string): never {
  redirect(withQuery(path, 'projectNotice', message));
}

export async function indexRepoAction(formData: FormData): Promise<void> {
  const repoUrl = formString(formData, 'repoUrl');
  const ref = formString(formData, 'ref');
  const token = formString(formData, 'token');

  if (!repoUrl) {
    failRedirect('/repos', 'A repository URL is required.');
  }

  try {
    await withDbAsync(async (db) => {
      const repoConfig: { repoUrl: string; ref?: string; authToken?: string } = { repoUrl };
      if (ref) repoConfig.ref = ref;
      if (token) repoConfig.authToken = token;
      await indexRepository(db, repoConfig);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    failRedirect('/repos', message);
  }

  revalidatePath('/');
  revalidatePath('/skills');
  revalidatePath('/repos');
  revalidatePath('/tags');
  okRedirect('/repos', `Indexed ${repoUrl} (${ref || config.defaultRef}).`);
}

export async function removeRepoAction(formData: FormData): Promise<void> {
  const query = formString(formData, 'repo');
  if (!query) {
    failRedirect('/repos', 'A repository is required.');
  }

  let result;
  try {
    result = withDb((db) => {
      const matches = resolveRepos(db, query);
      if (matches.length === 0) {
        throw new Error(`No indexed repository matched '${query}'.`);
      }
      if (matches.length > 1) {
        throw new Error(`Multiple repositories matched '${query}'. Be more specific.`);
      }
      return removeRepository(db, matches[0]!.repoUrl);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    failRedirect('/repos', message);
  }

  if (!result) {
    failRedirect('/repos', `No indexed repository matched '${query}'.`);
  }

  revalidatePath('/');
  revalidatePath('/skills');
  revalidatePath('/repos');
  revalidatePath('/tags');
  okRedirect(
    '/repos',
    `Removed ${result.repoName}: ${result.deletedSkills.length} skill(s) deleted, ${result.keptSkills.length} kept.`,
  );
}

export async function addTagsAction(formData: FormData): Promise<void> {
  const sha256 = formString(formData, 'sha256');
  const raw = formString(formData, 'tags');
  const tags = raw.split(/[\s,]+/).filter(Boolean);
  const skillPath = `/skills/${sha256}`;
  const dest = `${skillPath}?tab=tags`;

  if (!sha256) {
    failRedirect('/skills', 'A skill is required.');
  }
  if (tags.length === 0) {
    failRedirect(dest, 'Enter at least one tag.');
  }

  let result;
  try {
    result = withDb((db) => addSkillTags(db, sha256, tags));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    failRedirect(dest, message);
  }

  revalidatePath('/');
  revalidatePath('/skills');
  revalidatePath(skillPath);
  revalidatePath('/tags');
  const added = result.added.length > 0 ? `Added ${result.added.join(', ')}.` : 'No new tags.';
  okRedirect(dest, added);
}

export async function removeTagAction(formData: FormData): Promise<void> {
  const sha256 = formString(formData, 'sha256');
  const tag = formString(formData, 'tag');
  const skillPath = `/skills/${sha256}`;
  const dest = `${skillPath}?tab=tags`;

  if (!sha256 || !tag) {
    failRedirect(dest || '/skills', 'Skill and tag are required.');
  }

  try {
    withDb((db) => removeSkillTags(db, sha256, [tag]));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    failRedirect(dest, message);
  }

  revalidatePath('/');
  revalidatePath('/skills');
  revalidatePath(skillPath);
  revalidatePath('/tags');
  okRedirect(dest, `Removed tag ${tag}.`);
}

export async function applyRecommendedTagAction(formData: FormData): Promise<void> {
  const sha256 = formString(formData, 'sha256');
  const tag = formString(formData, 'tag');
  const skillPath = `/skills/${sha256}`;
  const dest = `${skillPath}?tab=tags`;

  if (!sha256 || !tag) {
    failRedirect(dest || '/skills', 'Skill and tag are required.');
  }

  try {
    withDb((db) => addSkillTags(db, sha256, [tag]));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    failRedirect(dest, message);
  }

  revalidatePath('/');
  revalidatePath('/skills');
  revalidatePath(skillPath);
  revalidatePath('/tags');
  okRedirect(dest, `Added recommended tag ${tag}.`);
}

export async function removeSkillAction(formData: FormData): Promise<void> {
  const id = formString(formData, 'id');
  if (!id) {
    failRedirect('/skills', 'A skill is required.');
  }

  let summary;
  try {
    summary = withDb((db) => {
      const matches = resolveSkills(db, id);
      if (matches.length === 0) {
        throw new Error(`No skill matched '${id}'.`);
      }
      if (matches.length > 1) {
        throw new Error(`Multiple skills matched '${id}'. Open the skill page and try again.`);
      }
      const skill = matches[0]!;
      const detail = getSkill(db, skill.sha256);
      if (!detail || !removeSkill(db, skill.sha256)) {
        throw new Error(`Skill not found: ${skill.sha256}`);
      }
      return skill;
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    failRedirect('/skills', message);
  }

  revalidatePath('/');
  revalidatePath('/skills');
  revalidatePath('/repos');
  revalidatePath('/tags');
  okRedirect('/skills', `Removed ${skillLabel(summary)}.`);
}

export async function installSkillAction(formData: FormData): Promise<void> {
  const sha256 = formString(formData, 'sha256');
  let dir = formString(formData, 'dir');
  const skillPath = `/skills/${sha256}`;
  const dest = `${skillPath}?tab=overview`;

  if (!sha256) {
    failRedirect('/skills', 'A skill is required.');
  }

  let installedPath: string;
  let name: string;
  try {
    const result = withDb((db) => {
      if (!dir) {
        const projectDir = getProjectDir(db);
        if (!projectDir) {
          throw new Error('Enter a destination folder path, or set a project directory first.');
        }
        dir = projectSkillsRoot(projectDir);
      }
      const skill = getSkill(db, sha256);
      if (!skill) {
        throw new Error(`Skill not found: ${sha256}`);
      }
      return {
        path: installSkill(db, sha256, dir),
        name: skillLabel(skill),
      };
    });
    installedPath = result.path;
    name = result.name;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    failRedirect(dest, message);
  }

  revalidatePath('/');
  revalidatePath('/skills');
  revalidatePath('/project');
  revalidatePath(skillPath);
  okRedirect(dest, `Installed ${name} to ${installedPath}.`);
}

function revalidateProjectPaths(): void {
  revalidatePath('/');
  revalidatePath('/skills');
  revalidatePath('/project');
  revalidatePath('/repos');
  revalidatePath('/tags');
}

export async function setProjectAction(formData: FormData): Promise<void> {
  const dir = formString(formData, 'projectDir');
  const returnTo = formString(formData, 'returnTo') || '/project';

  if (!dir) {
    projectFailRedirect(returnTo, 'Enter a project directory path.');
  }

  let resolved: string;
  try {
    resolved = withDb((db) => setProjectDir(db, dir));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    projectFailRedirect(returnTo, message);
  }

  revalidateProjectPaths();
  projectOkRedirect(returnTo, `Project set to ${resolved}.`);
}

export async function clearProjectAction(formData: FormData): Promise<void> {
  const returnTo = formString(formData, 'returnTo') || '/project';

  withDb((db) => clearProjectDir(db));

  revalidateProjectPaths();
  projectOkRedirect(returnTo, 'Project directory cleared.');
}
