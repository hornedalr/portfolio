// Dev-only design editor UI, injected into every page by integrations/design-editor.mjs during `npm run dev`.
// Click anything to edit its words (Save writes them back where they're written in src), the palette colours it uses
// (live preview, Save writes global.css) or replace its picture.
// Lives in a shadow root so the page's styles (and palette edits) never affect the editor itself.

const STORE = "design-editor";
const root = document.documentElement;

const host = document.createElement("div");
host.setAttribute("data-design-editor", "");
const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; font: 13px/1.35 ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: #1a1a1a; }
  code, .mono { font-family: ui-monospace, Consolas, monospace; }
  button { cursor: pointer; background: #fff; border: 1px solid #bbb; padding: 6px 12px; }
  button:hover { background: #f2f2f2; }
  button:disabled { opacity: .4; cursor: default; }
  .toggle { position: fixed; left: 16px; bottom: 16px; z-index: 2147483000; font-weight: 600; box-shadow: 0 4px 16px #0003; }
  .toggle[aria-pressed="true"] { background: #0a84ff; border-color: #0a84ff; color: #fff; }
  .box { position: fixed; z-index: 2147482999; pointer-events: none; outline: 2px dashed #0a84ff; outline-offset: 1px; display: none; }
  .box.selected { outline-style: solid; }
  .panel { position: fixed; top: 16px; right: 16px; bottom: 16px; width: 330px; z-index: 2147483000; display: none; flex-direction: column;
           background: #fff; border: 1px solid #bbb; box-shadow: 0 12px 40px #0004; }
  .panel.open { display: flex; }
  .head, .foot { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #ddd; }
  .foot { border-bottom: 0; border-top: 1px solid #ddd; }
  .head strong { flex: 1; font-weight: 700; }
  .muted { color: #666; }
  .body { flex: 1; overflow-y: auto; padding: 10px 14px; }
  h3 { margin: 14px 0 4px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #666; }
  summary { cursor: pointer; margin-top: 14px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #666; }
  .row { display: flex; width: 100%; align-items: center; gap: 8px; padding: 5px 4px; border: 0; text-align: left; background: none; }
  .row.active { background: #e6f0ff; }
  .chip { width: 24px; height: 24px; flex: none; border: 1px solid #ccc; }
  .row .name { display: block; font-weight: 600; }
  .row .uses { display: block; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
  .row span.grow { flex: 1; min-width: 0; }
  .wheel { display: none; border-top: 1px solid #ddd; padding: 10px 14px; }
  .wheel.open { display: block; }
  .wheel .top { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .wheel .cols { display: flex; gap: 12px; }
  canvas { width: 150px; height: 150px; flex: none; cursor: crosshair; touch-action: none; }
  .side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .swatch { height: 46px; border: 1px solid #ccc; }
  label { display: flex; flex-direction: column; gap: 3px; }
  input[type=text], input[type=range], .side > * { box-sizing: border-box; width: 100%; min-width: 0; }
  input[type=text] { border: 1px solid #bbb; padding: 4px 6px; text-transform: uppercase; }
  textarea { display: block; width: 100%; border: 1px solid #bbb; padding: 6px; resize: vertical; }
  .tweak { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
  .tweak .grow { flex: 1; }
  .tweak button { width: 30px; padding: 4px 0; }
  .tweak code { min-width: 40px; text-align: center; }
  select { border: 1px solid #bbb; padding: 4px; background: #fff; }
  .link { border: 0; padding: 0; color: #0a84ff; background: none; }
  .link:hover { text-decoration: underline; background: none; }
  .primary { background: #0a84ff; border-color: #0a84ff; color: #fff; font-weight: 600; }
  .primary:hover { background: #0670d9; }
  .thumb { display: block; width: 100%; max-height: 130px; object-fit: contain; border: 1px solid #ddd; margin-bottom: 6px; }
  .break { word-break: break-all; }
  p { margin: 0 0 6px; }
</style>
<button class="toggle" aria-pressed="false">✎ Edit design</button>
<div class="box hover"></div>
<div class="box selected"></div>
<aside class="panel" aria-label="Design editor">
  <div class="head"><strong>Design editor</strong><span class="status muted"></span></div>
  <div class="body"><p class="muted">Click anything on the page to edit its text, colours or picture. Press Esc to stop editing.</p></div>
  <div class="wheel">
    <div class="top"><code class="token" style="font-weight:700"></code><button class="link revert">Revert</button></div>
    <div class="cols">
      <canvas width="320" height="320"></canvas>
      <div class="side">
        <div class="swatch"></div>
        <label>Hex<input type="text" class="hex mono" maxlength="7" spellcheck="false" /></label>
        <label>Brightness<input type="range" class="value" min="0" max="100" /></label>
      </div>
    </div>
  </div>
  <div class="foot">
    <span class="dirty muted" style="flex:1">No changes</span>
    <button class="discard" disabled>Discard</button>
    <button class="primary save" disabled>Save</button>
  </div>
</aside>
<input type="file" accept="image/png,image/jpeg,image/webp" hidden />
`;
document.body.append(host);

const $ = (sel) => shadow.querySelector(sel);
const toggle = $(".toggle");
const hoverBox = $(".box.hover");
const selectedBox = $(".box.selected");
const panel = $(".panel");
const body = $(".body");
const statusEl = $(".status");
const wheel = $(".wheel");
const tokenLabel = $(".token");
const canvas = $("canvas");
const swatch = $(".swatch");
const hexInput = $(".hex");
const valueInput = $(".value");
const dirtyLabel = $(".dirty");
const saveBtn = $(".save");
const discardBtn = $(".discard");
const fileInput = $("input[type=file]");

// ---- colour helpers ----
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const toHex = (css) => {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = css.trim();
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
};
const hexToHsv = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
};
const hsvToHex = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return "#" + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("");
};

// ---- palette state ----
const original = new Map();
const changes = new Map();
const palette = () => {
  const names = new Set();
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules) walk(rule.cssRules);
      if (rule instanceof CSSStyleRule) for (const p of rule.style) if (p.startsWith("--color-")) names.add(p);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules);
    } catch {
      // Cross-origin sheets can't be read.
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};
const current = (token) => changes.get(token) ?? toHex(getComputedStyle(root).getPropertyValue(token));
const setColor = (token, hex) => {
  if (!original.has(token)) {
    root.style.removeProperty(token);
    original.set(token, toHex(getComputedStyle(root).getPropertyValue(token)));
  }
  if (hex === original.get(token)) {
    changes.delete(token);
    root.style.removeProperty(token);
  } else {
    changes.set(token, hex);
    root.style.setProperty(token, hex);
  }
  persist();
  refreshDirty();
  for (const el of shadow.querySelectorAll(`[data-chip="${token}"]`)) el.style.background = hex;
  for (const el of shadow.querySelectorAll(`[data-hexfor="${token}"]`)) el.textContent = hex.toUpperCase();
};
const refreshDirty = () => {
  const n = changes.size;
  dirtyLabel.textContent = n ? `${n} unsaved colour${n > 1 ? "s" : ""}` : "No changes";
  saveBtn.disabled = discardBtn.disabled = !n;
};
let editing = false;
// Remembers the selected element by its source position, so it stays selected after a save reloads the page.
const locate = (el) => {
  const file = el?.getAttribute?.("data-astro-source-file"), loc = el?.getAttribute?.("data-astro-source-loc");
  if (!file || !loc) return null;
  const same = document.querySelectorAll(`[data-astro-source-file="${CSS.escape(file)}"][data-astro-source-loc="${loc}"]`);
  return { file, loc, index: [...same].indexOf(el) };
};
const persist = () =>
  sessionStorage.setItem(STORE, JSON.stringify({ on: editing, changes: [...changes], selected: editing ? locate(selected) : null }));

// ---- colour wheel ----
let wheelToken = "";
let hsv = { h: 0, s: 0, v: 1 };
const ctx = canvas.getContext("2d");
const drawWheel = () => {
  const size = canvas.width, r = size / 2;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - r, dy = y - r, d = Math.hypot(dx, dy);
      if (d > r) continue;
      const n = parseInt(hsvToHex(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, d / r, hsv.v).slice(1), 16);
      img.data.set([n >> 16, (n >> 8) & 255, n & 255, 255], (y * size + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  const a = (hsv.h * Math.PI) / 180;
  ctx.beginPath();
  ctx.arc(r + Math.cos(a) * hsv.s * r, r + Math.sin(a) * hsv.s * r, 9, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = hsv.v > 0.5 ? "#000" : "#fff";
  ctx.stroke();
};
const applyHsv = () => {
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  setColor(wheelToken, hex);
  swatch.style.background = hex;
  if (shadow.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
  drawWheel();
};
const openWheel = (token) => {
  wheelToken = token;
  tokenLabel.textContent = token.replace("--color-", "");
  const hex = current(token);
  hsv = hexToHsv(hex);
  hexInput.value = hex.toUpperCase();
  valueInput.value = String(Math.round(hsv.v * 100));
  swatch.style.background = hex;
  wheel.classList.add("open");
  for (const row of body.querySelectorAll(".row")) row.classList.toggle("active", row.dataset.token === token);
  drawWheel();
};
const pickFromWheel = (e) => {
  const rect = canvas.getBoundingClientRect();
  const dx = (e.clientX - rect.left) / rect.width - 0.5, dy = (e.clientY - rect.top) / rect.height - 0.5;
  hsv.h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  hsv.s = Math.min(Math.hypot(dx, dy) / 0.5, 1);
  applyHsv();
};
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pickFromWheel(e);
});
canvas.addEventListener("pointermove", (e) => canvas.hasPointerCapture(e.pointerId) && pickFromWheel(e));
valueInput.addEventListener("input", () => {
  hsv.v = Number(valueInput.value) / 100;
  applyHsv();
});
hexInput.addEventListener("input", () => {
  let v = hexInput.value.trim();
  if (!v.startsWith("#")) v = "#" + v;
  if (!/^#[0-9a-f]{6}$/i.test(v)) return;
  hsv = hexToHsv(v.toLowerCase());
  valueInput.value = String(Math.round(hsv.v * 100));
  applyHsv();
});
$(".revert").addEventListener("click", () => {
  if (!wheelToken) return;
  setColor(wheelToken, original.get(wheelToken) ?? current(wheelToken));
  openWheel(wheelToken);
});

// ---- inspecting what was clicked ----
const PROPS = {
  bg: "background", text: "text", border: "border", fill: "fill", stroke: "stroke", outline: "outline",
  decoration: "underline", ring: "ring", divide: "divider", shadow: "shadow", accent: "accent", caret: "caret",
  from: "gradient", via: "gradient", to: "gradient",
};
const UTILITY = /^-?(bg|text|border(?:-[trblxy])?|fill|stroke|outline|decoration|ring|divide|shadow|accent|caret|from|via|to)-([a-z]+-\d{2,3}|white|black)(?:\/\d+)?!?$/;
const tokensOf = (el, inherited, found) => {
  const cls = el.getAttribute?.("class");
  if (!cls) return;
  for (const c of cls.split(/\s+/)) {
    const parts = c.replace(/^!/, "").split(":");
    const m = UTILITY.exec(parts.pop());
    if (!m) continue;
    const token = `--color-${m[2]}`;
    const states = parts.map((p) => (p === "dark" ? "dark mode" : p.replace(/^(group|peer)-/, "")));
    const label = [PROPS[m[1].split("-")[0]], ...states].join(" · ");
    const entry = found.get(token) ?? { token, uses: new Set(), own: false };
    entry.uses.add(label);
    entry.own ||= !inherited;
    found.set(token, entry);
  }
};
const imageFileOf = (img) => {
  const url = new URL(img.currentSrc || img.src, location.href);
  const file = url.pathname === "/_image" ? url.searchParams.get("href") : url.pathname;
  if (!file) return null;
  const clean = decodeURIComponent(file.split("?")[0]);
  return /\/src\/assets\//.test(clean) ? clean : null;
};
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const describe = (el) => {
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
  const label = el.getAttribute("aria-label") || el.getAttribute("alt") || text;
  return `${el.tagName.toLowerCase()}${label ? ` — “${label.slice(0, 40)}${label.length > 40 ? "…" : ""}”` : ""}`;
};
const row = (token, uses) => `
  <button class="row" data-token="${token}">
    <span class="chip" data-chip="${token}" style="background:${current(token)}"></span>
    <span class="grow"><span class="name">${token.replace("--color-", "")}</span>${uses ? `<span class="uses">${esc(uses)}</span>` : ""}</span>
    <code class="muted" data-hexfor="${token}">${current(token).toUpperCase()}</code>
  </button>`;

// ---- size & spacing (written back as Tailwind classes on the element's tag) ----
const SIZES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"];
const SIZE_REM = [0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25, 3, 3.75, 4.5, 6, 8];
const SPACES = ["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "5", "6", "7", "8", "9", "10", "11", "12", "14", "16", "20", "24", "28", "32", "36", "40", "44", "48"];
const WEIGHTS = { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 };
const SIZE_CLASS = new RegExp(`^((?:[\\w-]+:)*)text-(${SIZES.join("|")})$`);
const spaceClass = (side) => new RegExp(`^((?:[\\w-]+:)*)m${side}-(${SPACES.map((s) => s.replace(".", "\\.")).join("|")})$`);
const WEIGHT_CLASS = new RegExp(`^((?:[\\w-]+:)*)font-(${Object.keys(WEIGHTS).join("|")})$`);
const WIDTH_CLASS = /^w-(full|\[\d+%\])$/;
const remPx = () => parseFloat(getComputedStyle(root).fontSize) || 16;
const nearest = (values, v) => values.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(values[best] - v) ? i : best), 0);
const clampIndex = (i, list) => Math.max(0, Math.min(list.length - 1, i));

let layout = null;
// Elements written by the same line of source (e.g. every project title) change together.
const twinsOf = (el, image) => {
  const anchor = image ? el.parentElement : el;
  const at = locate(anchor);
  if (!at) return [el];
  const same = document.querySelectorAll(`[data-astro-source-file="${CSS.escape(at.file)}"][data-astro-source-loc="${at.loc}"]`);
  return image ? [...same].map((p) => p.querySelector(":scope > img")).filter(Boolean) : [...same];
};
const layoutSection = (el) => {
  const image = el instanceof HTMLImageElement;
  const anchor = image ? el.parentElement : el;
  const at = locate(anchor);
  if (!at || !/\/src\/(components|pages|layouts)\//.test(at.file)) return "";
  const style = getComputedStyle(el);
  const hasText = !image && textNodesOf(el).length > 0;
  layout = {
    el, image, at, tag: anchor.tagName.toLowerCase(), twins: twinsOf(el, image),
    size: nearest(SIZE_REM, parseFloat(style.fontSize) / remPx()), sizeSteps: 0,
    above: nearest(SPACES.map(Number), parseFloat(style.marginTop) / remPx() / 0.25), aboveSteps: 0,
    below: nearest(SPACES.map(Number), parseFloat(style.marginBottom) / remPx() / 0.25), belowSteps: 0,
    weight: null, width: null,
    startWidth: Math.round((el.getBoundingClientRect().width / (el.parentElement?.getBoundingClientRect().width || 1)) * 100),
  };
  const stepper = (key, label) => `
    <div class="tweak"><span class="grow">${label}</span><button data-step="${key}" data-by="-1" aria-label="Less">−</button>
    <code class="muted" data-show="${key}"></code><button data-step="${key}" data-by="1" aria-label="More">+</button></div>`;
  let html = `<h3>Size &amp; spacing</h3>`;
  if (image) {
    html += `<label>Picture size <span class="muted" data-show="width"></span>
      <input type="range" class="width" min="20" max="100" step="5" value="${Math.min(100, layout.startWidth)}" /></label>`;
  }
  if (hasText) {
    html += stepper("size", "Text size");
    const current = Object.entries(WEIGHTS).reduce((a, b) => (Math.abs(b[1] - Number(style.fontWeight)) < Math.abs(a[1] - Number(style.fontWeight)) ? b : a))[0];
    html += `<div class="tweak"><span class="grow">Boldness</span><select class="weight">${Object.keys(WEIGHTS)
      .map((w) => `<option${w === current ? " selected" : ""}>${w}</option>`)
      .join("")}</select></div>`;
  }
  html += stepper("above", "Space above") + stepper("below", "Space below");
  html += `<div style="display:flex;gap:8px;margin-top:6px">
      <button class="primary" data-layout-save disabled>Save size &amp; spacing</button><button data-layout-undo disabled>Undo</button></div>
    <p class="muted layout-msg" style="margin-top:4px">${layout.twins.length > 1 ? `Changes all ${layout.twins.length} like this on the page.` : ""}</p>`;
  return html;
};
const layoutChanged = () =>
  layout && (layout.sizeSteps || layout.aboveSteps || layout.belowSteps || layout.weight || (layout.width !== null && layout.width !== Math.min(100, layout.startWidth)));
const previewLayout = (reset) => {
  if (!layout || (!layout.previewed && (reset || !layoutChanged()))) return;
  layout.previewed = !reset;
  const { size, sizeSteps, above, aboveSteps, below, belowSteps, weight, width } = layout;
  for (const t of layout.twins) {
    t.style.fontSize = !reset && sizeSteps ? `${SIZE_REM[clampIndex(size + sizeSteps, SIZES)]}rem` : "";
    t.style.marginTop = !reset && aboveSteps ? `${Number(SPACES[clampIndex(above + aboveSteps, SPACES)]) * 0.25}rem` : "";
    t.style.marginBottom = !reset && belowSteps ? `${Number(SPACES[clampIndex(below + belowSteps, SPACES)]) * 0.25}rem` : "";
    t.style.fontWeight = !reset && weight ? String(WEIGHTS[weight]) : "";
    t.style.width = !reset && width !== null ? `${width}%` : "";
    t.style.marginInline = !reset && width !== null && width < 100 ? "auto" : "";
  }
  if (selected) placeBox(selectedBox, selected);
};
const refreshLayout = () => {
  if (!layout) return;
  const show = (key, text) => body.querySelector(`[data-show="${key}"]`) && (body.querySelector(`[data-show="${key}"]`).textContent = text);
  show("size", SIZES[clampIndex(layout.size + layout.sizeSteps, SIZES)]);
  show("above", SPACES[clampIndex(layout.above + layout.aboveSteps, SPACES)]);
  show("below", SPACES[clampIndex(layout.below + layout.belowSteps, SPACES)]);
  show("width", `${layout.width ?? Math.min(100, layout.startWidth)}%`);
  const unchanged = !layoutChanged();
  body.querySelector("[data-layout-save]").disabled = unchanged;
  body.querySelector("[data-layout-undo]").disabled = unchanged;
  previewLayout(false);
};
/** Turns the previewed tweaks into class swaps: shift the classes already there, or add one if there are none. */
const layoutClasses = () => {
  const own = layout.el.getAttribute("class")?.split(/\s+/).filter(Boolean) ?? [];
  const replace = [], add = [];
  const shift = (steps, pattern, list, start, prefix) => {
    if (!steps) return;
    const hits = own.filter((c) => pattern.test(c));
    if (!hits.length) return add.push(`${prefix}-${list[clampIndex(start + steps, list)]}`);
    for (const c of hits) {
      const [, variant, value] = pattern.exec(c);
      replace.push([c, `${variant}${prefix}-${list[clampIndex(list.indexOf(value) + steps, list)]}`]);
    }
  };
  shift(layout.sizeSteps, SIZE_CLASS, SIZES, layout.size, "text");
  shift(layout.aboveSteps, spaceClass("t"), SPACES, layout.above, "mt");
  shift(layout.belowSteps, spaceClass("b"), SPACES, layout.below, "mb");
  if (layout.weight) {
    const hits = own.filter((c) => WEIGHT_CLASS.test(c));
    if (hits.length) hits.forEach((c, i) => replace.push([c, i ? null : `font-${layout.weight}`]));
    else add.push(`font-${layout.weight}`);
  }
  if (layout.width !== null) {
    const next = layout.width >= 100 ? "w-full" : `w-[${layout.width}%]`;
    const hits = own.filter((c) => WIDTH_CLASS.test(c));
    if (hits.length) hits.forEach((c) => replace.push([c, next]));
    else add.push(next);
    if (layout.width < 100 && !own.includes("mx-auto")) add.push("mx-auto");
  }
  return { replace, add };
};
const saveLayout = async () => {
  const msg = body.querySelector(".layout-msg");
  statusEl.textContent = "Saving…";
  const res = await fetch("/__design/classes", {
    method: "POST",
    body: JSON.stringify({ file: layout.at.file, loc: layout.at.loc, tag: layout.tag, image: layout.image, ...layoutClasses() }),
  });
  const out = await res.json().catch(() => ({ ok: false, error: res.statusText }));
  // On success the dev server reloads the page; the selection is restored from sessionStorage.
  statusEl.textContent = out.ok ? `Saved to ${out.file}` : "Not saved";
  if (!out.ok) msg.textContent = out.error;
};

let selected = null;
// The text being edited: live-previewed in the page until it's saved (or undone).
let textEdit = null;
const textNodesOf = (el) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) out.push(walker.currentNode);
  return out;
};
const previewText = (value) => {
  if (!textEdit) return;
  textEdit.nodes.forEach((n, i) => (n.nodeValue = value === null ? textEdit.before[i] : i ? "" : value));
  if (selected) placeBox(selectedBox, selected);
};
const select = (el) => {
  previewText(null);
  textEdit = null;
  previewLayout(true);
  layout = null;
  selected = el;
  persist();
  placeBox(selectedBox, el);
  const found = new Map();
  tokensOf(el, false, found);
  el.querySelectorAll("*").forEach((child) => tokensOf(child, false, found));
  // The handle is an invisible hit area over the sheep, so show the sheep's own colours too.
  if (el.closest("[data-pull-cord]")) document.querySelectorAll("[data-sheep], [data-sheep] *").forEach((s) => tokensOf(s, false, found));
  for (let p = el.parentElement; p; p = p.parentElement) tokensOf(p, true, found);

  let html = `<p style="font-weight:600" class="break">${esc(describe(el))}</p>`;
  const nodes = textNodesOf(el);
  if (nodes.length && nodes.every((n) => n.parentElement === el)) {
    const text = el.textContent.trim().replace(/\s+/g, " ");
    textEdit = { el, nodes, before: nodes.map((n) => n.nodeValue), text };
    html += `<h3>Text</h3>
      <textarea class="text-edit" rows="${Math.min(8, Math.ceil(text.length / 38) + 1)}" spellcheck="true">${esc(text)}</textarea>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="primary" data-text-save disabled>Save text</button><button data-text-undo disabled>Undo</button>
      </div>
      <p class="muted text-msg" style="margin-top:4px"></p>`;
  } else if (nodes.length) {
    html += `<h3>Text</h3><p class="muted">Click directly on a heading or paragraph to edit its words.</p>`;
  }
  const img = el instanceof HTMLImageElement ? el : (el.closest("picture")?.querySelector("img") ?? el.querySelector("img"));
  const file = img && imageFileOf(img);
  if (img && file) {
    html += `<h3>Picture</h3>
      <img class="thumb" src="${esc(img.currentSrc || img.src)}" alt="" />
      <p class="muted break">${esc(file.replace(/^.*\/src\//, "src/"))}</p>
      <button data-replace="${encodeURIComponent(file)}">Replace picture…</button>
      <p class="muted" style="margin-top:4px">Cropped to the current proportions.</p>`;
  } else if (img) {
    html += `<h3>Picture</h3><p class="muted">This picture isn't from src/assets, so it can't be replaced here.</p>`;
  }
  html += layoutSection(el);
  if (el.closest("[data-pull-cord]")) {
    html += `<h3>Pull ball picture</h3>
      <p class="muted">Replace the sheep with your own PNG. The cord attaches at the top centre.</p>
      <div style="display:flex;gap:8px"><button data-ball="light">Light mode…</button><button data-ball="dark">Dark mode…</button></div>
      <button data-ball-reset style="margin-top:6px">Back to the sheep</button>`;
  }
  const uses = [...found.values()];
  const own = uses.filter((u) => u.own);
  const around = uses.filter((u) => !u.own);
  if (own.length) html += `<h3>Colours used here</h3>${own.map((u) => row(u.token, [...u.uses].join(", "))).join("")}`;
  if (around.length) html += `<h3>Colours from around it</h3>${around.map((u) => row(u.token, [...u.uses].join(", "))).join("")}`;
  const rest = palette().filter((t) => !found.has(t));
  html += `<details><summary>All palette colours</summary>${rest.map((t) => row(t, "")).join("")}</details>`;

  body.innerHTML = html;
  refreshLayout();
  wheel.classList.remove("open");
  const first = own[0] ?? around[0];
  if (first) openWheel(first.token);
};

let uploadQuery = "";
const chooseFile = (query) => {
  uploadQuery = query;
  fileInput.value = "";
  fileInput.click();
};
body.addEventListener("click", (e) => {
  const r = e.target.closest(".row");
  if (r) return openWheel(r.dataset.token);
  if (e.target.closest("[data-text-save]")) return saveText();
  const step = e.target.closest("[data-step]");
  if (step) {
    const key = `${step.dataset.step}Steps`;
    layout[key] += Number(step.dataset.by);
    return refreshLayout();
  }
  if (e.target.closest("[data-layout-save]")) return saveLayout();
  if (e.target.closest("[data-layout-undo]")) {
    previewLayout(true);
    Object.assign(layout, { sizeSteps: 0, aboveSteps: 0, belowSteps: 0, weight: null, width: null });
    const range = body.querySelector(".width");
    if (range) range.value = String(Math.min(100, layout.startWidth));
    return refreshLayout();
  }
  if (e.target.closest("[data-text-undo]")) {
    previewText(null);
    body.querySelector(".text-edit").value = textEdit.text;
    return refreshText();
  }
  const replace = e.target.closest("[data-replace]");
  if (replace) return chooseFile(`file=${replace.dataset.replace}`);
  const ball = e.target.closest("[data-ball]");
  if (ball) return chooseFile(`ball=${ball.dataset.ball}`);
  if (e.target.closest("[data-ball-reset]")) {
    statusEl.textContent = "Removing…";
    Promise.all(["light", "dark"].map((b) => fetch(`/__design/image?ball=${b}`, { method: "DELETE" })));
  }
});
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  statusEl.textContent = "Uploading…";
  const res = await fetch(`/__design/image?${uploadQuery}`, { method: "POST", body: file });
  const out = await res.json().catch(() => ({ ok: false, error: res.statusText }));
  // On success the dev server reloads the page; unsaved colours and edit mode survive via sessionStorage.
  statusEl.textContent = out.ok ? `Saved ${out.file}` : `Failed: ${out.error}`;
});

const refreshText = () => {
  const changed = body.querySelector(".text-edit").value.replace(/\s+/g, " ").trim() !== textEdit.text;
  body.querySelector("[data-text-save]").disabled = !changed;
  body.querySelector("[data-text-undo]").disabled = !changed;
};
body.addEventListener("input", (e) => {
  if (e.target.matches(".width") && layout) {
    layout.width = Number(e.target.value);
    return refreshLayout();
  }
  if (e.target.matches(".weight") && layout) {
    layout.weight = e.target.value;
    return refreshLayout();
  }
  if (!e.target.matches(".text-edit") || !textEdit) return;
  previewText(e.target.value.replace(/\s+/g, " "));
  refreshText();
});
const saveText = async () => {
  const { el, text } = textEdit;
  // Headings near the text tell apart words used in several places, like a date shared by two projects.
  const context = [el.closest("article, li"), el.closest("section")]
    .map((box) => box?.querySelector("h1, h2, h3, h4")?.textContent.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  statusEl.textContent = "Saving…";
  body.querySelector(".text-msg").textContent = "";
  const res = await fetch("/__design/text", {
    method: "POST",
    body: JSON.stringify({ old: text, text: body.querySelector(".text-edit").value, context }),
  });
  const out = await res.json().catch(() => ({ ok: false, error: res.statusText }));
  if (!out.ok) {
    statusEl.textContent = "Not saved";
    body.querySelector(".text-msg").textContent = out.error;
    return;
  }
  // The dev server reloads the page with the new text; until then keep the preview as it is.
  textEdit.before = textEdit.nodes.map((n) => n.nodeValue);
  textEdit.text = body.querySelector(".text-edit").value.replace(/\s+/g, " ").trim();
  refreshText();
  statusEl.textContent = `Saved to ${out.file}`;
};
// Keep typing in the editor from reaching the page's own shortcuts (e.g. "/" opens search). Esc still stops editing.
shadow.addEventListener("keydown", (e) => e.key !== "Escape" && e.stopPropagation());

// ---- saving ----
saveBtn.addEventListener("click", async () => {
  statusEl.textContent = "Saving…";
  const res = await fetch("/__design/colors", { method: "POST", body: JSON.stringify(Object.fromEntries(changes)) });
  const out = await res.json().catch(() => ({ ok: false, error: res.statusText }));
  if (!out.ok) {
    statusEl.textContent = `Failed: ${out.error}`;
    return;
  }
  statusEl.textContent = "Saved to global.css";
  // Keep the overrides until the dev server has pushed the updated stylesheet, so nothing flickers.
  const saved = [...changes.keys()];
  changes.clear();
  original.clear();
  persist();
  refreshDirty();
  setTimeout(() => saved.forEach((t) => root.style.removeProperty(t)), 1500);
});
discardBtn.addEventListener("click", () => {
  for (const t of [...changes.keys()]) setColor(t, original.get(t));
  if (selected) select(selected);
  statusEl.textContent = "Discarded";
});

// ---- edit mode ----
const placeBox = (box, el) => {
  if (!el) {
    box.style.display = "none";
    return;
  }
  const r = el.getBoundingClientRect();
  Object.assign(box.style, { display: "block", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
};
const inEditor = (e) => e.composedPath().includes(host);
const swallow = (e) => {
  if (!editing || inEditor(e)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
};
for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "dblclick", "contextmenu"]) {
  addEventListener(type, swallow, { capture: true, passive: false });
}
addEventListener(
  "click",
  (e) => {
    if (!editing || inEditor(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    select(e.target);
  },
  { capture: true },
);
addEventListener("pointermove", (e) => placeBox(hoverBox, editing && !inEditor(e) ? e.target : null), { capture: true, passive: true });
addEventListener(
  "scroll",
  () => {
    if (selected && editing) placeBox(selectedBox, selected);
    placeBox(hoverBox, null);
  },
  { passive: true },
);

const setEditing = (on) => {
  editing = on;
  toggle.setAttribute("aria-pressed", String(on));
  panel.classList.toggle("open", on);
  if (!on) {
    placeBox(hoverBox, null);
    placeBox(selectedBox, null);
  } else if (selected) {
    placeBox(selectedBox, selected);
  }
  persist();
};
toggle.addEventListener("click", () => setEditing(!editing));
addEventListener("keydown", (e) => e.key === "Escape" && editing && setEditing(false));

// Restore edit mode and unsaved colours after a reload (e.g. after replacing a picture).
try {
  const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null");
  if (saved) {
    for (const [t, hex] of saved.changes) setColor(t, hex);
    setEditing(Boolean(saved.on));
    const s = saved.selected;
    const el = s && document.querySelectorAll(`[data-astro-source-file="${CSS.escape(s.file)}"][data-astro-source-loc="${s.loc}"]`)[s.index];
    if (saved.on && el) select(el);
  }
} catch {
  sessionStorage.removeItem(STORE);
}
refreshDirty();
