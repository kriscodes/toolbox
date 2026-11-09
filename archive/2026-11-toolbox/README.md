# Archived Toolbox workbench — November 2026

Prompt Builder, Family Map, and Home Cameras are archived at the owner's request. They are absent from the public homepage, navigation, and build. This archive preserves working source and browser-data compatibility without providing a public recovery route.

## What is preserved

- `web/` contains the previous dashboard, catalog, Prompt Builder browser entry, original Vite configuration, catalog tests, sketches, Manrope font and license, and favicon. Its historical files were copied from commit `c13d02dda8d596b0e4616f3bbc4eaa7ff44e591c` before the redesign.
- `ORIGINAL-README.md` records the previous development, data, AI, and deployment behavior.
- `prepare-assets.original.mjs` records the old asset-generation script. The active `scripts/prepare-assets.mjs` now writes only into this archive.
- `../../tools/prompt-builder` retains the React editor and local-library transformations in place.
- `../../apps/prompt-api` retains the existing Node generation gateway in place.
- `../../packages/prompt-contracts` retains shared models, validation, and types in place.
- Existing architecture records and prompt-generation evaluation cases remain under the repository's `docs/` directory.

Family Map and Home Cameras were planned project cards, not implemented applications. This archive does not imply that either was a working tool. Prompt Builder remains the retained functional application.

## Local inspection

From the repository root, use Node from `.node-version` and install with `npm ci`. Then run:

```sh
npm run dev:archive
```

Open `http://127.0.0.1:4175/` for the old workbench or `http://127.0.0.1:4175/tools/prompt-builder/` for the retained editor. Saving, editing, and backups work locally without AI credentials. Generation requires the existing API's local configuration and a separate terminal running `npm run dev:api`; it is never needed to inspect the archive or run tests.

```sh
npm run test:archive
npm run build:archive
npx tsc --project archive/2026-11-toolbox/tsconfig.json --noEmit
```

The explicit archive configuration writes its optional build into `archive/2026-11-toolbox/dist/`, which is ignored by Git and ESLint. It does not write into the public root `dist/`. Use `archive/2026-11-toolbox/vite.config.ts`; the original `web/vite.config.ts` is a historical snapshot. The normal public build has one HTML input and does not import or copy the archive. Original catalog tests also run through the public workspace's small archive test entry, alongside the retained prompt-library, client, contract, and API tests.

## Browser data and recovery

No migration, schema change, deletion, or upload of personal library data is included. The retained storage keys are:

| Key | Data |
| --- | --- |
| `toolbox.prompt-builder.library.v1` | Version 1 groups, project context, saved prompts, and current draft |
| `toolbox.pinned-projects.v1` | Previous dashboard pins |

Existing validation, corrupt-data recovery, import-as-copies behavior, storage failure handling, and library limits remain unchanged. The Workbench access key stays in memory for its current visit; no provider credential is stored in these library keys.

Browser storage belongs to an exact origin and browser profile. Hiding the public interface does not clear its production-origin data. The local archive uses a different origin and cannot read that data automatically. It can import a previously exported backup. Accessing existing production-origin data again would require a deliberate, approved same-origin recovery procedure; no public archive route or automatic data transfer has been added. Do not clear the original browser's site data if an unexported library must be recovered.

## Deployment boundary

This change does not modify DNS, credentials, provider settings, or the running Render services. The retained Prompt API is not used by the new public homepage. Its source remains available for local archive use; shutting down or changing the existing production service is a separate operational decision.

Do not deploy the archive output as the public Toolbox. Restoring an archived application to a public route requires an explicit follow-up decision and the normal review and release process.
