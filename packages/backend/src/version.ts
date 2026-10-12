import { load as loadYaml } from 'js-yaml';

function normalizeVersion(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  let text = String(value).trim();
  // Markdown link: keep label
  const link = text.match(/^\[([^\]]+)\]\([^)]+\)/);
  if (link?.[1]) text = link[1].trim();
  text = text.replace(/^[*_~\s]+|[*_~\s]+$/g, '').trim();
  // Drop a leading "v" / "V" (v1.2.3 → 1.2.3) but keep bare "v" out
  text = text.replace(/^v(?=[\d])/i, '');
  if (!text || text.length > 64) return '';
  // Reject values that look like prose rather than a version token
  if (/\s{2,}/.test(text) || text.split(/\s+/).length > 3) return '';
  return text;
}

function versionFromFrontmatter(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return '';
  const record = parsed as Record<string, unknown>;

  const topLevel = normalizeVersion(record.version);
  if (topLevel) return topLevel;

  const metadata = record.metadata;
  if (metadata && typeof metadata === 'object') {
    const nested = normalizeVersion((metadata as Record<string, unknown>).version);
    if (nested) return nested;
  }

  return '';
}

function stripCodeBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');
}

function versionFromBody(body: string): string {
  const text = stripCodeBlocks(body);

  const linePatterns = [
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*|__)?Versions?(?:\*\*|__)?\s*[:\-–—]\s*(.+?)(?:\n|$)/i,
    /(?:^|\n)\s*[-*]\s*(?:\*\*|__)?Versions?(?:\*\*|__)?\s*[:\-–—]\s*(.+?)(?:\n|$)/i,
    /(?:^|\n)\s*(?:\*\*|__)?Current versions?(?:\*\*|__)?\s*[:\-–—]\s*(.+?)(?:\n|$)/i,
  ];

  for (const pattern of linePatterns) {
    const match = text.match(pattern);
    const cleaned = match?.[1] ? normalizeVersion(match[1]) : '';
    if (cleaned) return cleaned;
  }

  const heading = text.match(/(?:^|\n)#{1,6}\s+Versions?\s*\n+([^\n#]+)/i);
  const fromHeading = heading?.[1] ? normalizeVersion(heading[1]) : '';
  if (fromHeading) return fromHeading;

  return '';
}

function splitSkillMarkdown(content: string): { frontmatter: unknown; body: string } {
  if (!content.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const end = content.indexOf('\n---', 3);
  if (end === -1) {
    return { frontmatter: null, body: content };
  }

  const yamlBlock = content.slice(4, end).trim();
  const body = content.slice(end + 4).replace(/^\r?\n/, '');

  try {
    return { frontmatter: loadYaml(yamlBlock), body };
  } catch {
    return { frontmatter: null, body };
  }
}

/** Resolve version from SKILL.md frontmatter (incl. metadata.version) or body text. */
export function extractVersionFromSkillMd(content: string): string {
  const { frontmatter, body } = splitSkillMarkdown(content);
  return versionFromFrontmatter(frontmatter) || versionFromBody(body);
}
