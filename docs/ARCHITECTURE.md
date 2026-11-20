# Architecture

Toolbox is an npm workspace monorepo with a static browser application and a separate generation API. [Vite](../apps/toolbox/vite.config.ts) builds three HTML entry points into root `dist/`: `/`, `/tools/prompt-builder/`, and `/privacy/`. Each route resolves to a real file, including on refresh.

## Browser application

`apps/toolbox` owns the public pages, theme, navigation, metadata, and assets. The homepage uses semantic HTML and a native About disclosure. Prompt Builder mounts a React application from `tools/prompt-builder`.

The editor separates [library transformations and validation](../tools/prompt-builder/src/library.ts) from rendering. It stores groups, context, prompts, and the active draft under `toolbox.prompt-builder.library.v1`. Limits are 100 groups, 500 saved prompts, and 2 MB of serialized data. Invalid data is retained for recovery; failed storage writes are reported. Imports create copies instead of replacing existing groups. Changes in another tab invalidate pending destructive confirmations.

The library has no server synchronization. Export a backup before clearing browser data or moving to another browser. The appearance preference uses a separate key, `toolbox.theme.v1`.

`PromptBuilder` composes focused views for navigation, inputs, output, and dialogs. `usePromptLibrary` owns persistence, recovery, and snapshot-safe confirmations; `useLibraryActions` handles prompt and group changes; `useLibraryBackups` handles import, export, and recovery. `usePromptGeneration` owns private access and cancellable requests. Appearance and navigation protection have independent hooks. A response can replace output only while the same library snapshot remains active and storage is writable.

## Free template generation

The default mode builds a prompt in the browser using [a local template builder](../tools/prompt-builder/src/free-generator.ts). It preserves the idea and included context, adds the selected tone and task category, and formats the result as structured text, concise text, or a checklist. This is template formatting, not an AI rewrite. It makes no network requests and requires no access key. Free output uses `generatedModelId: null`; the existing library schema and backups remain compatible.

Visitors can explicitly select private AI when they have a workbench access key. The mode defaults to free on each page visit, and locking private AI returns to free mode.

## Generation API

`apps/prompt-api` exposes `GET /api/health` and `POST /api/generate`. The browser sends the current idea, selected options, and optional group context. The rest of the library stays local. `packages/prompt-contracts` provides the shared model allowlist and input validation.

Generation requires a private bearer access key. The browser retains it only in memory; the OpenAI credential stays on the server. Exact allowed origins, request validation, a 96 KB body limit, and process-local limits bound access. Defaults allow six generations per minute, 60 per hour, and two concurrent requests. These limits reset on restart and do not impose a spending cap.

The [provider adapter](../apps/prompt-api/src/generator.ts) makes one Responses API request with `store: false`, no reasoning effort, a 1,800-token output limit, and a 45-second timeout. It cancels upstream work when the client disconnects and does not retry automatically. Only complete, nonempty output replaces the draft. Safe errors leave existing text intact.

## Analytics and privacy

All three pages load the optional tracker from `analytics.kristiansalmeron.com`, with site ID `toolbox`. The collector, tracker implementation, PostgreSQL storage, and authenticated reports live in [Portfolio](https://github.com/kriscodes/portfolio). A blocked or failed tracker does not prevent using Toolbox.

Toolbox emits one fixed `tool_action` event when private AI generation is attempted. It contains only `content: prompt-builder` and `action: generate`; it cannot establish whether generation succeeded. Free template generation emits no generation event. Prompt text, generated output, context, names, and access keys are never supplied to analytics. The tracker handles page and link activity; Toolbox does not implement a second pageview collector.

The [privacy page](../apps/toolbox/privacy/index.html) describes collection and provides opt-out controls. The shared tracker honors Global Privacy Control and Do Not Track. Links among Portfolio, Lab, and Toolbox share only the source origin for referral attribution.

## Verification

Prettier and ESLint cover the repository, including React hook usage and effect dependencies. Tests cover library validation and recovery, confirmations, React lifecycle and asynchronous state changes, API authentication and failures, cancellation, and provider transport. The build audit checks published pages, metadata, asset references, and exclusion of server credentials and retired content. Browser checks remain necessary for keyboard interaction, responsive layout, and live analytics controls.
