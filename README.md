# Toolbox

A personal workbench at [toolbox.kristiansalmeron.com](https://toolbox.kristiansalmeron.com): warm charcoal, pencil sketches, and useful tools in one monorepo.

The dashboard lives at `/`. Prompt Builder lives at `/tools/prompt-builder/` and turns a brief into an editable prompt using saved project context. It includes groups, model selection, saved prompts, copy, and backup import/export. Family Map and Home Cameras remain dashboard project cards.

## Repository

| Workspace | Responsibility |
| --- | --- |
| `apps/toolbox` | Vite dashboard, shared public assets, and browser entry points |
| `tools/prompt-builder` | React Workbench interface and local prompt library |
| `apps/prompt-api` | Private-key AI generation gateway using Node HTTP and fetch |
| `packages/prompt-contracts` | Shared model catalog, request types, and input validation |

All workspaces share one npm lockfile. The browser build still produces root `dist/`, preserving the existing Render publish path. New tools should get their own workspace under `tools/`, with an entry point in `apps/toolbox`; they do not need another Git repository or a separate deployment by default.

## Development

Use Node **22.23.4** from `.node-version`, then install from the repository root:

```sh
npm ci
cp apps/prompt-api/.env.example apps/prompt-api/.env
```

Edit `apps/prompt-api/.env` locally:

- `OPENAI_API_KEY`: an OpenAI API key with access to the selected models.
- `PROMPT_BUILDER_ACCESS_KEY`: a private, random access key with at least 24 characters. Enter this key in the Workbench to unlock generation; it is distinct from the OpenAI API key.
- `ALLOWED_ORIGINS`: exact, comma-separated browser origins. The example includes the local Vite origins and the production Toolbox domain.
- `PORT`: defaults to `3001` locally.

The API scripts load that workspace's `.env`. It is ignored by Git. Never place secrets in a `VITE_*` variable: those values are bundled into browser code.

Run these in separate terminals:

```sh
npm run dev:api
```

```sh
npm run dev
```

Open the URL printed by Vite, then launch Prompt Builder from the dashboard. Vite forwards `/api` to port `3001`. If using another browser origin or port, add its exact origin to the API's allowed list. Without API credentials, editing and local saving still work; generation reports that setup is required.

## Checks and conventions

```sh
npm run verify
```

This runs ESLint, workspace tests, TypeScript checks, and the production browser build. Individual commands are `npm run lint`, `npm test`, `npm run check`, and `npm run build`. CI runs lint, tests, and the build for pull requests and changes to `main`.

TypeScript stays on the supported 6.x release line for the current ESLint parser. A root override keeps the lint tools' `minimatch` dependency on patched 11.0.1; remove the override once their declared dependencies include that fix.

Tests focus on request validation, API authorization and failure behavior, local library integrity, and existing dashboard behavior. Provider calls are injected in tests, so the suite does not require an API key or incur generation charges. A live provider smoke check is a separate deployment step.

Document every function's purpose and important behavior. Use JSDoc for named functions, components, and handlers, and explain non-obvious callbacks close to their implementation. Comments should clarify boundaries and failure handling rather than repeat the function name. Keep validation and library transformations separate from rendering so they can be tested directly.

## Data and AI behavior

Groups, project context, saved prompts, and the current draft are stored in the current browser. They do not sync across devices. Export backups before changing browsers or clearing site data. Imports create copies instead of replacing existing groups. Invalid saved data is retained for recovery, and storage failures are shown in the interface.

Only the current idea, selected options, and optionally the current group's context are sent for generation. Other groups and saved prompts stay in the browser. The Workbench access key stays in memory for the current visit; the OpenAI key stays on the API server. Generated text remains editable before saving or copying.

The initial catalog contains **GPT-6 Luna** and **GPT-5.4 Mini**, with Luna selected by default. Requests use the Responses API with `reasoning.effort: none`, `store: false`, and at most 1,800 output tokens. The API allows six generations per minute, 60 per hour, and two concurrent generations. These process-local limits reset on restart and are **not a monthly spending cap**. No automatic retry can silently cause another generation charge.

## Render

Both services use the **kristiansalmeron.com** workspace and the same repository, built from its root.

| Setting | Toolbox static site | Prompt API web service |
| --- | --- | --- |
| Branch | `main` | `main` |
| Build | `npm ci && npm run build` | `npm ci && npm run check` |
| Publish directory | `dist` | — |
| Start | — | `npm run start:api` |
| Health path | — | `/api/health` |
| Node | `22.23.4` | `22.23.4` |

The existing static site is `kristian-toolbox` (`srv-dbklj4u7bikc73doopvg`), serving `toolbox.kristiansalmeron.com`. Its two browser pages are emitted as actual HTML files, so a catch-all rewrite is unnecessary.

On the static site, set `VITE_PROMPT_API_URL` to the API's HTTPS origin, with no path suffix, then rebuild. On the API service, configure the two server secrets and set `ALLOWED_ORIGINS=https://toolbox.kristiansalmeron.com`. Add another origin only when that exact browser address should be allowed. Leave Render's supplied `PORT` in place; the server binds to `0.0.0.0`.

The API can use a free web service because it does not persist data. A free instance may sleep when idle, making its next request slower. `/api/health` checks the process and reports whether credentials are configured; it does not call OpenAI or verify provider billing/model access. After both services deploy, check the page, refresh its nested URL, and make an authorized generation with each model. Deployment should not be considered complete merely because a deploy request was accepted.

## Artwork and decisions

AI-generated pencil sketches and generation notes are retained in `artwork/source/`. Optimized WebP images and the self-hosted Manrope font are committed under `apps/toolbox/public/`, including the font license. Regenerate them with `npm run assets`.

Architecture decision records:

- [0001 — npm workspaces and tool boundaries](docs/adr/0001-monorepo-tool-boundaries.md)
- [0002 — Browser storage for the first prompt library](docs/adr/0002-local-prompt-library.md)
- [0003 — Server-only AI generation gateway](docs/adr/0003-ai-generation-gateway.md)
