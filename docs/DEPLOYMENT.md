# Deployment and operations

Run commands from the repository root using the version in [`.node-version`](../.node-version). [`render.yaml`](../render.yaml) manages both existing Render services and their deployment policy.

The static site includes a free browser template builder that works without API configuration or credentials. It formats the visitor's idea and context locally. The API setup below is only for the optional private AI mode.

## Local API setup

```sh
npm ci
cp apps/prompt-api/.env.example apps/prompt-api/.env
```

Set these values in the copied file:

| Variable                    | Purpose                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`            | Server-only provider credential                                                                       |
| `PROMPT_BUILDER_ACCESS_KEY` | Private random key of at least 24 characters, entered in the workbench                                |
| `ALLOWED_ORIGINS`           | Comma-separated exact browser origins; the example includes local Vite URLs and the production domain |
| `PORT`                      | Local API port; defaults to `3001`                                                                    |

Run `npm run dev:api` and `npm run dev` in separate terminals. Open `/tools/prompt-builder/` on the Vite URL. Vite forwards `/api` to `http://127.0.0.1:3001`. If the browser origin changes, add its exact origin to `ALLOWED_ORIGINS`.

The API scripts load their workspace's ignored `.env` file. Provider and workbench keys belong only in the API environment. `VITE_*` values are public and bundled into browser code.

## Render services

Use the repository root for both services:

| Setting           | Toolbox static site       | Prompt API web service    |
| ----------------- | ------------------------- | ------------------------- |
| Branch            | `main`                    | `main`                    |
| Build             | `npm ci && npm run build` | `npm ci && npm run check` |
| Publish directory | `dist`                    | —                         |
| Start             | —                         | `npm run start:api`       |
| Health check      | —                         | `/api/health`             |
| Node version      | Match `.node-version`     | Match `.node-version`     |

The public site uses `toolbox.kristiansalmeron.com`. Production browser code defaults to `https://toolbox-prompt-api.onrender.com`. To use another API origin, set `VITE_PROMPT_API_URL` on the static site's build environment and rebuild. Supply an HTTPS origin without an API path suffix.

Set the two secret keys on the API service and use `ALLOWED_ORIGINS=https://toolbox.kristiansalmeron.com`. Leave Render's supplied `PORT` in place; the server binds to `0.0.0.0`. There is no prompt-library database or disk to configure. The limiter is process-local, so running multiple API instances would require a shared limiter. Confirm the service's current instance plan in Render rather than inferring it from this code.

The build emits all three public routes as HTML files, so a catch-all rewrite is unnecessary. Studio Insights is a separate Portfolio service; its compatible tracker and collector must be available for analytics to work.

## Release workflow

Use the same process as Portfolio and Lab: create a regular feature branch, review it through `staging`, then promote the tested changes to `main`. GitHub Actions runs `npm run verify` on every pull request and push to `main` or `staging`, with a manual run option. This covers lint, tests, workspace type checks, a production build, and the public-build audit. Render waits for the deployed commit's checks with `autoDeployTrigger: checksPass`; failing checks or zero detected checks block automatic deployment. Do not add workflow path filters that skip CI on deployable commits.

Each service's build filter includes its application, shared packages, dependency lockfile, and runtime/TypeScript configuration. The static site also includes tool source and build scripts. Website-only changes do not deploy the API; API-only changes do not deploy the website. Documentation-only changes run CI without application deploys. Update the filters when introducing new build inputs.

The Blueprint tracks `main` with Auto Sync enabled. Adopt the existing `kristian-toolbox` and `toolbox-prompt-api` services rather than creating replacements. Their current domains, free API plan, and environment values are preserved. `sync: false` entries keep credentials in Render; provide the documented values when creating an entirely new installation.

Blueprint configuration syncs and manual deploys are separate from commit-triggered deployments. Review configuration changes and merge only after PR checks pass. Manual releases are for recovery after verifying the selected commit's checks. After deploying a specific commit, restore **After CI Checks Pass** if Render disabled auto-deploy. Routine releases do not use deploy hooks.

## Verification and maintenance

Before deploying, run `npm run verify`. After deployment, open the homepage, refresh `/tools/prompt-builder/` and `/privacy/`, and check keyboard navigation and mobile layout. Confirm that a visitor can build a free prompt without a key or API request, toggle included context, and save, export, and import synthetic prompts. Check that private AI remains key-protected and that privacy controls work with tracking both enabled and blocked.

`GET /api/health` reports process health and whether credentials are present. It does not verify provider access or billing. When verifying generation, use synthetic content and the workbench key; a real request consumes provider usage. Check each model currently listed in [the shared catalog](../packages/prompt-contracts/src/index.ts). Rotate the workbench key on the API service if it is exposed; it grants generation access, not separate user accounts.

When changing generation instructions, compare live output against requests with explicit coverage, order, exclusions, quantities, and noncoding tasks. The result should preserve those constraints and produce a reusable prompt without performing the task or adding work from background context. Mocked transport tests cannot establish output quality.

For a frontend rollback, redeploy the previous known-good commit. Browser libraries remain tied to their origin and schema; export backups before any storage migration. Regenerate the sharing image with `npm run assets:brand` when its vector source or fonts change.

## Environments

| Service                    | Branch    | Render URL                                      |
| -------------------------- | --------- | ----------------------------------------------- |
| toolbox-prompt-api-staging | `staging` | https://toolbox-prompt-api-staging.onrender.com |
| kristian-toolbox-staging   | `staging` | https://kristian-toolbox-staging.onrender.com   |
| toolbox-prompt-api         | `main`    | https://toolbox-prompt-api.onrender.com         |
| kristian-toolbox           | `main`    | https://kristian-toolbox.onrender.com           |

Production and staging use separate services. Keep staging credentials and data isolated. Run CI on each release candidate, verify the deployed source revision and health endpoints, and retain the previous working deployment for recovery. Documentation-only commits can be excluded by build filters; deploy the checked revision manually when a rebuild is required.
