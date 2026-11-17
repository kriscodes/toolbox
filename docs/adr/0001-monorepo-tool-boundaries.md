# ADR 0001: npm workspaces and tool boundaries

- Date: 2026-11-02
- Status: Accepted

## Context

Toolbox needs a public homepage and a stateful prompt editor, with shared types and a separate service for generation. They can be developed together without deploying every workspace independently.

## Decision

Use npm workspaces with one lockfile. `apps/toolbox` owns the public pages and browser entry points, `tools/prompt-builder` owns the React editor, `apps/prompt-api` owns server-side generation, and `packages/prompt-contracts` owns shared validation and the model catalog.

Vite bundles the browser workspaces into root `dist/`. The homepage, Prompt Builder, and privacy page each have an HTML entry point. The API is deployed separately because it holds secrets and receives generation requests.

## Consequences

Shared changes can be tested in one repository. The shell and tools ship together, so changing a tool rebuilds the browser application. The static publish path stays stable and nested refreshes resolve to real files.

A separate repository or deployment per tool would add coordination work at this scale. A shared component package can be introduced when there is enough reuse to justify it.
