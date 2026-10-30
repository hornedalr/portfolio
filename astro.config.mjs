// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cordPlayground from "./integrations/cord-playground.mjs";

export default defineConfig({
  output: "static",
  integrations: [cordPlayground()],
  build: {
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
