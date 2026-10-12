# Contributing to Skillright

Thanks for helping improve Skillright. This guide covers how to set up the monorepo, make changes, and open a pull request.

## Ways to contribute

- Fix bugs or improve error messages in the CLI, backend, or web UI
- Indexing, catalog, or search behavior for GitHub/Bitbucket skill repos
- Dashboard UX for browsing, tagging, installing, or managing skills
- Docs, examples, and skill-package conventions
- Tests and type-safety improvements

If you are unsure whether an idea fits, open an issue first and describe the problem or proposal.

## Requirements

- Node.js 20+ and npm
- Native build tools for [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)
  - If the native rebuild is skipped during install, you may need `npm approve-scripts better-sqlite3`

## Setup

From the repository root:

```bash
npm install
cp packages/backend/.env.example packages/backend/.env
npm run build
```

Optional: copy `packages/web/.env.example` to `packages/web/.env` if you need UI-specific overrides.

Edit `packages/backend/.env` for private repos or higher API limits. A `.env` at the repo root is also loaded if present.

Create the default data directory if needed:

```bash
mkdir -p ~/.skillright
```

Or set `DB_PATH` to a SQLite file in a directory you already have.

See [README.md](README.md) for environment variables, CLI commands, and skill package format.

## Monorepo layout

| Package | Path | Role |
| --- | --- | --- |
| `@skillright/backend` | `packages/backend` | Extraction, SQLite catalog, registry APIs |
| `@skillright/cli` | `packages/cli` | `skillright` CLI |
| `@skillright/web` | `packages/web` | Next.js dashboard |

Source layout rules:

- Put application source under each package’s `src/` directory
- Do not add application source at the repo root or a package root
- Shared TypeScript options live in `tsconfig.base.json`; packages extend it
- Compiled output goes to each package’s `dist/`
- Workspace and tooling config stay at the repo root; package-specific config stays in that package

```
packages/backend/src/   catalog library and sample pipeline
packages/cli/src/       skillright CLI
packages/web/src/       Next.js dashboard (App Router)
```

## Development workflow

### Build and typecheck

```bash
npm run build
npm run typecheck
```

Build order matters for consumers of `@skillright/backend`: build the backend before the CLI or web app when you change shared APIs.

```bash
npm run build -w @skillright/backend
npm run build -w @skillright/cli
npm run build -w @skillright/web
```

### CLI

```bash
npm run build -w @skillright/backend
npm run build -w @skillright/cli
npx skillright --help
# or
npm start -- --help
```

Useful smoke checks after catalog changes:

```bash
npx skillright stats
npx skillright search <query>
npx skillright show <id>
```

Use `--json` for machine-readable output and `--db <path>` to point at a throwaway database while developing.

### Web UI

```bash
npm run build -w @skillright/backend
npm run web
```

Open [http://localhost:3000](http://localhost:3000). The UI uses the same SQLite catalog as the CLI (`DB_PATH`, default `~/.skillright/skillright.db`).

### Sample pipeline

```bash
npm run pipeline
```

## Coding guidelines

- Prefer small, focused changes that match existing naming and structure
- Keep TypeScript strict and avoid `any` unless there is a clear reason
- Backend and CLI are ESM (`"type": "module"`); follow existing import style
- Web UI uses Next.js App Router under `packages/web/src/app/`
- Do not commit secrets, local `.env` files, or personal SQLite databases
- Update README or this guide when behavior or setup steps change

There is no dedicated test runner or linter config in the repo yet. At minimum, run `npm run typecheck` (and exercise the CLI or UI path you touched) before opening a PR. New tests are welcome.

## Pull requests

1. Fork the repo (or create a branch if you have write access).
2. Create a branch named for the change, for example `fix/catalog-dedupe` or `feat/tag-search`.
3. Make your changes under the relevant package `src/` tree.
4. Run `npm run typecheck` and manually verify the affected CLI commands or UI flows.
5. Open a pull request with:
   - A short summary of **why** the change is needed
   - What you changed
   - How you tested it
   - Screenshots for UI changes when helpful

Keep PRs focused. Separate refactors from behavior changes when practical.

### Commit messages

Use clear, imperative subjects. Prefer conventional prefixes when they fit:

- `feat:` new user-facing capability
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` internal cleanup with no intended behavior change
- `chore:` tooling or maintenance

Example: `fix: refresh siblings on re-index instead of duplicating occurrences`

## Reporting issues

Include:

- Skillright version / commit if known
- Node.js and OS versions
- Exact command or UI steps
- Expected vs actual behavior
- Relevant logs (redact tokens and private repo URLs)

## License

By contributing, you agree that your contributions are licensed under the MIT License. See [LICENSE](LICENSE).
