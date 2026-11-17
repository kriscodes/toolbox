# ADR 0002: Browser storage for the prompt library

- Date: 2026-11-02
- Status: Accepted for the current single-browser library

## Context

Prompt Builder needs groups, reusable context, drafts, and saved prompts. These features should work without an account or server connection. Cross-device synchronization is outside the current scope.

## Decision

Persist a versioned library in local storage. Validate stored and imported data, including relationships between prompts and groups. Save the active draft. Keep transformations and validation separate from the React UI.

Provide export/import backups. Import records as new copies; preserve malformed data for recovery and report storage failures. Confirm actions that would discard work. Include a group's context in generation only when the corresponding control is enabled. The API receives the current generation input, never the entire library.

## Consequences

There is no library database or synchronization service to operate. API restarts cannot remove browser-local prompts.

Data belongs to one browser profile and origin. Clearing site data or losing a device can remove access without a backup. Local storage is not encrypted and can be read by scripts on the same origin. The workbench key protects generation, not stored prompts.

Application limits bound the library to 100 groups, 500 prompts, and 2 MB of serialized data; available browser storage may be lower. Future synchronization would require authenticated ownership and an explicit migration, rather than silently uploading existing libraries.
