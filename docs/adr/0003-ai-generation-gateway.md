# ADR 0003: Server-only AI generation gateway

- Date: 2026-11-02
- Status: Accepted

## Context

The browser application is public, but generation uses a private provider account. A provider key cannot be included in a browser bundle. The current tool does not need a multi-user account system.

## Decision

Use a small Node HTTP service for generation. Keep `OPENAI_API_KEY` on the server. Require a separate `PROMPT_BUILDER_ACCESS_KEY` of at least 24 characters as a bearer credential. Retain that workbench key only in browser memory for the visit.

Validate complete requests and exact browser origins. Keep allowed models in [the shared catalog](../../packages/prompt-contracts/src/index.ts), so clients cannot choose arbitrary provider model IDs. Use the Responses API with `store: false`, `reasoning.effort: none`, a 1,800-token output limit, and a 45-second timeout.

Generate a reusable prompt that preserves the idea's actions and constraints. Task presets guide presentation; background context must not add tasks. Accept only complete, nonempty output. Bound input sizes and request rates, cancel upstream work when the client disconnects, and never retry generation automatically. Return safe errors while preserving the existing draft.

## Consequences

The static site and API deploy independently. The API stores no prompt library. A shared access key is a single-owner gate, not a user identity system; anyone with the key can generate until it is rotated. CORS supplements authentication.

The six-per-minute, 60-per-hour, and two-concurrent-request limits are process-local and reset on restart. Scaling to multiple instances requires a shared limiter. These controls do not enforce a monthly spending cap.

`store: false` is a request setting, not a guarantee about every form of provider retention. Only the requested generation content is sent upstream.

## Alternatives

Direct browser calls would expose the provider key. An unauthenticated proxy would expose the generation allowance. A full account and database system adds little value until multiple users or synchronization are required.
