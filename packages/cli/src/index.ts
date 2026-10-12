#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { Command, Option } from 'commander';
import {
  addSkillTags,
  config,
  exportSkill,
  getCatalogTree,
  getSkill,
  getStats,
  indexRepository,
  initializeDatabase,
  installSkill,
  listRepos,
  listSkills,
  recommendTags,
  removeRepository,
  removeSkill,
  removeSkillTags,
  resolveRepos,
  resolveSkills,
  searchSkills,
} from '@skillright/backend';
import { printCatalogTree, printJson, printSkillsTable, printTagRecommendations } from './format.js';
import { field, section, stderrHasColors, stdoutHasColors, theme } from './theme.js';

function openRegistry() {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  return initializeDatabase(config.dbPath);
}

function withDb<T>(fn: (db: ReturnType<typeof initializeDatabase>) => T): T {
  const db = openRegistry();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function fail(message: string, json: boolean): never {
  if (json) {
    printJson({ error: message });
  } else {
    console.error(theme.error(message));
  }
  process.exit(1);
}

function requireOneRepo(query: string, json: boolean) {
  return withDb((db) => {
    const matches = resolveRepos(db, query);
    if (matches.length === 0) {
      fail(`No indexed repository matched '${query}'.`, json);
    }
    if (matches.length > 1) {
      if (json) {
        printJson({ error: `Multiple repositories matched '${query}'.`, matches });
        process.exit(1);
      }
      console.error(theme.error(`Multiple repositories matched '${query}'. Be more specific:\n`));
      for (const repo of matches) {
        console.error(
          `  ${theme.errorName(repo.repoName)}  ${theme.errorPath(repo.repoUrl)}  ${theme.errorMuted(`(${repo.skillCount} skill(s))`)}`,
        );
      }
      process.exit(1);
    }
    return matches[0]!;
  });
}

function requireOneSkill(id: string, json: boolean) {
  return withDb((db) => {
    const matches = resolveSkills(db, id);
    if (matches.length === 0) {
      fail(`No skill matched '${id}'.`, json);
    }
    if (matches.length > 1) {
      if (json) {
        printJson({ error: `Multiple skills matched '${id}'.`, matches });
        process.exit(1);
      }
      console.error(theme.error(`Multiple skills matched '${id}'. Be more specific:\n`));
      printSkillsTable(matches);
      process.exit(1);
    }
    return matches[0]!;
  });
}

async function confirm(prompt: string, yes: boolean): Promise<boolean> {
  if (yes) return true;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise<string>((resolve) => {
    rl.question(`${theme.prompt(prompt)} ${theme.errorMuted('[y/N]')} `, resolve);
  });
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

const program = new Command();

program
  .name('skillright')
  .description('Manage the local Skillright skills registry')
  .option('--json', 'Emit JSON instead of human-readable output')
  .addOption(new Option('--db <path>', 'SQLite database path').env('DB_PATH'))
  .configureHelp({
    styleTitle: (str) => theme.heading(str),
    styleCommandText: (str) => theme.command(str),
    styleCommandDescription: (str) => theme.muted(str),
    styleDescriptionText: (str) => theme.muted(str),
    styleOptionText: (str) => theme.option(str),
    styleSubcommandText: (str) => theme.command(str),
    styleArgumentText: (str) => theme.argument(str),
  })
  .configureOutput({
    getOutHasColors: stdoutHasColors,
    getErrHasColors: stderrHasColors,
  });

program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.optsWithGlobals() as { db?: string };
  if (opts.db) {
    config.dbPath = opts.db;
  }
});

program
  .command('index')
  .description('Download a GitHub or Bitbucket repo and index its SKILL.md packages')
  .argument('<repoUrl>', 'HTTPS repository URL (Bitbucket: https://bitbucket.org/{workspace}/{repo})')
  .option('--ref <ref>', 'Branch name; leading/trailing slashes ignored (default: DEFAULT_GIT_REF or main)')
  .option('--token <token>', 'Auth token (required for Bitbucket; overrides BITBUCKET_TOKEN / GITHUB_TOKEN)')
  .action(async (repoUrl: string, opts: { ref?: string; token?: string }, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const db = openRegistry();
    try {
      const repoConfig: { repoUrl: string; ref?: string; authToken?: string } = { repoUrl };
      if (opts.ref) repoConfig.ref = opts.ref;
      if (opts.token) repoConfig.authToken = opts.token;
      await indexRepository(db, repoConfig);
      const stats = getStats(db);
      if (json) {
        printJson({ ok: true, repoUrl, ref: opts.ref ?? config.defaultRef, stats });
      } else {
        console.log(`${theme.success('Indexed')} ${theme.path(repoUrl)}`);
        console.log(
          `${theme.label('Registry:')} ${theme.count(`${stats.skills} skill(s)`)}${theme.muted(', ')}${theme.count(`${stats.repos} repo(s)`)}`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      fail(message, json);
    } finally {
      db.close();
    }
  });

program
  .command('list')
  .description('List indexed skills')
  .option('--tag <tag>', 'Filter by catalog tag path')
  .option('--repo <repo>', 'Filter by repository URL (substring ok)')
  .option('--author <name>', 'Filter by author name (substring ok)')
  .option('--ref <ref>', 'Filter by branch/ref name (substring ok)')
  .action((opts: { tag?: string; repo?: string; author?: string; ref?: string }, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const filters: { tag?: string; repo?: string; author?: string; ref?: string } = {};
    if (opts.tag) filters.tag = opts.tag;
    if (opts.repo) filters.repo = opts.repo;
    if (opts.author) filters.author = opts.author;
    if (opts.ref) filters.ref = opts.ref;
    const skills = withDb((db) => listSkills(db, filters));
    if (json) printJson(skills);
    else printSkillsTable(skills);
  });

program
  .command('search')
  .description('Search skills by name, description, author, branch, tags, or SKILL.md content')
  .argument('<query>', 'Search string')
  .option('--limit <n>', 'Max results', (v) => Number(v), 20)
  .action((query: string, opts: { limit: number }, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const skills = withDb((db) => searchSkills(db, query, opts.limit));
    if (json) printJson(skills);
    else printSkillsTable(skills);
  });

program
  .command('show')
  .description('Show a skill by name or sha256 prefix')
  .argument('<id>', 'Skill name or sha256 (prefix ok)')
  .action((id: string, _opts: unknown, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const summary = requireOneSkill(id, json);
    const skill = withDb((db) => getSkill(db, summary.sha256));
    if (!skill) fail(`Skill not found: ${summary.sha256}`, json);
    if (json) {
      printJson(skill);
      return;
    }
    console.log(field('Name:', skill.name || '—'));
    console.log(field('SHA-256:', skill.sha256));
    console.log(field('Author:', skill.author || '(No Author)'));
    console.log(field('Version:', skill.version || '—'));
    console.log(field('Description:', skill.description || '—'));
    console.log(
      `${theme.label('Tags:'.padEnd(14))}${
        skill.tags.length > 0 ? skill.tags.map((tag) => theme.tag(tag)).join(theme.muted(', ')) : theme.muted('—')
      }`,
    );
    console.log(field('Repo:', `${skill.repoUrl}${skill.repoRef ? `@${skill.repoRef}` : ''}`));
    if (skill.siblings.length > 0) {
      console.log(`\n${section('Siblings:')}`);
      for (const sib of skill.siblings) {
        console.log(`  ${theme.path(sib.relativePath)}  ${theme.muted(`${sib.sizeBytes} bytes`)}`);
        if (sib.content !== null) {
          console.log(theme.muted('  ---'));
          console.log(sib.content.replace(/^/gm, '  '));
          console.log(theme.muted('  ---'));
        } else {
          console.log(theme.muted('  (content not stored)'));
        }
      }
    }
    console.log(`\n${section('--- SKILL.md ---')}\n`);
    console.log(skill.content);
  });

program
  .command('recommend-tags')
  .description('Recommend tags for a skill (existing catalog tags when they fit, otherwise new tags)')
  .argument('<id>', 'Skill name or sha256 (prefix ok)')
  .option('--limit <n>', 'Max tags to recommend', (v) => Number(v), 5)
  .action((id: string, opts: { limit: number }, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const summary = requireOneSkill(id, json);
    const result = withDb((db) => recommendTags(db, summary.sha256, { limit: opts.limit }));
    if (!result) fail(`Skill not found: ${id}`, json);
    if (json) printJson(result);
    else printTagRecommendations(result);
  });

const tagCmd = program.command('tag').description('Add or remove tags on a skill');

tagCmd
  .command('add')
  .description('Add one or more tags to a skill')
  .argument('<id>', 'Skill name or sha256 (prefix ok)')
  .argument('<tags...>', 'Tags to add (colon or slash path, e.g. engineering/testing)')
  .action((id: string, tags: string[], _opts: unknown, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const summary = requireOneSkill(id, json);
    try {
      const result = withDb((db) => addSkillTags(db, summary.sha256, tags));
      if (json) {
        printJson(result);
        return;
      }
      const name = result.name || result.sha256;
      if (result.added.length > 0) {
        console.log(
          `${theme.success('Added')} ${result.added.map((tag) => theme.tag(tag)).join(theme.muted(', '))} ${theme.muted('to')} ${theme.name(name)}`,
        );
      }
      if (result.skipped.length > 0) {
        console.log(
          `${theme.muted('Already present:')} ${result.skipped.map((tag) => theme.tag(tag)).join(theme.muted(', '))}`,
        );
      }
      console.log(
        `${theme.label('Tags:')} ${
          result.tags.length > 0 ? result.tags.map((tag) => theme.tag(tag)).join(theme.muted(', ')) : theme.muted('—')
        }`,
      );
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : String(err), json);
    }
  });

tagCmd
  .command('remove')
  .description('Remove one or more tags from a skill')
  .argument('<id>', 'Skill name or sha256 (prefix ok)')
  .argument('<tags...>', 'Tags to remove')
  .action((id: string, tags: string[], _opts: unknown, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const summary = requireOneSkill(id, json);
    try {
      const result = withDb((db) => removeSkillTags(db, summary.sha256, tags));
      if (json) {
        printJson(result);
        return;
      }
      const name = result.name || result.sha256;
      if (result.removed.length > 0) {
        console.log(
          `${theme.success('Removed')} ${result.removed.map((tag) => theme.tag(tag)).join(theme.muted(', '))} ${theme.muted('from')} ${theme.name(name)}`,
        );
      }
      if (result.skipped.length > 0) {
        console.log(
          `${theme.muted('Not present:')} ${result.skipped.map((tag) => theme.tag(tag)).join(theme.muted(', '))}`,
        );
      }
      console.log(
        `${theme.label('Tags:')} ${
          result.tags.length > 0 ? result.tags.map((tag) => theme.tag(tag)).join(theme.muted(', ')) : theme.muted('—')
        }`,
      );
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : String(err), json);
    }
  });

program
  .command('catalog')
  .description('Print the tag catalog tree')
  .action((_opts: unknown, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const tree = withDb((db) => getCatalogTree(db));
    if (json) printJson(tree);
    else printCatalogTree(tree);
  });

program
  .command('repos')
  .description('List repositories that have been indexed')
  .action((_opts: unknown, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const repos = withDb((db) => listRepos(db));
    if (json) {
      printJson(repos);
      return;
    }
    if (repos.length === 0) {
      console.log(theme.muted('No repositories indexed.'));
      return;
    }
    for (const repo of repos) {
      console.log(`${theme.name(repo.repoName)}  ${theme.count(`${repo.skillCount} skill(s)`)}`);
      console.log(`  ${theme.path(repo.repoUrl)}  ${theme.muted(`(${repo.sourceHost})`)}`);
    }
  });

program
  .command('stats')
  .description('Show registry counts')
  .action((_opts: unknown, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const stats = withDb((db) => getStats(db));
    if (json) printJson(stats);
    else {
      console.log(field('Database:', config.dbPath));
      console.log(field('Skills:', String(stats.skills)));
      console.log(field('Repos:', String(stats.repos)));
      console.log(field('Catalog nodes:', String(stats.catalogNodes)));
    }
  });

program
  .command('export')
  .description('Write a skill directory (SKILL.md and siblings) to disk')
  .argument('<id>', 'Skill name or sha256 (prefix ok)')
  .requiredOption('--dest <path>', 'Destination directory')
  .action((id: string, opts: { dest: string }, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const summary = requireOneSkill(id, json);
    const dest = withDb((db) => exportSkill(db, summary.sha256, opts.dest));
    if (json) printJson({ sha256: summary.sha256, path: dest });
    else {
      console.log(
        `${theme.success('Exported')} ${theme.name(summary.name || summary.sha256)} ${theme.muted('to')} ${theme.path(dest)}`,
      );
    }
  });

program
  .command('install')
  .description(
    'Install a skill into a local skills folder for agents (project .cursor/skills or global ~/.cursor/skills)',
  )
  .argument('<id>', 'Skill name or sha256 (prefix ok)')
  .requiredOption(
    '--dir <path>',
    'Skills root folder (e.g. ./.cursor/skills or ~/.cursor/skills). The skill is written to <dir>/<skill-name>/',
  )
  .action((id: string, opts: { dir: string }, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    const summary = requireOneSkill(id, json);
    try {
      const dest = withDb((db) => installSkill(db, summary.sha256, opts.dir));
      if (json) printJson({ sha256: summary.sha256, path: dest });
      else {
        console.log(
          `${theme.success('Installed')} ${theme.name(summary.name || summary.sha256)} ${theme.muted('to')} ${theme.path(dest)}`,
        );
      }
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : String(err), json);
    }
  });

program
  .command('remove')
  .description('Remove a skill, or all skills indexed from a repository')
  .argument('[id]', 'Skill name or sha256 (prefix ok)')
  .option('--repo <repo>', 'Remove all skills indexed from this repository (URL or owner/name)')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (id: string | undefined, opts: { yes?: boolean; repo?: string }, cmd: Command) => {
    const json = Boolean(cmd.optsWithGlobals().json);
    if (Boolean(id) === Boolean(opts.repo)) {
      fail("Specify a skill id or --repo, not both.", json);
    }

    if (opts.repo) {
      const repo = requireOneRepo(opts.repo, json);
      const ok = await confirm(
        `Remove ${repo.skillCount} skill(s) indexed from ${repo.repoUrl}? Skills still found in other repos are kept.`,
        Boolean(opts.yes || json),
      );
      if (!ok) {
        fail('Aborted.', json);
      }
      const result = withDb((db) => removeRepository(db, repo.repoUrl));
      if (!result) fail(`Repository not found: ${repo.repoUrl}`, json);
      if (json) printJson({ ok: true, ...result });
      else {
        console.log(
          `${theme.success('Removed')} ${theme.count(`${result.removedOccurrences} occurrence(s)`)} ${theme.muted('from')} ${theme.path(result.repoUrl)}`,
        );
        console.log(
          `${theme.warning('Deleted')} ${theme.count(`${result.deletedSkills.length} skill(s)`)} ${theme.muted('with no remaining source')}`,
        );
        if (result.keptSkills.length > 0) {
          console.log(
            `${theme.success('Kept')} ${theme.count(`${result.keptSkills.length} skill(s)`)} ${theme.muted('still indexed from other repos')}`,
          );
        }
      }
      return;
    }

    const summary = requireOneSkill(id!, json);
    const ok = await confirm(
      `Remove '${summary.name || summary.sha256}' from the registry?`,
      Boolean(opts.yes || json),
    );
    if (!ok) {
      fail('Aborted.', json);
    }
    const removed = withDb((db) => removeSkill(db, summary.sha256));
    if (!removed) fail(`Skill not found: ${summary.sha256}`, json);
    if (json) printJson({ ok: true, sha256: summary.sha256, name: summary.name });
    else console.log(`${theme.success('Removed')} ${theme.name(summary.name || summary.sha256)}`);
  });

await program.parseAsync(process.argv);
