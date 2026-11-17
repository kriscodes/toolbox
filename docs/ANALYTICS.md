# Studio Insights integration

Toolbox loads the optional first-party script at `https://analytics.kristiansalmeron.com/analytics-assets/tracker.js`. The collector, versioned event validation, authentication, PostgreSQL migrations, and reports are owned by `kriscodes/portfolio`. This repository retains its current static build, hosting settings, and existing local data.

## Release contract

Deploy the compatible Portfolio analytics API and tracker before releasing this integration. Keep the static site's existing build/publish configuration. Do not deploy the Prompt API or alter its credentials for an analytics-only change. The site marker is `toolbox`; the tracker accepts only known owned domains and fixed site routes. Referrer policy on the script is `no-referrer`. Links among the exact Portfolio, Lab, and Toolbox hosts use `referrerpolicy="origin"`, sharing only the source origin (never its path, query, or fragment) for first-party arrival attribution. External links keep their existing policy. A failed or blocked script never blocks the website. Browser navigation is tracked by the common runtime; do not add a second pageview collector.

New metrics start only after both collector and site integration are deployed. Earlier visits cannot be backfilled. Verify the source revision and live delivered scripts before describing a site as connected. No production deployment is implied by this document.

## Collection boundaries

The runtime records sanitized approved page paths, coarse device category, recognized source/campaign labels, page-instance IDs, cumulative active-time snapshots, scroll milestones, and relevant fixed link destinations. It never sends query strings, fragments, arbitrary DOM text, form values, prompt or tool content, access keys, names, or email addresses. Unknown sources remain unknown. Outbound/contact clicks are clicks, not completed contacts.

Active time counts visible time until 60 seconds after recent activity (including initial reading), with cumulative snapshots every 15 seconds. Hidden tabs pause; timer gaps over 20 seconds are discarded. This estimates attention, not proof of reading. Scroll emits each 25/50/75/100 milestone at most once per page instance; short non-scrollable pages produce no milestone. Retries keep occurrence timestamps and event IDs. Blocked requests and browser lifecycle limits can lose observations.

Daily random IDs and 30-minute-inactivity visit IDs use Secure SameSite cookies on `kristiansalmeron.com` where supported; both rotate at America/Los_Angeles midnight. They are hashed by the collector before storage. This can connect Portfolio, Lab, and Toolbox visits but does not follow unrelated websites or support returning-person claims. With cookies unavailable the runtime falls back to site-local or in-memory measurement, labeled unmatched/limited. Multiple tabs and delayed observations make ordered paths and last observed exits estimates.

## Privacy controls and retention

The `/privacy/` notice is linked from the site footer. `?analytics_opt_out=1` excludes this browser; `?analytics_opt_out=0` allows analytics unless Global Privacy Control or Do Not Track still disables it. A nonidentifying preference cookie lasts up to one year; the local preference remains until changed or cleared. Privacy signals are checked before collection and sending. Opt-out clears this origin's queue and IDs. Other origins cannot access each other's local storage; they purge their queues on their next shared-preference check. Each browser/device needs its own setting, and cookie restrictions can prevent sharing across subdomains. JavaScript is required to change the preference; no analytics events are sent when JavaScript or the tracker is blocked.

The bounded first-party outbox holds at most 100 events for 24 hours. Raw events are retained for 180 days in the existing private PostgreSQL database; database backups follow the hosting provider's separate retention. Reports remain owner-authenticated. Infrastructure still processes ordinary HTTP metadata to serve the sites.

## Verification

Run the repository's complete verification command. Test a known page, internal navigation, an outbound GitHub or ecosystem link, hidden/idle timing, milestone scrolling, opt-out and opt-in, GPC/DNT, and blocked storage against a local collector. Test across the actual production subdomains after release because localhost does not establish domain-cookie behavior. Never use personal content or a paid generation request just to test analytics.

## Toolbox catalog

Known routes are `/` and `/tools/prompt-builder`. The fixed tool identifier is `prompt-builder`. The tool calls `StudioInsights.track('tool_action', { content: 'prompt-builder', action: 'generate' })` only after required-input/access checks and replacement confirmation, immediately before requesting generation. It has no arguments drawn from the editor and never reads form content. This is a generation attempt, not a successful result. `/privacy` is excluded from pageview collection. Prompt generation separately sends requested tool content through the existing Prompt API; that operation is not analytics.
