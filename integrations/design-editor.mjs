// Dev-only design editor endpoints: save palette colours to global.css and replace pictures in src/assets.
// Nothing here is included in production builds.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HEX = /^#[0-9a-f]{6}$/i;
const TOKEN = /^--color-[a-z]+(?:-\d+)?$/;
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
// The pull cord picks these up automatically when present (see PullCord.astro).
const BALL_FILES = new Set(["cord-ball.png", "cord-ball-dark.png"]);

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
};

/** @returns {import("astro").AstroIntegration} */
export default function designEditor() {
  return {
    name: "design-editor",
    hooks: {
      "astro:config:setup": ({ command, config, updateConfig, injectScript, logger }) => {
        if (command !== "dev") return;

        injectScript("page", 'import "/integrations/design-editor-client.js";');

        const root = fileURLToPath(config.root);
        const cssFile = path.join(root, "src", "styles", "global.css");
        const assetsDir = path.join(root, "src", "assets");

        /** Updates or adds `--color-*: #hex;` declarations inside the @theme block. */
        const saveColors = async (colors) => {
          let css = await fs.readFile(cssFile, "utf8");
          const eol = css.includes("\r\n") ? "\r\n" : "\n";
          const added = [];
          for (const [token, hex] of Object.entries(colors)) {
            if (!TOKEN.test(token) || typeof hex !== "string" || !HEX.test(hex)) throw new Error(`Bad colour ${token}: ${hex}`);
            const decl = new RegExp(`(${token.replace(/-/g, "\\-")}\\s*:\\s*)[^;]+;`);
            if (decl.test(css)) css = css.replace(decl, `$1${hex.toLowerCase()};`);
            else added.push(`  ${token}: ${hex.toLowerCase()};`);
          }
          if (added.length) css = css.replace(/@theme\s*\{/, (m) => `${m}${eol}${added.join(eol)}`);
          await fs.writeFile(cssFile, css);
        };

        /** Resolves a dev image URL path to a file inside src/assets, refusing anything else. */
        const resolveAsset = (file) => {
          const abs = path.resolve(root, file.replace(/^\/@fs\//, "").replace(/^\//, ""));
          const rel = path.relative(assetsDir, abs);
          if (rel.startsWith("..") || path.isAbsolute(rel) || !IMAGE_EXT.has(path.extname(abs).toLowerCase())) {
            throw new Error(`Not an image in src/assets: ${file}`);
          }
          return abs;
        };

        /** Writes an uploaded picture over an existing asset, cropped to the old picture's proportions. */
        const replaceImage = async (target, data) => {
          const ext = path.extname(target).toLowerCase();
          const isBall = BALL_FILES.has(path.basename(target)) && path.dirname(target) === assetsDir;
          let img = sharp(data, { failOn: "error" }).rotate();
          if (isBall) {
            img = img.trim().resize({ width: 512, withoutEnlargement: true });
          } else {
            const old = await sharp(target).metadata();
            const meta = await sharp(data).rotate().metadata();
            const width = Math.max(old.width, Math.min(meta.width ?? old.width, 2400));
            img = img.resize({ width, height: Math.round((width * old.height) / old.width), fit: "cover" });
          }
          img = ext === ".png" ? img.png() : ext === ".webp" ? img.webp({ quality: 90 }) : img.jpeg({ quality: 90 });
          await fs.writeFile(target, await img.toBuffer());
        };

        updateConfig({
          vite: {
            plugins: [
              {
                name: "design-editor-save",
                configureServer(server) {
                  // import.meta.glob results are cached in the SSR module graph, so adding or removing a
                  // ball picture needs a full invalidation before the page can see it.
                  const refreshBall = (file) => {
                    if (path.dirname(file) !== assetsDir || !BALL_FILES.has(path.basename(file))) return;
                    server.moduleGraph.invalidateAll();
                    server.ws.send({ type: "full-reload" });
                  };
                  server.watcher.on("add", refreshBall);
                  server.watcher.on("unlink", refreshBall);

                  server.middlewares.use("/__design/colors", async (req, res) => {
                    if (req.method !== "POST") return send(res, 405, { ok: false });
                    try {
                      const colors = JSON.parse((await readBody(req)).toString("utf8"));
                      await saveColors(colors);
                      logger.info(`Saved ${Object.keys(colors).length} colour(s) to src/styles/global.css`);
                      send(res, 200, { ok: true });
                    } catch (err) {
                      send(res, 400, { ok: false, error: String(err) });
                    }
                  });

                  server.middlewares.use("/__design/image", async (req, res) => {
                    const url = new URL(req.url ?? "", "http://localhost");
                    const ball = url.searchParams.get("ball");
                    if (req.method === "DELETE" && ball) {
                      const target = path.join(assetsDir, ball === "dark" ? "cord-ball-dark.png" : "cord-ball.png");
                      await fs.rm(target, { force: true });
                      logger.info(`Removed ${path.relative(root, target)}`);
                      return send(res, 200, { ok: true });
                    }
                    if (req.method !== "POST") return send(res, 405, { ok: false });
                    try {
                      const target = ball
                        ? path.join(assetsDir, ball === "dark" ? "cord-ball-dark.png" : "cord-ball.png")
                        : resolveAsset(url.searchParams.get("file") ?? "");
                      if (!ball) await fs.access(target);
                      await replaceImage(target, await readBody(req));
                      logger.info(`Replaced ${path.relative(root, target)}`);
                      server.ws.send({ type: "full-reload" });
                      send(res, 200, { ok: true, file: path.relative(root, target) });
                    } catch (err) {
                      send(res, 400, { ok: false, error: String(err) });
                    }
                  });
                },
              },
            ],
          },
        });

        logger.info("Design editor: use the Edit button in the corner of any page");
      },
    },
  };
}
