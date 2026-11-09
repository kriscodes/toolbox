# Portfolio, Toolbox, and Lab visual direction

Each website owns its styles and release lifecycle. This specification records Toolbox's approved identity; it is documentation, not a shared runtime package. The applications share a clear author identity, restrained interactions, readable typography, and direct navigation while retaining distinct personalities.

## Toolbox: Pine & mint

The approved Toolbox composition is flat and open: horizontal navigation, a large lowercase wordmark with a geometric six-spoke stamp, a short description aligned to the wordmark, quiet publication status, native About disclosure, and an author/source footer. Do not reintroduce a sidebar, central collection card, empty outlined workspace, decorative tool previews, or disabled search/category controls.

- Self-hosted Space Grotesk at weights 400–500 for the wordmark and signature; DM Sans at weights 400–500 for body text, navigation, and controls. Both include their SIL Open Font License files.
- Default light palette: background `#eef3e8`, pine text `#193c30`, secondary text `#526b5e`, divider `#cedacc`, accent `#216b4c`.
- Dark palette: background `#13251d`, text `#e6f3db`, secondary text `#abbeab`, divider `#3a5141`, mint accent `#b7e47d`.
- The stamp, narrow top edge, small signature rule, and links use the accent. Dividers remain quiet; no gradients, surface cards, or filled status badges are needed.
- Desktop gutters scale between 24 and 56px. The page is limited to 1440px; content reflows below 850px, and navigation/status rows adapt below 520px. The wordmark retains its proportions at 320px without truncation.
- Current copy communicates the actual state: no tools are published. All previous projects remain archived; none appears as a teaser or public route.

## Navigation and interaction

Toolbox links to Kristian's Portfolio and public GitHub source. Keep navigation destinations real. Portfolio and Lab have independent implementations and deployment approval; a Toolbox design change does not authorize changing those sites.

The homepage is delivered as semantic HTML. About uses native details/summary and remains usable without JavaScript. Decorative Lucide icons are bundled locally. The theme toggle becomes visible only after it is initialized and uses the same accessible pressed-state contract as the earlier design.

- Preserve a skip-to-main link, landmarks, native tab order, clear heading hierarchy, and visible focus indicators.
- Provide at least 44px targets on coarse pointers and verify reflow at 320px and 200% zoom.
- Respect reduced motion; the only animation is a restrained link-arrow hover transition.
- Default to light with an explicit dark option. Apply a saved theme before paint and keep browser chrome aligned with the page background.
- Write only `toolbox.theme.v1`. Do not read, migrate, clear, upload, or overwrite archived project storage.
- Public content and navigation remain available when JavaScript or browser storage is blocked.

## Assets and metadata

The favicon and sharing image use the same stamp and Pine & mint identity. The sharing image is generated from an editable vector source using the committed local fonts; the generator's cache lives under ignored node_modules.

Preserve the page title, description, canonical URL, social metadata, sitemap, and crawler instructions. The production audit must continue rejecting archived pages, bundles, artwork, API integration code, or storage-clearing operations. The normal build publishes only the current homepage.
