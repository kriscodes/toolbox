# ADR 0002: Browser storage for the first prompt library

- Date: 2026-11-02
- Status: Provisional for v1; cross-device storage preference remains open

## Context

Prompt Builder needs groups, reusable project context, editable drafts, and saved prompts. The first version is a personal tool. Device synchronization has not been selected, and no database or recurring database cost has been approved.

## Decision

Persist a versioned library in browser local storage. Keep library transformations and schema validation separate from the React UI. Validate stored and imported data before accepting it, including references between prompts and groups. Store the active draft so a normal refresh does not discard work.

Provide export/import backups. Import groups and prompts as new copies rather than replacing existing records. Preserve malformed stored data for explicit recovery and show storage failures; never report a successful persistent save when the write failed. Destructive navigation and deletion require a clear confirmation when work would be lost.

Project context belongs to a group. Each generation includes that group's current context only when the include-context control is enabled. Existing prompt text is not rewritten when context changes. The browser retains the whole library; the API receives only the current generation input.

## Consequences

The library works without an account or database and has no synchronization service to operate. An API restart cannot lose saved prompts because the API does not own them.

Data is specific to the browser profile and origin. Clearing site data, changing browsers, or losing a device can remove access without an exported backup. Local storage is not encrypted and is accessible to scripts running on the same origin; the Workbench access key protects AI generation, not the local library. The UI must make local-only storage apparent.

For v1, library limits keep storage and import work bounded: 100 groups, 500 saved prompts, and a serialized size limit. These are application limits, not a promise of available browser storage.

## Revisit when

If cross-device synchronization is selected, add authenticated user ownership and durable server storage, then provide a deliberate import path from existing browser libraries. Do not silently upload existing personal context or assume that a shared generation access key establishes separate user accounts.
