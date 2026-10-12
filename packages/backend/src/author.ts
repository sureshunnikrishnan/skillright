import { load as loadYaml } from 'js-yaml';

function normalizeAuthor(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeAuthor(entry))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.name != null) return String(record.name).trim();
    return '';
  }
  return String(value).trim();
}

function authorFromFrontmatter(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return '';
  const record = parsed as Record<string, unknown>;

  const topLevel = normalizeAuthor(record.author);
  if (topLevel) return topLevel;

  const metadata = record.metadata;
  if (metadata && typeof metadata === 'object') {
    const nested = normalizeAuthor((metadata as Record<string, unknown>).author);
    if (nested) return nested;
  }

  return '';
}

function stripCodeBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');
}

function cleanAuthorCandidate(raw: string): string {
  let value = raw.trim();
  // Markdown link: keep label, drop URL
  const link = value.match(/^\[([^\]]+)\]\([^)]+\)/);
  if (link?.[1]) value = link[1].trim();
  value = value.replace(/^[*_~\s]+|[*_~\s]+$/g, '').trim();
  // Ignore generic labels that are not people/orgs
  if (!value || /^(website|homepage|site|link|url)$/i.test(value)) return '';
  if (value.length > 120) return '';
  return value;
}

function authorFromBody(body: string): string {
  const text = stripCodeBlocks(body);

  const linePatterns = [
    /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*|__)?Authors?(?:\*\*|__)?\s*[:\-–—]\s*(.+?)(?:\n|$)/i,
    /(?:^|\n)\s*[-*]\s*(?:\*\*|__)?Authors?(?:\*\*|__)?\s*[:\-–—]\s*(.+?)(?:\n|$)/i,
    /(?:^|\n)\s*(?:\*\*|__)?By(?:\*\*|__)?\s*[:\-–—]\s*(.+?)(?:\n|$)/i,
  ];

  for (const pattern of linePatterns) {
    const match = text.match(pattern);
    const cleaned = match?.[1] ? cleanAuthorCandidate(match[1]) : '';
    if (cleaned) return cleaned;
  }

  const heading = text.match(/(?:^|\n)#{1,6}\s+Authors?\s*\n+([^\n#]+)/i);
  const fromHeading = heading?.[1] ? cleanAuthorCandidate(heading[1]) : '';
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

/** Resolve author from SKILL.md frontmatter (incl. metadata.author) or body text. */
export function extractAuthorFromSkillMd(content: string): string {
  const { frontmatter, body } = splitSkillMarkdown(content);
  return authorFromFrontmatter(frontmatter) || authorFromBody(body);
}
