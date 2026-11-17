# Deployment and operations

Run commands from the repository root using the version in [`.node-version`](../.node-version). Render settings are maintained on the services; this repository does not contain a Render Blueprint.

## Local API setup

```sh
npm ci
cp apps/prompt-api/.env.example apps/prompt-api/.env
```

Set these values in the copied file:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-only provider credential |
| `PROMPT_BUILDER_ACCESS_KEY` | Private random key of at least 24 characters, entered in the workbench |
| `ALLOWED_ORIGINS` | Comma-separated exact browser origins; the example includes local Vite URLs and the production domain |
| `PORT` | Local API port; defaults to `3001` |

Run `npm run dev:api` and `npm run dev` in separate terminals. Open `/tools/prompt-builder/` on the Vite URL. Vite forwards `/api` to `http://127.0.0.1:3001`. If the browser origin changes, add its exact origin to `ALLOWED_ORIGINS`.

The API scripts load their workspace's ignored `.env` file. Provider and workbench keys belong only in the API environment. `VITE_*` values are public and bundled into browser code.

## Render services

Use the repository root for both services:

| Setting | Toolbox static site | Prompt API web service |
| --- | --- | --- |
| Branch | `main` | `main` |
| Build | `npm ci && npm run build` | `npm ci && npm run check` |
| Publish directory | `dist` | — |
| Start | — | `npm run start:api` |
| Health check | — | `/api/health` |
| Node version | Match `.node-version` | Match `.node-version` |

The public site uses `toolbox.kristiansalmeron.com`. Production browser code defaults to `https://toolbox-prompt-api.onrender.com`. To use another API origin, set `VITE_PROMPT_API_URL` on the static site's build environment and rebuild. Supply an HTTPS origin without an API path suffix.

Set the two secret keys on the API service and use `ALLOWED_ORIGINS=https://toolbox.kristiansalmeron.com`. Leave Render's supplied `PORT` in place; the server binds to `0.0.0.0`. There is no prompt-library database or disk to configure. The limiter is process-local, so running multiple API instances would require a shared limiter. Confirm the service's current instance plan in Render rather than inferring it from this code.

The build emits all three public routes as HTML files, so a catch-all rewrite is unnecessary. Studio Insights is a separate Portfolio service; its compatible tracker and collector must be available for analytics to work.

## Verification and maintenance

Before deploying, run `npm run verify`. After deployment, open the homepage, refresh `/tools/prompt-builder/` and `/privacy/`, and check keyboard navigation and mobile layout. Confirm that saving, exporting, and importing synthetic prompts work without the API. Check privacy controls with tracking both enabled and blocked.

`GET /api/health` reports process health and whether credentials are present. It does not verify provider access or billing. When verifying generation, use synthetic content and the workbench key; a real request consumes provider usage. Check each model currently listed in [the shared catalog](../packages/prompt-contracts/src/index.ts). Rotate the workbench key on the API service if it is exposed; it grants generation access, not separate user accounts.

When changing generation instructions, compare live output against requests with explicit coverage, order, exclusions, quantities, and noncoding tasks. The result should preserve those constraints and produce a reusable prompt without performing the task or adding work from background context. Mocked transport tests cannot establish output quality.

For a frontend rollback, redeploy the previous known-good commit. Browser libraries remain tied to their origin and schema; export backups before any storage migration. Regenerate the sharing image with `npm run assets:brand` when its vector source or fonts change.
