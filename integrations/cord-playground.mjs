// Dev-only tooling for tuning the pull cord. Nothing here is included in production builds.
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** @returns {import("astro").AstroIntegration} */
export default function cordPlayground() {
  return {
    name: "cord-playground",
    hooks: {
      "astro:config:setup": ({ command, config, injectRoute, updateConfig, logger }) => {
        if (command !== "dev") return;

        injectRoute({ pattern: "/playground", entrypoint: "./src/dev/playground.astro" });

        const settingsFile = fileURLToPath(new URL("./src/data/cord-settings.json", config.root));

        updateConfig({
          vite: {
            plugins: [
              {
                name: "cord-playground-save",
                configureServer(server) {
                  server.middlewares.use("/__cord/save", async (req, res) => {
                    if (req.method !== "POST") {
                      res.statusCode = 405;
                      res.end();
                      return;
                    }
                    try {
                      let body = "";
                      for await (const chunk of req) body += chunk;
                      const incoming = JSON.parse(body);
                      const current = JSON.parse(await fs.readFile(settingsFile, "utf8"));
                      // Only overwrite keys that already exist, and only with finite numbers.
                      for (const key of Object.keys(current)) {
                        const v = incoming[key];
                        if (typeof v === "number" && Number.isFinite(v)) current[key] = v;
                      }
                      await fs.writeFile(settingsFile, JSON.stringify(current, null, 2) + "\n");
                      logger.info("Saved cord settings to src/data/cord-settings.json");
                      res.setHeader("content-type", "application/json");
                      res.end(JSON.stringify({ ok: true, settings: current }));
                    } catch (err) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ ok: false, error: String(err) }));
                    }
                  });
                },
              },
            ],
          },
        });

        logger.info("Cord playground: /playground");
      },
    },
  };
}
