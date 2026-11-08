# Portfolio, Toolbox, and Lab visual specification

This is a lightweight shared specification, not a shared runtime package. Each application owns its styles and release lifecycle. Toolbox is the first implementation of the approved light-first direction; this change does not restyle or deploy Portfolio or Lab.

## Foundations

- Self-hosted Instrument Sans for headings, content, and controls; IBM Plex Mono for small technical labels. Include the font licenses with the assets.
- Light appearance by default, with an explicit dark-appearance toggle. Store only the local site's appearance preference; do not couple storage across subdomains.
- Light palette: white `#ffffff`, graphite `#22262b`, secondary text `#626971`, blue-gray accent `#526b7b`, divider `#dfe3e6`.
- Dark palette: background `#101113`, text `#eeeef0`, secondary text `#adb1b8`, accent `#b0bec8`, divider `#353b42`.
- Spacing follows 4, 8, 12, 16, 24, 32, 48, and 64px, with composition-specific spacing where useful.
- Content is constrained to 1280px including desktop gutters. Reading columns remain narrower; future utility workspaces can use the full content width.

## Composition and navigation

Portfolio remains editorial and personal. Toolbox emphasizes practical tasks and concise inputs/outputs. Lab emphasizes research questions, methodology, evidence, and limitations. Use the same typography, accent restraint, and navigation language without copying every layout.

Toolbox currently links to Portfolio and its public GitHub repository. Add Lab navigation when it has a real published destination; do not ship a dead subdomain link or a pretend application. Mark the current destination with `aria-current`.

The Toolbox homepage is server-delivered HTML with progressive appearance controls. All three previous projects are archived. Show an honest empty collection until a working utility is approved; do not add disabled search, empty category navigation, placeholder tools, or archived-project teasers.

## Interaction and accessibility

- Semantic landmarks, a skip link, clear heading hierarchy, and visible focus indicators.
- Native links and buttons with names that remain clear without icons.
- Minimum 44px touch targets on coarse pointers; preserve keyboard navigation and 200% zoom usability.
- Short color/background transitions only when reduced motion is not requested.
- Theme controls are optional enhancement: content and navigation remain usable without JavaScript or storage.
- Theme changes write only `toolbox.theme.v1`. Do not read, migrate, clear, or overwrite historical project data.

## Public metadata

Keep a meaningful title, description, canonical URL, social preview, sitemap, and crawler file. Only working public routes belong in the sitemap. The public output must contain no archived application pages, bundles, or artwork.
