# Toolbox staging

Import the separate [`render.staging.yaml`](../render.staging.yaml) only after review, in the `kristiansalmeron.com` workspace.

| Resource                     | Configuration                                                  |
| ---------------------------- | -------------------------------------------------------------- |
| `kristian-toolbox-staging`   | Static site at `toolbox.staging.kristiansalmeron.com`          |
| `toolbox-prompt-api-staging` | Separate API in Virginia, `free` compute, `/api/health`        |
| Prompt library               | Browser storage isolated by staging origin; no hosted database |
| Analytics                    | Portfolio's separate staging API/database                      |

`VITE_PROMPT_API_URL` points only to the stage prompt API. `VITE_ANALYTICS_ORIGIN` rewrites the collector script in all three HTML entry points at build time. Keep both values public and secret-free. API `ALLOWED_ORIGINS` contains only the custom staging site. A new access key is generated for staging; supply a separate, limited provider key through Render. Never copy production provider credentials or browser libraries. Missing provider credentials leave private AI unavailable; the free local builder still works.

The free API may sleep, so it is not suitable for comparing warm production latency. Upgrade only if predictable staging availability is needed. Verify all three routes, private-mode access denial, cancelled requests, and the free builder without any API call. A real provider generation incurs usage and is a separate smoke-check decision.

## Promotion workflow

1. Work on a feature/review branch. Open a pull request to `staging` and require the repository's existing CI checks. CI runs on pull requests and pushes to both `staging` and `main`.
2. After initial activation, staging services follow `staging` with `autoDeployTrigger: checksPass`. Wait for the actual deployed revision, then verify the UI, API health, error/denial behavior, and relevant persistence using synthetic data.
3. Promote the reviewed changes through a `staging` → `main` pull request. Require CI again and verify its source tree matches the version reviewed in staging, apart from documented environment settings. If it differs, test that candidate in staging first.
4. Production remains a deliberate promotion to its configured production branch. Do not merge or change a Blueprint while review-only work is pending: Blueprint sync can itself change infrastructure or trigger a build.
5. Retain the previous successful deployment. Roll back application code only after checking database compatibility; application rollback does not roll back database contents. Rehearse restore/migration work on an isolated copy with synthetic fixtures.

## Initial activation — still pending

These commits prepare configuration; no resource, DNS record, remote branch, provider setting, or deployment was changed. Creating a Render service triggers its first deployment even when automatic deployments are off. Activate only after the user reviews the result and asks to deploy.

At activation, create `staging` from the approved source, review the provider's Blueprint plan, confirm workspace/resource names and costs, configure stage-only secrets, and install the exact DNS records Render provides. Set up branch protection separately; workflow files do not create branch protection. Keep Blueprint Auto Sync off during initial wiring and review future configuration syncs explicitly.

Use the custom staging domains for end-to-end checks. `onrender.com` aliases are not automatically included in browser origin allowlists. Staging is public unless separately access-controlled; `X-Robots-Tag: noindex, nofollow, noarchive` discourages indexing but is not authentication. Use synthetic data only.
