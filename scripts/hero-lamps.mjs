// Generates the hand-sketched lamp illustration for the hero: src/components/hero-lamps.svg.
// Run: node scripts/hero-lamps.mjs   (SEED=n picks a different hand-drawn wobble).
import fs from "node:fs";

let seed = Number(process.env.SEED ?? 7);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const r = (a, b) => a + rnd() * (b - a);
const f = (n) => Math.round(n * 10) / 10;

// Smooth curve through points (Catmull-Rom → cubic Bézier).
const curve = (pts, closed) => {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? "Z" : "");
};

// Lumpy felted-wool outline: an ellipse with a few soft bumps; flat-ish bottom when it sits on something.
const blob = (cx, cy, rx, ry, { bumps = 5, rough = 0.12, flat = false, n = 22, square = 1 } = {}) => {
  const se = (v) => Math.sign(v) * Math.abs(v) ** square;
  const waves = Array.from({ length: 3 }, (_, k) => [bumps + k * 2 - 1, r(0, 6.28), rough / (k + 1)]);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = 1 + waves.reduce((s, [fq, ph, am]) => s + Math.sin(a * fq + ph) * am, 0) + r(-0.03, 0.03);
    const x = cx + se(Math.cos(a)) * rx * k;
    let y = cy + se(Math.sin(a)) * ry * k;
    if (flat && Math.sin(a) > 0.55) y = Math.min(y, cy + ry * 0.97);
    return [x, y];
  });
};

const jitter = (pts, j) => pts.map(([x, y]) => [x + r(-j, j), y + r(-j, j)]);
const line = (x1, y1, x2, y2, steps = 6, j = 1.2) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const e = i === 0 || i === steps ? 0 : j;
    return [x1 + (x2 - x1) * t + r(-e, e), y1 + (y2 - y1) * t + r(-e, e) * 0.4];
  });

// Pencil look: the shape once, then a second looser partial pass over it.
const sketch = (pts, closed) => {
  const a = `<path class="ln" pathLength="100" d="${curve(jitter(pts, 0.6), closed)}"/>`;
  const start = Math.floor(r(0, pts.length));
  const part = closed ? [...pts.slice(start), ...pts.slice(0, start)].slice(0, Math.floor(pts.length * r(0.45, 0.7))) : pts;
  return a + `<path class="ln ln2" pathLength="100" d="${curve(jitter(part, 1.6), false)}"/>`;
};

// Marbling wisps inside the wool, like the darker fibres in the real lamps.
const wisps = (cx, cy, rx, ry, count) =>
  Array.from({ length: count }, () => {
    const a = r(0, 6.28), d = r(0.1, 0.55);
    let x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    let dir = r(0, 6.28);
    const len = r(0.3, 0.55) * Math.min(rx, ry);
    const pts = [[x, y]];
    for (let i = 0; i < 4; i++) {
      dir += r(-0.9, 0.9);
      x += (Math.cos(dir) * len) / 3;
      y += (Math.sin(dir) * len) / 3;
      pts.push([x, y]);
    }
    return `<path class="ln wisp" pathLength="100" d="${curve(pts, false)}"/>`;
  }).join("");

// One continuous zig-zag scribble across the lamp (clipped to it): the "sketched over" warmth.
const scribble = (x0, y0, w, h, gap, slant, cls = "hatch") => {
  const pts = [];
  let left = true;
  const lean = w * slant;
  for (let y = y0 - Math.abs(lean) - 8; y < y0 + h + Math.abs(lean) + 8; y += gap * r(0.7, 1.4)) {
    pts.push(left ? [x0 - 8 + r(0, w * 0.15), y + lean + r(-3, 3)] : [x0 + w + 8 - r(0, w * 0.15), y + r(-3, 3)]);
    left = !left;
  }
  return `<path class="${cls}" pathLength="100" d="${curve(pts, false)}"/>`;
};

// Short pencil rays around a lit lamp.
const rays = (cx, cy, rx, ry, count, from, to) =>
  Array.from({ length: count }, (_, i) => {
    const a = from + ((to - from) * (i + r(0.25, 0.75))) / count;
    const ex = cx + Math.cos(a) * rx, ey = cy + Math.sin(a) * ry;
    const g = r(9, 14), len = r(7, 12);
    return `<path class="ray" pathLength="100" d="M${f(ex + Math.cos(a) * g)} ${f(ey + Math.sin(a) * g)} L${f(ex + Math.cos(a) * (g + len))} ${f(ey + Math.sin(a) * (g + len))}"/>`;
  }).join("");

// The drawing lives in a 390×700 box; the top part is empty, so only the lower VIEW units are shown.
const W = 390, H = 700, FLOOR = 676, VIEW = 470;
const lamps = [];
const lamp = (id, order, body) => lamps.push(`<g class="lamp" style="--i:${order}" data-lamp="${id}">${body}</g>`);

// A lamp: warm layer (glow, floor pool, warm fill, scribble, rays) under the pencil outline and wisps.
const shade = (id, cx, cy, rx, ry, opts, extra = {}, rayArc = [-Math.PI, 0]) => {
  const pts = blob(cx, cy, rx, ry, opts);
  const d = curve(pts, true);
  const floorY = extra.floorY ?? FLOOR;
  return `
    <clipPath id="c-${id}"><path d="${d}"/></clipPath>
    <path class="bg" d="${d}"/>
    <g class="warm">
      <ellipse class="halo" cx="${cx}" cy="${cy}" rx="${f(rx * 2.4)}" ry="${f(Math.min(ry * 1.9, ry + 90))}" fill="url(#halo)" filter="url(#rough)"/>
      <ellipse class="pool" cx="${cx}" cy="${floorY}" rx="${f(rx * 1.7)}" ry="8" fill="url(#pool)"/>
      <path class="fill" d="${d}" fill="url(#inner)"/>
      <g clip-path="url(#c-${id})">${scribble(cx - rx, cy - ry, rx * 2, ry * 2, Math.max(7, Math.min(ry / 5, 12)), 0.45)}${scribble(cx - rx, cy - ry, rx * 2, ry * 2, Math.max(9, Math.min(ry / 4, 15)), -0.3, "hatch hatch2")}</g>
      ${rays(cx, cy, rx, ry, Math.round(r(4, 6)), ...rayArc)}
    </g>
    ${(extra.under ?? "").replaceAll('class="ln', 'class="sup ln')}
    ${sketch(pts, true)}
    ${wisps(cx, cy, rx, ry, Math.round(Math.max(rx, ry) / 14) + 2)}
    ${(extra.over ?? "").replaceAll('class="ln', 'class="sup ln')}`;
};

// Lamps are listed back to front: each one's background-coloured body hides what's behind it.
// --i = when each lamp draws in: the side clusters first, then inward, so the U closes around the cord.

// Left cluster: a floor lamp with a wide wool shade, its stem crowded by lamps sitting in front of it.
lamp("floor-left", 0, shade("a", 66, 352, 56, 46, { bumps: 4, rough: 0.13 }, {
  under: sketch(line(66, 396, 63, FLOOR - 4, 10, 1), false) + sketch(blob(63, FLOOR - 3, 22, 5, { bumps: 3, rough: 0.05, n: 14 }), true),
}, [-Math.PI * 1.1, 0.1]));
lamp("tall-left", 0.35, shade("g", 34, 590, 32, 86, { bumps: 5, rough: 0.08, flat: true, square: 0.85 }, {}, [Math.PI * 0.9, Math.PI * 1.3]));
lamp("boulder-left", 0.6, shade("h", 96, 630, 36, 46, { bumps: 5, rough: 0.12, flat: true }, {}, [-Math.PI * 0.8, -Math.PI * 0.3]));
lamp("pebble-left", 0.85, shade("i", 52, 660, 20, 17, { bumps: 4, rough: 0.12, flat: true }, {}, [Math.PI * 0.95, Math.PI * 1.2]));

// Right cluster: a shorter, wider wool column with an egg lamp and a pebble crowded around its foot.
lamp("column-right", 0.2, shade("f", 346, 512, 40, 162, { bumps: 6, rough: 0.05, flat: true, n: 40, square: 0.85 }, {}, [-Math.PI * 1.05, -Math.PI * 0.1]));
lamp("egg-right", 0.6, shade("e", 288, 604, 33, 70, { bumps: 4, rough: 0.1, flat: true }, {}, [-Math.PI * 0.9, -Math.PI * 0.45]));
lamp("pebble-right", 0.85, shade("j", 342, 654, 26, 23, { bumps: 4, rough: 0.12, flat: true }, {
  over: sketch([[366, 668], [376, 674], [386, FLOOR + 1]], false),
}, [-Math.PI * 0.3, 0]));

// Middle: lower lamps so the cord hangs down into the U.
lamp("stool-mid", 1.3, shade("b", 158, 584, 30, 36, { bumps: 5, rough: 0.13, flat: true }, {
  under:
    sketch(line(128, 619, 188, 618, 6, 0.8), false) + sketch(line(129, 626, 187, 625, 6, 0.8), false) +
    sketch(line(134, 626, 132, FLOOR, 5, 0.7), false) + sketch(line(182, 626, 184, FLOOR, 5, 0.7), false),
  floorY: 619,
}));
lamp("small-mid", 1.7, shade("d", 238, 646, 28, 31, { bumps: 5, rough: 0.12, flat: true }));
lamp("pebble-mid", 2, shade("c", 190, 660, 19, 17, { bumps: 4, rough: 0.12, flat: true }, {
  over: sketch([[174, 670], [162, 675], [146, FLOOR + 1]], false),
}));

const floor = sketch(line(8, FLOOR + 1, W - 8, FLOOR, 14, 0.7), false).replaceAll('class="ln', 'class="floor ln');

const svg = `<svg class="lamps" viewBox="0 ${H - VIEW} ${W} ${VIEW}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <defs>
    <radialGradient id="halo"><stop offset="0" stop-color="#ffcf87" stop-opacity=".55"/><stop offset=".45" stop-color="#f0a250" stop-opacity=".2"/><stop offset="1" stop-color="#e08a3c" stop-opacity="0"/></radialGradient>
    <radialGradient id="inner" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#fff4da"/><stop offset=".5" stop-color="#ffcf88"/><stop offset="1" stop-color="#d98a45"/></radialGradient>
    <radialGradient id="pool"><stop offset="0" stop-color="#ffcf87" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf87" stop-opacity="0"/></radialGradient>
    <filter id="rough" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="26"/></filter>
  </defs>
  <g class="lamp" style="--i:0">${floor}</g>
  ${lamps.join("\n")}
</svg>`;

const out = new URL("../src/components/hero-lamps.svg", import.meta.url);
fs.writeFileSync(out, svg + "\n");
console.log("hero-lamps.svg", (svg.length / 1024).toFixed(1), "KB");
