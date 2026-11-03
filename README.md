# Toolbox

A personal workbench at [toolbox.kristiansalmeron.com](https://toolbox.kristiansalmeron.com). Warm charcoal, pencil sketches, and a small shelf of projects.

One repository, one Vite + TypeScript application. No server or database is needed for the dashboard.

## Development

Use Node 22.23.4 (see `.node-version`).

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Search and group filters work together. Pins are saved in the current browser. Project cards show a short detail view; an external launch link appears only after a real HTTPS `url` is added to the project in `src/catalog.ts`.

The initial projects are Prompt Builder, Family Map, and Home Cameras. Their cards track plans; the tools themselves are separate future work.

## Artwork

AI-generated pencil sketches are retained in `artwork/source/` with their generation notes. Optimized WebP images and the self-hosted Manrope font are committed under `public/` so deployment does not regenerate them. Manrope's license is included alongside the font.

To regenerate the delivered assets:

```sh
npm run assets
```

## Render

Deploy as a static site in the **kristiansalmeron.com** workspace:

- Branch: `main`
- Build: `npm ci && npm run build`
- Publish directory: `dist`
- Node version: `22.23.4`
- Custom domain: `toolbox.kristiansalmeron.com`

The dashboard uses a single page and does not require a catch-all route rewrite. No API keys or environment secrets are needed. Future commits to `main` deploy automatically.
