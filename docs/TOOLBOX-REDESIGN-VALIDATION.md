# Toolbox redesign validation

Review date: November 8, 2026. Base: `c13d02dda8d596b0e4616f3bbc4eaa7ff44e591c`.

## Resulting behavior

The public site is a light-first landing page with an optional dark appearance and an honest empty collection. Prompt Builder, Family Map, and Home Cameras have no public listings, pages, artwork, or application bundles in the build. No replacement utilities or empty categories were introduced.

The original workbench is preserved in `archive/2026-11-toolbox/`. The Prompt Builder editor, generation API, shared contracts, storage keys, and npm lockfile are unchanged. The optional archive has its own development configuration and output directory.

## Automated checks

Checked using Node 22.23.4:

- ESLint: passed with no warnings.
- All 55 tests: passed (17 API/generator, 9 web/archive/appearance, 21 editor/client/library, 3 contracts, 5 public-output audit regressions).
- TypeScript checks for all workspaces: passed.
- Public Vite production build: passed.
- Public build audit: passed; 11 files and 6 referenced resources. Checks cover metadata, static readable content, crawler files, missing resources, retired routes/artwork/API code, and storage clearing.
- Optional archive build, archive type check, and three preserved catalog tests: passed.
- `git diff --check`: passed.

Appearance tests execute the actual HTML bootstrap and theme controller against controlled storage and DOM doubles. They cover appearance before module initialization, toggle/reload persistence, cross-tab changes, unavailable storage, and exact preservation of both valid and malformed historical library/pin values. Only the new `toolbox.theme.v1` key is accessed.

Provider tests inject mocked calls. No paid generations or production API changes were performed.

## Browser review

Local browser checks covered 1280px desktop, 768px tablet, and 390px/320px mobile layouts. No horizontal document overflow was observed. Light and dark appearances, persistence after reload, navigation destinations, and keyboard skip-to-main behavior were checked. Browser error/warning logs were empty during the review. Public content and navigation are delivered directly in HTML; the appearance control is hidden until JavaScript initializes.

These checks are not a claim of a complete WCAG audit or cross-browser certification. Additional screen-reader and device checks can be included before an approved production release.

![Desktop preview](previews/toolbox-desktop.jpg)

## Release boundary

This work is for feature-branch and pull-request review. It does not deploy a site, merge to main, change DNS, stop the existing API service, or change any credentials. Production browser data remains on its original origin; the recovery guide explains why an optional local archive cannot automatically read it.
