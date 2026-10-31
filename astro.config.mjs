// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cordPlayground from "./integrations/cord-playground.mjs";
import designEditor from "./integrations/design-editor.mjs";

export default defineConfig({
  // Published on GitHub Pages, from the repository's sub-folder.
  site: "https://hornedalr.github.io",
  base: "/portfolio/",
  output: "static",
  integrations: [cordPlayground(), designEditor()],
  build: {
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
