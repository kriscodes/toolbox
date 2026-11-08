# Toolbox — Kristian Salmeron

Toolbox is the practical developer-utilities part of Kristian's independent Portfolio, Toolbox, and Engineering Lab ecosystem. This repository keeps its existing Vite and TypeScript architecture and Render publish directory.

The public application currently publishes only the Toolbox landing page. Prompt Builder, Family Map, and Home Cameras are archived and do not appear in its navigation, catalog, or public build. New utilities should be listed only when they work; the homepage does not fill categories with planned projects.

## Repository boundaries

| Location | Responsibility |
| --- | --- |
| `apps/toolbox` | Public Vite application, assets, and one HTML entry |
| `archive/2026-11-toolbox` | Preserved earlier workbench, catalog, entry pages, artwork, and local archive configuration |
| `tools/prompt-builder` | Retained archived React editor and browser library |
| `apps/prompt-api` | Retained archived Node AI gateway |
| `packages/prompt-contracts` | Retained prompt model catalog, validation, and types |

All workspaces continue to use one npm lockfile. Portfolio stays in its existing repository; the planned Engineering Lab will have its own repository and independent release lifecycle. There is no shared runtime dependency between these websites.

## Develop and verify

Use Node from `.node-version` and run from the repository root:

```sh
npm ci
npm run dev
```

The current public application does not require an API key, server, database, or authentication. Its build output remains root `dist/`.

```sh
npm run verify
```

Verification runs ESLint, workspace tests, TypeScript checks, and the production browser build. Individual commands remain `npm run lint`, `npm test`, `npm run check`, and `npm run build`. GitHub Actions runs the checks for pull requests and changes to `main`. Use feature branches and pull requests for changes. A production deployment or DNS change requires separate owner approval.

The build also audits the actual public output for metadata, asset references, crawler files, and accidentally included archived material. See the [visual specification](docs/VISUAL-SPECIFICATION.md) and [redesign validation record](docs/TOOLBOX-REDESIGN-VALIDATION.md). Regenerate the committed sharing image from its vector source with `npm run assets:brand`.

The retained suites still check dashboard search/pins/URL behavior, prompt-library recovery and lifecycle, API validation/authorization/failures, cancellation, and provider transport boundaries. Provider calls are injected in tests, so the suite does not require credentials or incur generation charges. Browser and accessibility checks complement these unit tests when changing public interfaces.

Repository conventions continue to require consistent TypeScript imports and purpose-oriented JSDoc on named functions, components, and handlers. Keep data transformations and validation separate from rendering. TypeScript remains on the supported 6.x line for the current ESLint parser; the existing patched `minimatch` override remains in place.

## Archived projects and data

See [the archive guide](archive/2026-11-toolbox/README.md) for local inspection, optional archive builds, original source locations, and browser-library recovery constraints. The [original README](archive/2026-11-toolbox/ORIGINAL-README.md) retains prior setup and operational details.

```sh
npm run dev:archive
npm run test:archive
npm run build:archive
```

The optional archive runs on `127.0.0.1:4175` and builds into its own ignored directory. It has no public route in the normal build. The historical sketches and Manrope font are stored only in the archive; `npm run assets` regenerates those archive assets and does not repopulate the public directory.

No personal library data is migrated, deleted, or uploaded. The original local-storage schema and keys remain unchanged in the retained editor. A local archive is a different browser origin and cannot automatically access existing production-origin libraries; use an exported backup or a deliberate approved same-origin recovery procedure.

## Deployment

The existing public Render configuration remains a repository-root build with `npm ci && npm run build`, publishing `dist`. This change preserves that contract and does not reconfigure a running service. The default browser build emits only the public homepage; it does not emit `/tools/prompt-builder/` or copy archived source/assets.

The existing Prompt API source and service settings are preserved, but the new public homepage does not use that API. Do not remove production credentials, stop services, change DNS, or deploy archive output as part of a frontend-only update. Retirement or public restoration of an archived service is a separate decision.

Before any approved release, run verification, inspect the generated output for excluded archive routes/assets, and validate the deployed homepage, crawler files, metadata, keyboard navigation, and mobile layout. A successful build alone does not verify the live website.
