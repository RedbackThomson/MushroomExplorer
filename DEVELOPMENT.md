# Development

Guidance for working on Mushroom Game Explorer itself. For a user-facing overview, see [README.md](README.md). For the rules every change must follow, see [CLAUDE.md](CLAUDE.md).

## Requirements

- Node.js 20+ and [pnpm](https://pnpm.io/) 9+
- Or [Nix](https://nixos.org/) with flakes enabled (recommended — pins the full toolchain)

## Quickstart

```bash
pnpm install
pnpm dev
```

Then open the printed URL.

### Nix users

A flake is provided. With Nix + flakes enabled:

```bash
nix develop
pnpm install
pnpm dev
```

Or, with [direnv](https://direnv.net/) installed, `direnv allow` will load the dev shell automatically.

All scripts in this repo are expected to run inside the flake dev shell. If you're not using direnv, prefix commands with `nix develop -c`, e.g. `nix develop -c pnpm typecheck`.

## Scripts

| Script           | What it does                               |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | Start the Vite dev server for the web app. |
| `pnpm build`     | Production build.                          |
| `pnpm preview`   | Preview the production build locally.      |
| `pnpm typecheck` | Run TypeScript in all packages.            |
| `pnpm lint`      | Run ESLint in all packages.                |
| `pnpm test`      | Run Vitest in all packages.                |
| `pnpm format`    | Format the repo with Prettier.             |

## Layout

```
apps/web/        Vite + React + TS app (the wiki UI)
packages/        Shared libraries (parser, extractors, db, search)
docs/            Product and technical requirements
```

The source of truth for product scope is [`docs/mapleroyals_wiki_clone_requirements.md`](docs/mapleroyals_wiki_clone_requirements.md). Technical decisions live in [`docs/technical_requirements.md`](docs/technical_requirements.md). Command palette extension is covered in [`docs/command_palette_extension_guide.md`](docs/command_palette_extension_guide.md).

## Reporting parser issues

If something goes wrong loading WZ files, open the **Parser debug** page in the sidebar and click **Copy log**. That captures the parser's log buffer (main thread + worker), the AES smoke-test result, and minimal environment info. Paste that into your GitHub issue along with what you tried.

For extra verbosity, set `localStorage.setItem('mge.debug', '1')` in the browser console before reproducing — that enables debug-level entries that are otherwise filtered out of the console (they're always captured in the buffer).

## Status

Pre-alpha. See [`docs/technical_requirements.md`](docs/technical_requirements.md) for the phase plan.
