# ADR 0003: Server-only AI generation gateway

- Date: 2026-11-02
- Status: Accepted

## Context

Prompt Builder needs real AI generation and a small choice of quick models. The dashboard is publicly reachable. Putting an OpenAI API key in its browser bundle would expose paid generation access, while operating a full account system would expand the first version's scope.

## Decision

Add a small Node HTTP service that calls the OpenAI Responses API. Keep `OPENAI_API_KEY` in server environment variables. Require a separate private `PROMPT_BUILDER_ACCESS_KEY`, at least 24 characters long, on every generation request. The browser sends this as a bearer credential and retains it only in memory for the current visit. It is not the provider API key and must not be embedded in frontend configuration.

Restrict browser origins to exact configured origins and validate the complete input on the server. Share a fixed model catalog through `packages/prompt-contracts`; clients cannot supply arbitrary provider model IDs.

Initial choices, verified against official documentation on 2026-11-02:

| Model | API identifier | Purpose |
| --- | --- | --- |
| GPT-6 Luna | `gpt-6-luna` | Default quick option |
| GPT-5.4 Mini | `gpt-5.4-mini-2026-03-17` | Compact alternative |

Both support `reasoning.effort: none`, selected explicitly for prompt construction. Use `store: false`, a maximum of 1,800 output tokens, and a 45-second provider timeout. Ask the model to produce the reusable prompt rather than execute the user's underlying task. Only complete, nonempty provider output is accepted.

Bound body size, text lengths, generation rate, and concurrent requests. Abort the provider request when the client disconnects. Do not automatically retry generations, log private input, or return raw upstream errors. Provide safe errors that allow the UI to preserve the user's existing draft.

## Consequences

The static site can remain on Render's CDN. The API can run on one free web instance because it stores no library data. Free-instance cold starts can delay the first request after inactivity.

The access key is a single-owner gate, not a multi-user identity system. CORS supplements that gate and does not replace authentication. Anyone who obtains the access key can invoke generation until it is rotated.

The six-per-minute, 60-per-hour, and two-concurrent-request limits are process-local and reset when the API restarts. They reduce accidental bursts but do not enforce a monetary or monthly budget. Multiple instances would require a shared limiter. Provider account limits and billing remain separate operational settings.

`store: false` disables Responses API response storage; it is not a claim of zero provider retention under every account policy. The library is not sent wholesale to the provider.

## Alternatives

Direct browser calls would expose the provider credential. An unrestricted public proxy would expose the owner's API allowance. A full sign-in and database system is deferred until synchronization or multiple users creates a need for it.

## Sources

- [GPT-6 Luna model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [GPT-5.4 Mini model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [Responses text generation](https://developers.openai.com/api/docs/guides/text)

The catalog is intentionally centralized so models can be replaced when availability changes. Deprecated GPT-5.4 Nano is excluded from the first version.
