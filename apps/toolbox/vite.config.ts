import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

// Keep the publish directory stable so the existing Render static site continues to deploy.
export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const environment = loadEnv(mode, root, "VITE_");
  const analyticsOrigin =
    environment.VITE_ANALYTICS_ORIGIN ||
    "https://analytics.kristiansalmeron.com";
  if (
    ![
      "https://analytics.kristiansalmeron.com",
      "https://analytics.staging.kristiansalmeron.com",
      "https://kristian-salmeron-api-staging.onrender.com",
    ].includes(analyticsOrigin)
  ) {
    throw new Error(
      "VITE_ANALYTICS_ORIGIN must identify a reviewed analytics environment.",
    );
  }
  return {
    plugins: [
      {
        name: "analytics-environment",
        transformIndexHtml: {
          order: "pre",
          handler: (html: string) =>
            html.replaceAll(
              "https://analytics.kristiansalmeron.com/analytics-assets/tracker.js",
              `${analyticsOrigin}/analytics-assets/tracker.js`,
            ),
        },
      },
    ],
    envDir: fileURLToPath(new URL("../../", import.meta.url)),
    build: {
      outDir: "../../dist",
      emptyOutDir: true,
      rolldownOptions: {
        input: {
          dashboard: fileURLToPath(new URL("./index.html", import.meta.url)),
          privacy: fileURLToPath(
            new URL("./privacy/index.html", import.meta.url),
          ),
          promptBuilder: fileURLToPath(
            new URL("./tools/prompt-builder/index.html", import.meta.url),
          ),
        },
      },
    },
    server: {
      proxy: {
        "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
      },
    },
  };
});
