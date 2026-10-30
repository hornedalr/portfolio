// Dev-only design editor endpoints: save palette colours to global.css, replace pictures in src/assets and edit page
// text where it's written in src. Nothing here is included in production builds.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HEX = /^#[0-9a-f]{6}$/i;
const TOKEN = /^--color-[a-z]+(?:-\d+)?$/;
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
// The pull cord picks these up automatically when present (see PullCord.astro).
const BALL_FILES = new Set(["cord-ball.png", "cord-ball-dark.png"]);

// Where page text can be edited: data files, components and pages.
const TEXT_DIRS = ["src/data", "src/components", "src/pages"];
const TEXT_EXT = new Set([".ts", ".astro"]);
const QUOTES = new Set(['"', "'", "`"]);

/**
 * Matches text as the page shows it against how it's written in source: line breaks and runs of spaces may differ,
 * and quotes and & may be escaped. It must fill a whole string literal or the whole text between tags/expressions,
 * so "Lamp 1" doesn't match inside "Lamp 10".
 */
const textPattern = (shown) => {
  const char = (c) =>
    c === "&" ? "(?:&|&amp;)" : c === '"' ? '(?:"|\\\\"|&quot;)' : c === "'" ? "(?:'|\\\\'|&#39;|&apos;)" : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const words = shown.trim().split(/\s+/).map((w) => [...w].map(char).join(""));
  return new RegExp(`(?<=["'\`>}]\\s*)${words.join("\\s+")}(?=\\s*["'\`<{])`, "g");
};
const escapeString = (s, quote) => {
  let out = s.replaceAll("\\", "\\\\").replaceAll(quote, `\\${quote}`);
  if (quote === "`") out = out.replaceAll("${", "\\${");
  return out;
};
const PRICE = /^([\d\s\u00a0\u202f]+)\s*kr$/;
const CLASS = /^[\w:[\]%./#-]+$/;

/** Index just past the end of the tag (or bracketed expression) starting at `from`, skipping quoted strings and {…}. */
const tagEnd = (src, from, open = "<", close = ">") => {
  let depth = 0;
  let braces = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++;
    } else if (open !== "{" && (c === "{" || c === "}")) braces += c === "{" ? 1 : -1;
    else if (braces) continue;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return i + 1;
  }
  throw new Error("Couldn't read this element's source.");
};
const escapeMarkup = (s) => s.replace(/[&<{}]/g, (c) => ({ "&": "&amp;", "<": "&lt;", "{": "&#123;", "}": "&#125;" })[c]);

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

        /**
         * Finds where a piece of page text is written in the source (a string in src/data, or plain text in a component
         * or page) and replaces it. Text that's repeated, like a date used by several projects, is told apart by the
         * nearest heading written before it, e.g. the project's title.
         */
        const saveText = async (old, text, context) => {
          if (typeof old !== "string" || typeof text !== "string" || !old.trim()) throw new Error("Nothing to save");
          const next = text.replace(/\s+/g, " ").trim();
          if (!next) throw new Error("The text can't be empty");
          const files = [];
          for (const dir of TEXT_DIRS) {
            for (const entry of await fs.readdir(path.join(root, dir), { recursive: true })) {
              if (TEXT_EXT.has(path.extname(entry))) files.push(path.join(root, dir, entry));
            }
          }
          const contexts = context.filter((c) => typeof c === "string" && c.trim() && c.trim() !== old.trim());
          // Prices are shown formatted ("2 400 kr") but written as plain numbers (price: 2400).
          const price = PRICE.exec(old.trim());
          let pattern = textPattern(old);
          let written = null;
          if (price) {
            const kr = PRICE.exec(next);
            if (!kr) throw new Error("Write the price as a number, e.g. 2400 kr");
            pattern = new RegExp(`(?<=\\bprice:\\s*)${price[1].replace(/\D/g, "")}(?!\\d)`, "g");
            written = kr[1].replace(/\D/g, "");
          }
          const found = [];
          for (const file of files) {
            const src = await fs.readFile(file, "utf8");
            const before = (index) => {
              let best = Infinity;
              for (const c of contexts) {
                for (const m of src.matchAll(textPattern(c))) if (m.index < index) best = Math.min(best, index - m.index);
              }
              return best;
            };
            for (const m of src.matchAll(pattern)) found.push({ file, src, index: m.index, length: m[0].length, distance: before(m.index) });
          }
          if (!found.length) {
            throw new Error("This text is put together by code (e.g. a price or date range), so it can't be edited here.");
          }
          found.sort((a, b) => a.distance - b.distance);
          if (found.length > 1 && found[0].distance === found[1].distance) {
            throw new Error(`This text appears ${found.length} times and it isn't clear which one to change.`);
          }
          const { file, src, index, length } = found[0];
          const opener = src.slice(0, index).trimEnd().at(-1);
          written ??= QUOTES.has(opener) ? escapeString(next, opener) : escapeMarkup(next);
          await fs.writeFile(file, src.slice(0, index) + written + src.slice(index + length));
          return { file: path.relative(root, file).replaceAll("\\", "/"), line: src.slice(0, index).split("\n").length };
        };

        /**
         * Changes the Tailwind classes on one tag in a component or page. The tag is found from the position Astro
         * stamps on every element in dev (data-astro-source-file/-loc, which points at the end of the opening tag).
         * Pictures come from <Image>, which has no position of its own, so for those the parent element's position is
         * sent and the first <Image>/<Picture> after it is changed.
         */
        const saveClasses = async ({ file, loc, tag, image, replace = [], add = [] }) => {
          const abs = path.resolve(file);
          const rel = path.relative(path.join(root, "src"), abs);
          if (rel.startsWith("..") || path.isAbsolute(rel) || path.extname(abs) !== ".astro") throw new Error("This part of the page can't be changed here.");
          const all = [...replace.flat(), ...add];
          if (!all.every((c) => c === null || (typeof c === "string" && CLASS.test(c)))) throw new Error("Bad class name");
          const src = await fs.readFile(abs, "utf8");
          const [line, col] = String(loc).split(":").map(Number);
          const lines = src.split("\n");
          const lineStart = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
          const end = lineStart + Math.min(col, (lines[line - 1] ?? "").length);
          let start = -1;
          for (const m of src.slice(0, end).matchAll(new RegExp(`<${tag}(?=[\\s>/])`, "gi"))) start = m.index;
          if (start < 0) throw new Error("Couldn't find this element in the source.");
          if (image) {
            const next = /<(?:Image|Picture)(?=[\s>/])/.exec(src.slice(start + 1));
            if (!next) throw new Error("Couldn't find this picture in the source.");
            start = start + 1 + next.index;
          }
          const close = tagEnd(src, start);
          const open = src.slice(start, close);
          const attr = /\sclass(?::list)?=(?:"([^"]*)"|\{)/.exec(open);
          let edited;
          if (!attr) {
            if (!add.length) return { file: path.relative(root, abs).replaceAll("\\", "/"), line };
            const name = /^<[\w.]+/.exec(open)[0];
            edited = `${name} class="${add.join(" ")}"${open.slice(name.length)}`;
          } else {
            const valueStart = attr.index + attr[0].length - (attr[1] === undefined ? 1 : attr[1].length + 1);
            const valueEnd = attr[1] === undefined ? tagEnd(open, valueStart, "{", "}") : valueStart + attr[1].length;
            let value = open.slice(valueStart, valueEnd);
            const swap = (s) =>
              s
                .split(/(\s+)/)
                .map((t) => {
                  const hit = replace.find(([from]) => from === t);
                  return hit ? (hit[1] ?? "") : t;
                })
                .join("")
                .replace(/\s{2,}/g, " ");
            let first = true;
            const addTo = (s) => (first && add.length ? ((first = false), `${s.trimEnd()} ${add.join(" ")}`.trim()) : s);
            value = attr[1] === undefined ? value.replace(/(["'`])((?:\\.|(?!\1).)*)\1/g, (_, q, s) => q + addTo(swap(s)) + q) : addTo(swap(value));
            if (add.length && first) throw new Error("Couldn't add a class here.");
            edited = open.slice(0, valueStart) + value + open.slice(valueEnd);
          }
          await fs.writeFile(abs, src.slice(0, start) + edited + src.slice(close));
          return { file: path.relative(root, abs).replaceAll("\\", "/"), line: src.slice(0, start).split("\n").length };
        };

        updateConfig({
          vite: {
            plugins: [
              {
                name: "design-editor-save",
                configureServer(server) {
                  server.middlewares.use("/__design/text", async (req, res) => {
                    if (req.method !== "POST") return send(res, 405, { ok: false });
                    try {
                      const { old, text, context } = JSON.parse((await readBody(req)).toString("utf8"));
                      const saved = await saveText(old, text, Array.isArray(context) ? context : []);
                      logger.info(`Saved text in ${saved.file}:${saved.line}`);
                      send(res, 200, { ok: true, ...saved });
                    } catch (err) {
                      send(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
                    }
                  });

                  server.middlewares.use("/__design/classes", async (req, res) => {
                    if (req.method !== "POST") return send(res, 405, { ok: false });
                    try {
                      const saved = await saveClasses(JSON.parse((await readBody(req)).toString("utf8")));
                      logger.info(`Saved layout in ${saved.file}:${saved.line}`);
                      send(res, 200, { ok: true, ...saved });
                    } catch (err) {
                      send(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
                    }
                  });

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
