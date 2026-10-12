import type { CatalogTreeNode, SkillSummary, SkillTagRecommendations } from '@skillright/backend';
import { field, theme } from './theme.js';

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printSkillsTable(skills: SkillSummary[]): void {
  if (skills.length === 0) {
    console.log(theme.muted('No skills found.'));
    return;
  }

  for (const skill of skills) {
    const name = skill.name || skill.sha256.slice(0, 12);
    const tags = skill.tags.length > 0 ? skill.tags.map((tag) => theme.tag(tag)).join(theme.muted(', ')) : theme.muted('—');
    console.log(theme.name(name));
    console.log(`  ${theme.muted(skill.description || '(no description)')}`);
    console.log(`  ${field('sha256', skill.sha256, 8)}`);
    console.log(`  ${field('author', skill.author || '(No Author)', 8)}`);
    console.log(`  ${field('version', skill.version || '—', 8)}`);
    console.log(`  ${theme.label('tags'.padEnd(8))}${tags}`);
    console.log(
      `  ${field('repo', `${skill.repoUrl}${skill.repoRef ? `@${skill.repoRef}` : ''}`, 8)}`,
    );
    console.log('');
  }

  console.log(theme.count(`${skills.length} skill(s)`));
}

export function printCatalogTree(nodes: CatalogTreeNode[], indent = 0): void {
  if (nodes.length === 0 && indent === 0) {
    console.log(theme.muted('Catalog is empty.'));
    return;
  }

  for (const node of nodes) {
    const pad = '  '.repeat(indent);
    console.log(`${pad}${theme.name(node.name)}  ${theme.muted(`(${node.fullPath})`)}`);
    for (const skill of node.skills) {
      console.log(
        `${pad}  ${theme.muted('-')} ${theme.name(skill.name || skill.sha256.slice(0, 12))}  ${theme.path(skill.repoUrl)}`,
      );
    }
    printCatalogTree(node.children, indent + 1);
  }
}

export function printTagRecommendations(result: SkillTagRecommendations): void {
  const name = result.name || result.sha256.slice(0, 12);
  console.log(theme.name(name));

  if (result.recommendations.length === 0) {
    console.log(theme.muted('No tag recommendations.'));
    return;
  }

  for (const rec of result.recommendations) {
    const sourceLabel = rec.source === 'existing' ? 'existing' : 'new     ';
    const source = rec.source === 'existing' ? theme.success(sourceLabel) : theme.warning(sourceLabel);
    console.log(`  ${theme.tag(rec.tag)}  ${source}  ${theme.muted(rec.reason)}`);
  }
}
