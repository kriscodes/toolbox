# Toolbox

[Toolbox](https://toolbox.kristiansalmeron.com/) is a collection of developer utilities by Kristian Salmeron. Its first tool, Prompt Builder, turns an idea and optional project context into an editable prompt. Groups, drafts, and saved prompts stay in the browser, with export and import for backups.

[![Check](https://github.com/kriscodes/toolbox/actions/workflows/check.yml/badge.svg?branch=main)](https://github.com/kriscodes/toolbox/actions/workflows/check.yml)

## Development

Use the Node version in [`.node-version`](.node-version), then run:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The free template builder formats an idea, optional project context, and selected options into an editable prompt entirely in the browser. Building, editing, and saving free prompts require no account, access key, or API. Optional private AI generation rewrites the idea using a model and requires the [Prompt API setup](docs/DEPLOYMENT.md#local-api-setup) and a private workbench access key.

```sh
npm run verify
```

This runs ESLint, tests, TypeScript checks, the production build, and an audit of the generated public files. CI runs the same checks on pull requests and pushes to `main`. Provider calls are mocked in tests; no API credentials are needed.

## Repository

| Path | Responsibility |
| --- | --- |
| `apps/toolbox` | Vite pages, public assets, and browser entry points |
| `tools/prompt-builder` | React editor and local prompt library |
| `apps/prompt-api` | Node generation API |
| `packages/prompt-contracts` | Shared model catalog, request types, and validation |

The workspaces share one npm lockfile. The browser build writes to `dist/`; the API runs as a separate service. Portfolio and Lab have their own repositories. Optional first-party analytics are provided by Portfolio's Studio Insights service.

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- Decisions: [workspace boundaries](docs/adr/0001-monorepo-tool-boundaries.md), [browser storage](docs/adr/0002-local-prompt-library.md), [generation gateway](docs/adr/0003-ai-generation-gateway.md)

## Assets

Space Grotesk and DM Sans are self-hosted with their [font licenses](apps/toolbox/public/fonts/). Regenerate the sharing image from `artwork/brand/social-preview.svg` with `npm run assets:brand`. Retired designs and tools are available in Git history.
