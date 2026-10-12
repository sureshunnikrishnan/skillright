import type { Metadata } from 'next';
import { CopyCommand } from '@/components/CopyCommand';
import { PageHeader } from '@/components/PageHeader';
import { SoftPanel, SoftShell } from '@/components/SoftShell';

export const metadata: Metadata = {
  title: 'CLI Guide',
};

const globalFlags = [
  { flag: '--json', detail: 'Emit JSON instead of human-readable output' },
  { flag: '--db <path>', detail: 'Override SQLite path (also env DB_PATH)' },
  { flag: '-h, --help', detail: 'Show help' },
] as const;

const commands = [
  {
    command: 'skillright index <repoUrl> [--ref] [--token]',
    purpose: 'Download a GitHub or Bitbucket repo and index SKILL.md packages',
  },
  {
    command: 'skillright list [--tag] [--repo] [--author] [--ref]',
    purpose: 'List indexed skills (substring filters for repo, author, and ref)',
  },
  {
    command: 'skillright search <query> [--limit]',
    purpose: 'Search name, description, author, branch, tags, and content (default limit 20)',
  },
  {
    command: 'skillright show <id>',
    purpose: 'Show metadata, siblings, and SKILL.md (name or sha256 prefix)',
  },
  {
    command: 'skillright recommend-tags <id> [--limit]',
    purpose: 'Suggest catalog tags (reuse existing when they fit; default limit 5)',
  },
  {
    command: 'skillright tag add <id> <tags…>',
    purpose: 'Add tags to a skill and attach it to the catalog',
  },
  {
    command: 'skillright tag remove <id> <tags…>',
    purpose: 'Remove tags from a skill and prune unused catalog nodes',
  },
  {
    command: 'skillright catalog',
    purpose: 'Print the tag catalog tree',
  },
  {
    command: 'skillright repos',
    purpose: 'List indexed repositories',
  },
  {
    command: 'skillright stats',
    purpose: 'Show registry counts and database path',
  },
  {
    command: 'skillright export <id> --dest <dir>',
    purpose: 'Write SKILL.md and sibling files to an exact directory',
  },
  {
    command: 'skillright install <id> --dir <path>',
    purpose: 'Install into <path>/<skill-name>/ (project or global skills root)',
  },
  {
    command: 'skillright remove <id> [--yes]',
    purpose: 'Delete a skill from the local registry',
  },
  {
    command: 'skillright remove --repo <repo> [--yes]',
    purpose: 'Delete all skills indexed from a repository',
  },
] as const;

const examples = [
  {
    title: 'Index repositories',
    commands: [
      'npx skillright index https://github.com/simnova/sharethrift',
      'npx skillright index https://bitbucket.org/my-workspace/my-repo --ref main --token "$BITBUCKET_TOKEN"',
    ],
  },
  {
    title: 'Discover skills',
    commands: [
      'npx skillright list --author acme --ref main',
      'npx skillright search review --json',
      'npx skillright show code-review',
      'npx skillright repos',
      'npx skillright stats',
    ],
  },
  {
    title: 'Tag and catalog',
    commands: [
      'npx skillright recommend-tags code-review',
      'npx skillright tag add code-review quality engineering/code-review',
      'npx skillright tag remove code-review quality',
      'npx skillright catalog',
    ],
  },
  {
    title: 'Install, reinstall, export, remove',
    commands: [
      'npx skillright install code-review --dir ./.cursor/skills',
      'npx skillright install code-review --dir ~/.cursor/skills',
      'npx skillright export code-review --dest ./exported/code-review',
      'npx skillright remove code-review --yes',
      'npx skillright remove --repo simnova/sharethrift --yes',
    ],
  },
] as const;

export default function CliPage() {
  return (
    <SoftShell>
      <PageHeader
        title="CLI Guide"
        description="Manage the same local SQLite catalog from the terminal. Build the monorepo first, then run skillright via npx or npm start."
      />

      <SoftPanel tone="lavender" className="mb-6 space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-violet-950">Getting started</h2>
        <p className="text-sm text-violet-900/75">
          From the repo root after <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">npm run build</code>:
        </p>
        <div className="grid gap-2">
          <CopyCommand command="npx skillright --help" />
          <CopyCommand command="npm start -- --help" />
        </div>
        <p className="text-sm text-violet-900/75">
          Skill IDs accept a skill <strong className="font-medium text-violet-950">name</strong> or a{' '}
          <strong className="font-medium text-violet-950">sha256 prefix</strong> (≥ 7 hex characters). Reinstall by running{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">install</code> again — it overwrites{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">&lt;dir&gt;/&lt;skill-name&gt;/</code>.
        </p>
      </SoftPanel>

      <SoftPanel tone="mist" className="mb-6">
        <h2 className="mb-4 font-heading text-lg font-semibold tracking-tight text-foreground">Global flags</h2>
        <ul className="space-y-3">
          {globalFlags.map((item) => (
            <li key={item.flag} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <code className="shrink-0 font-mono text-xs text-foreground sm:w-36">{item.flag}</code>
              <span className="text-sm text-muted-foreground">{item.detail}</span>
            </li>
          ))}
        </ul>
      </SoftPanel>

      <SoftPanel tone="card" className="mb-6">
        <h2 className="mb-4 font-heading text-lg font-semibold tracking-tight text-foreground">Commands</h2>
        <ul className="divide-y divide-border/70">
          {commands.map((item) => (
            <li key={item.command} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <code className="font-mono text-xs text-foreground sm:text-[0.8rem]">{item.command}</code>
              <span className="text-sm text-muted-foreground">{item.purpose}</span>
            </li>
          ))}
        </ul>
      </SoftPanel>

      <div className="space-y-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">Examples</h2>
        {examples.map((group) => (
          <SoftPanel key={group.title} tone="muted" className="space-y-3">
            <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">{group.title}</h3>
            <div className="grid gap-2">
              {group.commands.map((command) => (
                <CopyCommand key={command} command={command} />
              ))}
            </div>
          </SoftPanel>
        ))}
      </div>

      <SoftPanel tone="sky" className="mt-6 space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">Hosts and tokens</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">GitHub</strong> — repo root URL;{' '}
            <code className="rounded bg-white/70 px-1 font-mono text-xs">GITHUB_TOKEN</code> optional for public repos.
          </li>
          <li>
            <strong className="font-medium text-foreground">Bitbucket</strong> —{' '}
            <code className="rounded bg-white/70 px-1 font-mono text-xs">
              {'https://bitbucket.org/{workspace}/{repo}'}
            </code>
            ;
            token always required (<code className="rounded bg-white/70 px-1 font-mono text-xs">BITBUCKET_TOKEN</code> or{' '}
            <code className="rounded bg-white/70 px-1 font-mono text-xs">--token</code>), scope{' '}
            <code className="rounded bg-white/70 px-1 font-mono text-xs">read:repository:bitbucket</code>.
          </li>
          <li>
            Full setup notes live in the repo <code className="rounded bg-white/70 px-1 font-mono text-xs">README.md</code>.
          </li>
        </ul>
      </SoftPanel>
    </SoftShell>
  );
}
