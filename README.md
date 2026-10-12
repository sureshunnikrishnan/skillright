# Skillright

Skillright is an **organization-deployed registry for agent skills** (`SKILL.md` packages). Organizations run it centrally to index skills from **GitHub** and **Bitbucket** into a shared SQLite catalog. Developers then use that registry to search, tag, export, and install skills into their agent folders (typically `.cursor/skills`).

CLI and web UI share the same registry. Indexing uses archive downloads authenticated with personal access tokens when needed — no GitHub/Bitbucket OAuth apps or webhooks.

## Why Skillright?

### The problem

Agent skills spread across many repositories: personal forks, team skill packs, open-source examples, and private org repos. Without a central registry:

- Developers copy skills by hand and lose track of which version they installed
- The same skill appears under different names in different folders
- Tags and discovery stay tribal (“ask Alice for the review skill”)
- Bitbucket and GitHub sources are hard to treat the same way
- Re-installing or updating a skill after the source repo changes is awkward
- Organizations cannot see or govern which skills teams actually use

### What Skillright solves

| Need | How Skillright helps |
| --- | --- |
| Central registry | Org deploys one Skillright instance; developers consume that catalog |
| One place to find skills | Index approved repos once; browse/search the shared catalog |
| Deduplication | Identical `SKILL.md` content shares one SHA-256 entry |
| Structure | Hierarchical tags form a catalog tree |
| Same workflow for hosts | GitHub and Bitbucket both use zip archives + PATs |
| Install into agents | Write packages into project or global `.cursor/skills` |
| Drift awareness | Current Project view shows installed / modified / missing |

The catalog lives on the Skillright host (`DB_PATH`, default `~/.skillright/skillright.db` on that host). The organization chooses which repos to trust and when to re-index.

## Who deploys vs who uses it

| Role | Responsibility |
| --- | --- |
| **Organization** | Deploys Skillright centrally, configures GitHub/Bitbucket tokens, indexes and curates the org skill registry |
| **Developers** | Use the deployed web UI and/or CLI to browse, tag (where permitted by org process), install, reinstall, and track skills in their projects |

## How organizations deploy and manage it

Deploy Skillright once as the **central agent-skills registry** for the company or business unit:

1. **Stand up a central host** (internal VM, container, or shared workstation) that runs the Skillright web UI and holds the SQLite catalog (`DB_PATH`).
2. **Assign registry owners** (platform, DX, or a skills guild) who configure tokens and decide which source repos are indexed.
3. **Create or choose skill repositories** on GitHub and/or Bitbucket that hold official `SKILL.md` packages.
4. **Configure org tokens** on the Skillright host (`GITHUB_TOKEN`, `BITBUCKET_TOKEN`). See [GitHub configuration](#github-configuration) and [Bitbucket configuration](#bitbucket-configuration).
5. **Index approved repos** via CLI or the web Repositories page so the shared catalog is populated.
6. **Tag and curate** with `recommend-tags`, `tag add` / `tag remove`, or the web Tag Catalog so skills are discoverable by domain.
7. **Give developers access** to the deployed web UI URL and, if needed, the CLI pointed at the same `DB_PATH` / deployment.
8. **Publish install conventions**: project path `./.cursor/skills` vs global `~/.cursor/skills`, plus which skill names teams should install.
9. **Refresh periodically** with `npm run pipeline` (re-indexes already-indexed repos) or re-run `skillright index` when skill packs change.

Skillright does not manage org membership or invites; access to the central deployment is controlled by how you host and share the instance.

## How developers use and manage skills

Developers work against the **organization’s deployed registry** (they do not each need to stand up Skillright):

1. **Open the org Skillright web UI** (or use the CLI against the org deployment / shared `DB_PATH`).
2. **Set Current Project** in the top bar / Current Project page so install status is tracked against `{project}/.cursor/skills`.
3. **Browse or search** the Skill Registry; open a skill for Overview, Sources, and Tags.
4. **Install** into the project skills folder (or global `~/.cursor/skills`). Reinstall from the skill detail page or by running `install` again to overwrite.
5. **Watch status** on Current Project: *installed* (matches catalog), *modified* (local differs), *missing* (in catalog but not on disk), *local-only* (on disk but not in the registry).
6. **Copy CLI chips** from skill/repo cards when you prefer the terminal.
7. **Help curate** (when your org allows it): apply recommended tags or add tags so the shared catalog stays useful.

Removing a skill from the registry deletes catalog rows only; it does **not** delete files already under `.cursor/skills`.

## Packages

| Package | Path | Role |
| --- | --- | --- |
| `@skillright/backend` | `packages/backend` | Extraction, SQLite catalog, registry APIs |
| `@skillright/cli` | `packages/cli` | `skillright` CLI for managing the registry |
| `@skillright/web` | `packages/web` | Next.js dashboard (skills, repos, tags, project, CLI docs) |

## How it works

1. Open (or create) the SQLite database.
2. For each target repository, download a zip archive of the configured git **branch** ref.
3. Treat any file named `SKILL.md` as a skill package.
4. Store the skill body, occurrence (host/repo/path), metadata (name, description, version, author, tags, browse link), sibling files in the same directory, and catalog nodes from tags.
5. Query or manage the catalog through the CLI or web UI.

Skills with identical `SKILL.md` content share one `skill_contents` row. Each discovery is a separate occurrence. Re-indexing the same repo path refreshes siblings instead of duplicating the occurrence.

Unsupported hosts (anything other than GitHub or Bitbucket) are rejected.

## Requirements

- Node.js 20+ (with npm)
- Native build tools for [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (the install may need `npm approve-scripts better-sqlite3` if the rebuild is skipped)

## Setup

Use this on the **organization’s central Skillright host** (or for local development of that deployment). From the repo root:

```bash
npm install
cp packages/backend/.env.example packages/backend/.env
npm run build
```

Edit `packages/backend/.env` and add org tokens for private repos, Bitbucket, or higher API limits. A `.env` at the repo root is also loaded if present.

For the web UI, optional overrides go in `packages/web/.env.local` (see `packages/web/.env.example`). The backend still reads `packages/backend/.env` when indexing.

Create the data directory on the host if it does not exist yet:

```bash
mkdir -p ~/.skillright
```

Or set `DB_PATH` to a persistent path on the central host (recommended for production so the registry survives restarts).

### Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DB_PATH` | no | `~/.skillright/skillright.db` | SQLite database file |
| `GITHUB_TOKEN` | **yes for private repos** | unset | GitHub personal access token (`Authorization: token …`) |
| `BITBUCKET_TOKEN` | **yes** | unset | Bitbucket access token (`Authorization: Bearer …`); always required when indexing Bitbucket |
| `DEFAULT_GIT_REF` | no | `main` | Branch used when a repo does not specify one |

Tokens can also be passed per request: CLI `--token`, or the web **Auth Token** field on Repositories.

---

## GitHub configuration

Skillright does **not** use GitHub Apps, OAuth apps, or webhooks. Indexing downloads a branch zip archive over HTTPS.

| Setting | Detail |
| --- | --- |
| Token | Optional for public repos; recommended for private repos and rate limits |
| Env var | `GITHUB_TOKEN` |
| Auth header | `Authorization: token <GITHUB_TOKEN>` |
| Override | CLI `--token` or web Auth Token field |
| Repository URL | Repo root only: `https://github.com/{owner}/{repo}` — not `/tree/…`, blob, or file paths |
| Branch / ref | Branch name (default `DEFAULT_GIT_REF` or `main`) |
| Archive URL | `{repoUrl}/archive/refs/heads/{ref}.zip` |
| Browse link stored | `{repoUrl}/tree/{ref}` |

Examples:

```bash
# Public repo (token optional)
npx skillright index https://github.com/simnova/sharethrift

# Private repo or higher rate limits
npx skillright index https://github.com/acme/skills --ref main --token "$GITHUB_TOKEN"

# Wrong: path after the repo name
npx skillright index 'https://github.com/acme/skills/tree/main'
```

---

## Bitbucket configuration

Bitbucket indexing **always** needs a token (env `BITBUCKET_TOKEN`, CLI `--token`, or the web Auth Token field). Skillright sends it as `Authorization: Bearer …`.

| Setting | Requirement |
| --- | --- |
| Token scope | Atlassian API / access token scope **`read:repository:bitbucket`** (OAuth-style access tokens: **`repository`**) |
| Env var | `BITBUCKET_TOKEN` |
| Auth header | `Authorization: Bearer <token>` |
| Repository URL | Workspace repo root only: `https://bitbucket.org/{workspace}/{repo}` — not a branch browse URL or file path |
| Branch / ref | Branch name (for example `main` or `feature/login`); leading/trailing slashes are ignored |
| Archive URL | `{repoUrl}/get/{ref}.zip` |
| Browse link stored | `{repoUrl}/src/{ref}` |

Examples:

```bash
# Correct
npx skillright index https://bitbucket.org/my-workspace/my-repo --ref main --token "$BITBUCKET_TOKEN"

# Wrong URL (extra path after the repo name)
npx skillright index 'https://bitbucket.org/my-workspace/my-repo/branch/main'

# Branch names may include slashes; leading/trailing slashes are ignored
npx skillright index https://bitbucket.org/my-workspace/my-repo --ref 'feature/login'
npx skillright index https://bitbucket.org/my-workspace/my-repo --ref '/main/'
```

| HTTP status | Typical cause |
| --- | --- |
| **401** | Missing, invalid, or wrong-type token (or missing `read:repository:bitbucket` / `repository` scope) |
| **404** | Wrong workspace/repo URL, wrong branch name, or other bad archive parameters |

Skillright maps these to explicit error messages in the CLI and web UI.

---

## Local skill installation and reinstallation

### Install

`install` writes `SKILL.md` and sibling files under `<dir>/<skill-name>/` (name slugified from metadata; fallback is a short SHA prefix). `~` in paths is expanded.

```bash
# Project-scoped (agents in this repo)
npx skillright install code-review --dir ./.cursor/skills

# Global (agents across projects)
npx skillright install code-review --dir ~/.cursor/skills
```

`export` writes to an **exact** destination directory (no extra skill-name subfolder):

```bash
npx skillright export code-review --dest ./exported/code-review
```

### Reinstall

There is no separate `reinstall` command. Running `install` again overwrites the package directory with the catalog copy.

In the web UI, open a skill → Overview → **Install** or **Reinstall**. If Current Project is set, the default destination is `{project}/.cursor/skills`.

### Current Project (web)

1. Set the project directory in the top bar or **Current Project** page.
2. Skillright treats `{projectDir}/.cursor/skills` as the local skills root.
3. Status is computed by comparing on-disk `SKILL.md` SHA-256 to the catalog:
   - **installed** — matches catalog
   - **modified** — same package found locally but content differs
   - **missing** — in catalog, not on disk
   - **local-only** — on disk, not in the registry

### IDs

Most commands accept a skill **name** (exact, then substring) or a **sha256 prefix** (≥ 7 hex characters).

---

## CLI

Binary: `skillright` (`@skillright/cli`). From the repo root, after `npm run build`:

```bash
npm start -- --help
npx skillright --help
# equivalent
npm run skillright -- --help
```

### Global flags

| Flag | Description |
| --- | --- |
| `--json` | Machine-readable JSON instead of tables/text |
| `--db <path>` | Override SQLite path (also env `DB_PATH`) |
| `-h`, `--help` | Help |

### Commands

| Command | Purpose |
| --- | --- |
| `skillright index <repoUrl> [--ref] [--token]` | Download a GitHub/Bitbucket repo and index `SKILL.md` packages |
| `skillright list [--tag] [--repo] [--author] [--ref]` | List indexed skills (substring filters for repo/author/ref) |
| `skillright search <query> [--limit]` | Search name, description, author, branch, tags, and content (default limit 20) |
| `skillright show <id>` | Show metadata, siblings, and `SKILL.md` |
| `skillright recommend-tags <id> [--limit]` | Suggest catalog tags (reuse existing when they fit; default limit 5) |
| `skillright tag add <id> <tags…>` | Add tags to a skill and attach it to the catalog |
| `skillright tag remove <id> <tags…>` | Remove tags from a skill and prune unused catalog nodes |
| `skillright catalog` | Print the tag catalog tree |
| `skillright repos` | List indexed repositories |
| `skillright stats` | Show registry counts and DB path |
| `skillright export <id> --dest <dir>` | Write `SKILL.md` and siblings to an exact directory |
| `skillright install <id> --dir <path>` | Install into `<path>/<skill-name>/` |
| `skillright remove <id> [--yes]` | Delete a skill from the local registry |
| `skillright remove --repo <repo> [--yes]` | Delete all skills indexed from a repository (keeps skills still present elsewhere) |

### Examples

```bash
# Index
npx skillright index https://github.com/simnova/sharethrift
npx skillright index https://bitbucket.org/my-workspace/my-repo --ref main --token "$BITBUCKET_TOKEN"

# Discover
npx skillright list --author acme --ref main
npx skillright search review --json
npx skillright show code-review
npx skillright repos
npx skillright stats

# Tag
npx skillright recommend-tags code-review
npx skillright tag add code-review quality engineering/code-review
npx skillright tag remove code-review quality
npx skillright catalog

# Install / export / remove
npx skillright export code-review --dest ./exported/code-review
npx skillright install code-review --dir ./.cursor/skills
npx skillright install code-review --dir ~/.cursor/skills
npx skillright remove code-review --yes
npx skillright remove --repo simnova/sharethrift --yes
```

The web app also has a **CLI Guide** sidebar page with the same command reference and copyable examples.

---

## Web UI

The Next.js app in `packages/web` is what organizations typically expose as the central Skillright console. It talks to the same SQLite catalog as the CLI. On the host, build the backend first, then start the UI:

```bash
npm run build -w @skillright/backend
npm run web
```

Locally this is [http://localhost:3000](http://localhost:3000); in an org deployment, share that host’s URL with developers.

| Area | Who typically uses it | What you can do |
| --- | --- | --- |
| **Dashboard** | Org + developers | Soft overview: stats, tagged %, skills-by-tag, recent skills |
| **Current Project** | Developers | Set project dir; filter installed / modified / missing / local-only |
| **Skill Registry** | Developers | Search and filter (tag, repo, author, ref, untagged); open skill detail |
| **Skill detail** | Developers | Overview (install/reinstall), Sources, Tags (add/remove/recommend) |
| **Repositories** | Org registry owners | Index GitHub/Bitbucket; remove repos; copy re-index commands |
| **Tag Catalog** | Org + developers | Walk hierarchical tags; curate discoverability |
| **CLI Guide** | Developers | In-app CLI reference |

Optional UI env vars: `packages/web/.env.example`. Tokens in `packages/backend/.env` on the host are still used when indexing if the form token is empty.

### Bulk re-index pipeline

`packages/backend/src/pipeline.ts` re-indexes **already-indexed** repositories (not a seed list) and prints catalog JSON:

```bash
npm run pipeline
```

---

## Skill packages

A skill is a directory that contains `SKILL.md`. YAML front matter is optional but useful for catalog metadata and tags:

```md
---
name: code-review
description: Review a pull request
version: 1.0.0
author: Acme DX
tags:
  - engineering/code-review
  - quality
---

Instructions for the agent…
```

- Tags may be a YAML list or a comma-separated string.
- `:` in a tag is treated as a path separator (`engineering:testing` → `engineering/testing`).
- Tags are lowercased; path segments become catalog nodes.
- Author and version may also be inferred from the body when front matter omits them.
- `skillright tag add` / `tag remove` update stored metadata and catalog mappings. They do **not** rewrite `SKILL.md` in the source repo.

Sibling files in the same skill directory are stored with the occurrence. Text content is kept for files under 100 KB with common text/code extensions (including `py`, `js`/`jsx`, `ts`/`tsx`, `sh`, `json`, `yaml`/`yml`, `md`/`mdx`, `rs`, `go`, `java`, `dockerfile`, and others). Binary or oversized files are recorded by path/size without body text.

## Database

Default file: `~/.skillright/skillright.db` (WAL journal mode).

| Table | Role |
| --- | --- |
| `skill_contents` | Deduplicated `SKILL.md` body (`sha256` primary key) |
| `skill_occurrences` | Each time that skill was found (host, repo, directory) |
| `skill_metadata` | Front matter plus origin `repo_url`, `repo_ref`, `author`, `repo_link`, tags |
| `catalog_nodes` | Hierarchical tag paths |
| `skill_catalog_mapping` | Skills attached to catalog nodes |
| `skill_siblings` | Other files in the skill directory |
| `app_settings` | App settings such as `project_dir` |

## Project layout

```
packages/backend/src/   catalog library and re-index pipeline
packages/cli/src/       skillright CLI
packages/web/src/       Next.js dashboard (App Router)
tsconfig.base.json      shared TypeScript options
packages/backend/.env.example
packages/web/.env.example
```

Do not add application source at the repo root. Put package source under that package's `src/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, development workflow, and pull request guidelines.

## License

MIT. See [LICENSE](LICENSE).
