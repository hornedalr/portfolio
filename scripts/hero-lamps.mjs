// Generates the hand-sketched hero lamps: one unlit and one lit image per lamp in src/assets/lamps/, and their placement in src/components/hero-lamps.json.
// Run: node scripts/hero-lamps.mjs   (SEED=n picks a different hand-drawn wobble).
import fs from "node:fs";

let seed = Number(process.env.SEED ?? 7);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const r = (a, b) => a + rnd() * (b - a);
// Whole units are plenty for a pencil line and keep the inlined SVG small.
const f = (n) => Math.round(n);

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
  const a = `<path class="ln" d="${curve(jitter(pts, 0.6), closed)}"/>`;
  const start = Math.floor(r(0, pts.length));
  const part = closed ? [...pts.slice(start), ...pts.slice(0, start)].slice(0, Math.floor(pts.length * r(0.45, 0.7))) : pts;
  return a + `<path class="ln ln2" d="${curve(jitter(part, 1.6), false)}"/>`;
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
    return `<path class="ln wisp" d="${curve(pts, false)}"/>`;
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
  return `<path class="${cls}" d="${curve(pts, false)}"/>`;
};

// Short pencil rays around a lit lamp.
const rays = (cx, cy, rx, ry, count, from, to) =>
  Array.from({ length: count }, (_, i) => {
    const a = from + ((to - from) * (i + r(0.25, 0.75))) / count;
    const ex = cx + Math.cos(a) * rx, ey = cy + Math.sin(a) * ry;
    const g = r(9, 14), len = r(7, 12);
    return `<path class="ray" d="M${f(ex + Math.cos(a) * g)} ${f(ey + Math.sin(a) * g)} L${f(ex + Math.cos(a) * (g + len))} ${f(ey + Math.sin(a) * (g + len))}"/>`;
  }).join("");

// Each drawing lives in a box 700 units tall; the top part is empty, so only the lower VIEW units are shown.
const H = 700, FLOOR = 676, VIEW = 470;
let uid = 0;
// The area the last lamp drew into (its glow included), so each lamp can be cut out as its own image.
let box;

// Marbling has its own random sequence, so choosing or changing it never alters the pencil wobble of the lamps.
let seed2 = 11;
const withMarbleRandom = (fn) => {
  const main = seed;
  seed = seed2;
  const out = fn();
  seed2 = seed;
  seed = main;
  return out;
};
// Where the last pendant's cord leaves its shade, for drawing() to hang it up.
let hang = null;
// High above the picture: pendant cords run up to here and the hero clips them at its top edge.
const CEILING = -700;

// Set per lamp by drawing(): "plain" wool glows amber, "marbled" (black and white wool) glows white with dark
// veins taking over much of it, "brown" glows a deep cognac.
let wool = "plain";

// Dark wool running through the lamp in soft, overlapping veins (not the crisp islands of a cow print), plus a
// few loose specks. density scales how much of the lamp they cover.
const veins = (cx, cy, rx, ry, density) =>
  withMarbleRandom(() => {
    const m = Math.min(rx, ry, 46);
    const out = [];
    const veinCount = Math.max(1, Math.round(((rx * ry) / 900) * density));
    for (let v = 0; v < veinCount; v++) {
      const a = r(0, 6.28), d = Math.sqrt(r(0, 1)) * 0.8;
      let x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      let dir = r(0, 6.28);
      const steps = Math.round(r(3, 7) * density);
      for (let i = 0; i < steps; i++) {
        const size = r(0.2, 0.5) * m + 2;
        const pts = blob(x, y, size * r(0.8, 1.6), size * r(0.6, 1.1), { bumps: 3, rough: 0.3, n: 14 });
        out.push(`<path opacity="${r(0.55, 1).toFixed(2)}" d="${curve(pts, true)}"/>`);
        dir += r(-0.7, 0.7);
        x += Math.cos(dir) * size * 0.9;
        y += Math.sin(dir) * size * 0.9 * (ry / Math.max(rx, ry) + 0.4);
      }
    }
    for (let i = 0; i < Math.round(4 * density); i++) {
      const a = r(0, 6.28), d = Math.sqrt(r(0, 1)) * 0.9;
      const size = r(0.06, 0.14) * m + 1.5;
      out.push(`<path opacity="${r(0.5, 0.9).toFixed(2)}" d="${curve(blob(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, size, size, { bumps: 3, rough: 0.3, n: 10 }), true)}"/>`);
    }
    return out.join("");
  });
// Streaks of dark fibre, mostly running one way and curling like carded wool: what makes marbled wool look like
// wool rather than a cow print.
const fibres = (cx, cy, rx, ry, density) =>
  withMarbleRandom(() => {
    const m = Math.min(rx, ry, 46);
    const flow = r(0, Math.PI);
    return Array.from({ length: Math.round(((rx * ry) / 220) * density) + 1 }, () => {
      const a = r(0, 6.28), d = Math.sqrt(r(0, 1)) * 1.05;
      let x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      let dir = flow + r(-0.6, 0.6);
      const step = r(0.25, 0.6) * m;
      const pts = [[x, y]];
      for (let i = 0; i < 4; i++) {
        dir += r(-0.5, 0.5);
        x += Math.cos(dir) * step;
        y += Math.sin(dir) * step;
        pts.push([x, y]);
      }
      return `<path stroke-width="${r(1, 0.16 * m + 1.5).toFixed(1)}" opacity="${r(0.35, 0.85).toFixed(2)}" d="${curve(pts, false)}"/>`;
    }).join("");
  });

let onDesktop = false;
let lampKind = "";
// Shafts use their own random sequence so they never change the pencil wobble.
let shaftSeed = 991;
const sr = (a, b) => a + ((shaftSeed = (shaftSeed * 48271) % 2147483647) / 2147483647) * (b - a);
// Soft beams of light leaving the lamp: tapered wedges that fade out along their length, blurred. The hanging lamps
// always get them, about a third of the others do on phones; they're fainter on desktop, where the row is busier. They
// fade out just above the floor so they don't spill down into the works.
const shafts = (cx, cy, hx, hy, id, white, dim) => {
  const hanging = lampKind === "pendant" || lampKind === "floor";
  const lucky = sr(0, 1) < (onDesktop ? 0 : 0.3) || hanging;
  // The white pendant on phones keeps the beams it was first drawn with (down and to the right), from its own copy of
  // the sequence; the shared one still moves on exactly as before so no other lamp changes.
  const nShared = Math.round(sr(3, 6));
  const classic = !onDesktop && white && hanging;
  let seed = 991;
  const rand = classic ? (a, b) => a + ((seed = (seed * 48271) % 2147483647) / 2147483647) * (b - a) : sr;
  if (classic) for (let k = 0; k < nShared * 3; k++) sr(0, 1);
  const n = classic ? Math.round(rand(3, 6)) : nShared;
  const strength = (onDesktop ? 0.55 : 1) * (dim ? 0.6 : 1) * (classic ? 0.85 : 1);
  const reach = Math.max(hx, hy) * 2.1;
  const colour = white ? "#fff6e6" : dim ? "#e9a764" : "#ffcf87";
  let svg = `<radialGradient id="${id}s" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(reach)}"><stop offset="0" stop-color="${colour}" stop-opacity="${(0.3 * strength).toFixed(3)}"/><stop offset=".35" stop-color="${colour}" stop-opacity="${(0.12 * strength).toFixed(3)}"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></radialGradient>`;
  svg += `<g mask="url(#aboveFloor)"><g filter="url(#shaftBlur)" fill="url(#${id}s)">`;
  for (let k = 0; k < n; k++) {
    // Mostly sideways and downwards, where the shade's opening and gaps in the wool would let light out.
    const a = rand(-0.25, 1.15) * Math.PI + (k / n) * 0.6;
    const half = rand(0.07, 0.16);
    const len = reach * rand(0.6, 1);
    const p = (ang, d) => `${f(cx + Math.cos(ang) * d)} ${f(cy + Math.sin(ang) * d * (hy / hx) ** 0.5)}`;
    svg += `<path d="M${p(a - half * 2.2, Math.min(hx, hy) * 0.35)} L${p(a - half, len)} Q${p(a, len * 1.06)} ${p(a + half, len)} L${p(a + half * 2.2, Math.min(hx, hy) * 0.35)}Z"/>`;
  }
  return lucky ? { svg: svg + "</g></g>", reach } : { svg: "", reach: 0 };
};

// A mask that fades a halo out towards its top along an uneven, wavy edge: a vertical gradient pushed about by noise.
const frayTop = (id, cx, cy, hx, hy, ry) => {
  const x = cx - hx * 1.6, y = cy - hy * 1.6, w = hx * 3.2, h = hy * 3.2;
  return `<linearGradient id="${id}t" gradientUnits="userSpaceOnUse" x1="0" y1="${f(cy - hy * 1.05)}" x2="0" y2="${f(cy - ry * 0.4)}"><stop offset="0" stop-color="#000"/><stop offset=".55" stop-color="#8a8a8a"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <filter id="${id}r" filterUnits="userSpaceOnUse" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"><feTurbulence type="fractalNoise" baseFrequency=".022 .009" numOctaves="2" seed="11"/><feDisplacementMap in="SourceGraphic" scale="${f(hy * 0.9)}" xChannelSelector="R" yChannelSelector="G"/></filter>
      <mask id="${id}m" maskUnits="userSpaceOnUse" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"><rect x="${f(x - 100)}" y="${f(y - 100)}" width="${f(w + 200)}" height="${f(h + 200)}" fill="url(#${id}t)" filter="url(#${id}r)"/></mask>`;
};

// A lamp: warm layer (glow, floor pool, glowing fill, rays) under the pencil outline and wisps. The warm layer is
// wrapped in markers so the unlit image can leave it out.
const shade = (cx, cy, rx, ry, opts, extra = {}, rayArc = [-Math.PI, 0]) => {
  const id = `c${uid++}`;
  const pts = blob(cx, cy, rx, ry, opts);
  const d = curve(pts, true);
  const floorY = extra.floorY ?? FLOOR;
  // The white pendants' halos are frayed at the top so they don't read as domes; on desktop it also glows a little less.
  const ragged = wool === "marbled" && (lampKind === "pendant" || lampKind === "floor");
  // The brown pendant on desktop glows dimmer and a deeper amber than the bright wool.
  const dim = onDesktop && wool === "brown" && (lampKind === "pendant" || lampKind === "floor");
  const grow = 1.35 * (ragged && onDesktop ? 0.88 : 1);
  const hx = rx * 2.4 * grow, hy = Math.min(ry * 1.9, ry + 90) * grow;
  const beams = shafts(cx, cy, hx, hy, id, wool === "marbled", dim);
  // The rough filter grows the halo by up to 20% plus its displacement. The glow is kept whole below the floor too, so it
  // spills softly over the edge of the hero instead of stopping in a straight line.
  const ex = Math.max(hx * 1.2 + 14, rx + 52, beams.reach + 30), ey = Math.max(hy * 1.2 + 14, ry + 30, beams.reach + 30);
  box = [cx - ex, cy - ey, cx + ex, Math.max(FLOOR + 12, cy + ey)];
  // The lit lamps used to be hatched with scribbles. They're filled now, but the scribbles are still generated
  // (and thrown away) so the random sequence, and with it every lamp's unlit sketch, stays exactly the same.
  scribble(cx - rx, cy - ry, rx * 2, ry * 2, Math.max(7, Math.min(ry / 5, 12)), 0.45);
  scribble(cx - rx, cy - ry, rx * 2, ry * 2, Math.max(9, Math.min(ry / 4, 15)), -0.3);
  const fill =
    wool === "marbled"
      ? `<path d="${d}" fill="url(#pale)"/><g clip-path="url(#${id})" class="blotch" filter="url(#felt)">${veins(cx, cy, rx, ry, 0.25)}<g class="fibre">${fibres(cx, cy, rx, ry, 1)}</g></g>`
      : wool === "brown"
        ? `<path d="${d}" fill="url(#brown)"/><g clip-path="url(#${id})" class="mottle" filter="url(#felt)">${veins(cx, cy, rx, ry, 0.7)}</g>`
        : `<path d="${d}" fill="url(#inner)"/>`;
  // The lamps used to throw little rays of light. They're gone, but still generated (and thrown away) to keep the
  // random sequence.
  rays(cx, cy, rx, ry, Math.round(r(4, 6)), ...rayArc);
  return `
    <clipPath id="${id}"><path d="${d}"/></clipPath>
    <path class="bg" d="${d}"/>
    <!--w--><g class="warm">
      ${beams.svg}
      ${ragged ? frayTop(id, cx, cy, hx, hy, ry) : ""}
      <ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(hx)}" ry="${f(hy)}" fill="url(#${wool === "marbled" ? "haloWhite" : dim ? "haloDim" : "halo"})" filter="url(#rough)"${ragged ? ` mask="url(#${id}m)"` : ""}/>
      <ellipse cx="${f(cx)}" cy="${f(floorY)}" rx="${f(rx * 1.7)}" ry="8" fill="url(#pool)"/>
      ${fill}
    </g><!--/w-->
    ${(extra.under ?? "").replaceAll('class="ln', 'class="sup ln')}
    ${sketch(pts, true)}
    ${wisps(cx, cy, rx, ry, Math.round(Math.max(rx, ry) / 14) + 2)}
    ${(extra.over ?? "").replaceAll('class="ln', 'class="sup ln')}`;
};
// The kinds of lamp, standing on the floor at x. s scales a lamp around its foot. Each call draws a fresh copy
// with its own hand-drawn wobble.
const up = (y, s) => FLOOR - (FLOOR - y) * s;
const kinds = {
  // A pendant: a wide wool shade hanging from a cord that runs up out of the picture (drawn as its own image).
  floor: (x, s = 1) => {
    // Its old floor stand is still generated and dropped, so the other lamps keep their exact wobble.
    sketch(line(x, up(396, s), x - 3, FLOOR - 4, 10, 1), false) + sketch(blob(x - 3, FLOOR - 3, 22 * s, 5, { bumps: 3, rough: 0.05, n: 14 }), true);
    const cy = up(352, s), ry = 46 * s;
    // The cord runs down to the middle of the shade, which hides its end, so it can never fall short.
    hang = [x, cy];
    return shade(x, cy, 56 * s, ry, { bumps: 4, rough: 0.13 }, {}, [Math.PI * 0.05, Math.PI * 0.95]);
  },  // A pendant hanging at its own height: cy is the middle of the shade (the first pendants hang at 352).
  pendant: (x, s = 1, cy = 352) => {
    const ry = 46 * s;
    // The cord runs down to the middle of the shade, which hides its end, so it can never fall short.
    hang = [x, cy];
    return shade(x, cy, 56 * s, ry, { bumps: 4, rough: 0.13 }, {}, [Math.PI * 0.05, Math.PI * 0.95]);
  },
  tall: (x, s = 1) => shade(x, up(590, s), 32 * s, 86 * s, { bumps: 5, rough: 0.08, flat: true, square: 0.85 }, {}, [Math.PI * 0.9, Math.PI * 1.3]),
  boulder: (x, s = 1) => shade(x, up(630, s), 36 * s, 46 * s, { bumps: 5, rough: 0.12, flat: true }, {}, [-Math.PI * 0.8, -Math.PI * 0.3]),
  pebble: (x, s = 1, cord = 0) =>
    shade(x, up(660, s), 20 * s, 17 * s, { bumps: 4, rough: 0.12, flat: true }, {
      over: cord ? sketch([[x + cord * 16, 670], [x + cord * 28, 675], [x + cord * 44, FLOOR + 1]], false) : "",
    }, [Math.PI * 0.95, Math.PI * 1.2]),
  column: (x, s = 1) => shade(x, up(512, s), 40 * s, 162 * s, { bumps: 6, rough: 0.05, flat: true, n: 40, square: 0.85 }, {}, [-Math.PI * 1.05, -Math.PI * 0.1]),
  egg: (x, s = 1) => shade(x, up(604, s), 33 * s, 70 * s, { bumps: 4, rough: 0.1, flat: true }, {}, [-Math.PI * 0.9, -Math.PI * 0.45]),
  // A boulder lamp on a little stool.
  stool: (x, s = 1) =>
    shade(x, up(584, s), 30 * s, 36 * s, { bumps: 5, rough: 0.13, flat: true }, {
      under:
        sketch(line(x - 30 * s, up(619, s), x + 30 * s, up(618, s), 6, 0.8), false) + sketch(line(x - 29 * s, up(626, s), x + 29 * s, up(625, s), 6, 0.8), false) +
        sketch(line(x - 24 * s, up(626, s), x - 26 * s, FLOOR, 5, 0.7), false) + sketch(line(x + 24 * s, up(626, s), x + 26 * s, FLOOR, 5, 0.7), false),
      floorY: up(619, s),
    }),
  small: (x, s = 1) => shade(x, up(646, s), 28 * s, 31 * s, { bumps: 5, rough: 0.12, flat: true }),
};

const defs = `<defs>
    <radialGradient id="inner" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#fff4da"/><stop offset=".5" stop-color="#ffcf88"/><stop offset="1" stop-color="#d98a45"/></radialGradient>
    <radialGradient id="pale" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#fff8ec"/><stop offset="1" stop-color="#ecd3b4"/></radialGradient>
    <radialGradient id="brown" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#ffcf8f"/><stop offset=".5" stop-color="#c97a3c"/><stop offset="1" stop-color="#6e3d1f"/></radialGradient>
    <filter id="felt" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <radialGradient id="pool"><stop offset="0" stop-color="#ffcf87" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf87" stop-opacity="0"/></radialGradient>
    <filter id="rough" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="26"/></filter>
    <radialGradient id="halo"><stop offset="0" stop-color="#ffcf87" stop-opacity=".55"/><stop offset=".2" stop-color="#fbbd72" stop-opacity=".34"/><stop offset=".45" stop-color="#f0a250" stop-opacity=".14"/><stop offset=".72" stop-color="#e8954a" stop-opacity=".045"/><stop offset="1" stop-color="#e08a3c" stop-opacity="0"/></radialGradient>
    <radialGradient id="haloWhite"><stop offset="0" stop-color="#fffaf0" stop-opacity=".6"/><stop offset=".2" stop-color="#fff2de" stop-opacity=".38"/><stop offset=".45" stop-color="#fbe9cc" stop-opacity=".15"/><stop offset=".72" stop-color="#f6dfbf" stop-opacity=".05"/><stop offset="1" stop-color="#f2d9b4" stop-opacity="0"/></radialGradient>
    <radialGradient id="haloDim"><stop offset="0" stop-color="#f0b26a" stop-opacity=".4"/><stop offset=".2" stop-color="#d98f4c" stop-opacity=".24"/><stop offset=".45" stop-color="#c47a3a" stop-opacity=".1"/><stop offset=".72" stop-color="#b56e33" stop-opacity=".03"/><stop offset="1" stop-color="#a8642e" stop-opacity="0"/></radialGradient>
    <linearGradient id="floorFade" gradientUnits="userSpaceOnUse" x1="0" y1="${FLOOR - 90}" x2="0" y2="${FLOOR}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <mask id="aboveFloor" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="8000" height="8000"><rect x="-3000" y="-3000" width="8000" height="8000" fill="url(#floorFade)"/></mask>
    <filter id="shaftBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>`;

// Colours match the site theme: unlit lamps use the light theme, lit ones the dark theme.
const styles = {
  off: ".ln{stroke:#4f4a44;stroke-width:1.35}.ln2{stroke-width:.8;opacity:.55}.wisp{stroke-width:.9;opacity:.45}.floor{opacity:.35}.bg{fill:#faf8f4}",
  on:
    ".ln{stroke:#4a3526;stroke-width:1.35}.ln2{stroke-width:.8;opacity:.55}.wisp{stroke-width:.9;opacity:.45}.sup,.floor{stroke:#c9a582}.sup.pale{stroke:#cdc0b0}.floor{opacity:.25}.bg{fill:#3d2d26}" +
    ".blotch{fill:#1f1612}.fibre{fill:none;stroke:#1f1612;stroke-linecap:round}.mottle{fill:#4a2614;opacity:.55}",
};
const svg = (x0, y0, w, h, body, on) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}" fill="none" stroke-linecap="round" stroke-linejoin="round"><style>${on ? styles.on : styles.off}</style>${on ? defs : ""}${on ? body : body.replace(/<!--w-->[\s\S]*?<!--\/w-->/g, "")}</svg>\n`.replace(/<!--\/?w-->/g, "");

// Every lamp becomes two images, unlit and lit, written to src/assets/lamps/. The page stacks them and only
// fades or flickers whole images, which is far cheaper than animating hundreds of pencil strokes.
const dir = new URL("../src/assets/lamps/", import.meta.url);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
let bytes = 0;
const write = (name, x0, y0, w, h, body) => {
  for (const on of [false, true]) {
    const text = svg(x0, y0, w, h, body, on);
    bytes += text.length;
    fs.writeFileSync(new URL(`${name}${on ? "-on" : ""}.svg`, dir), text);
  }
};
const pct = (n) => +n.toFixed(3);

// lamps: [kind, x, order, scale?, extra?] listed back to front: each lamp's background-coloured body hides what's
// behind it. order (--i) = when it fades in: the sides first, then inward, so the U closes around the cord.
// marbled / brown: indexes into lamps of the ones made of black and white, or brown, wool.
const drawing = (prefix, W, lamps, { marbled = [], brown = [] } = {}) => {
  onDesktop = prefix === "d";
  const top = H - VIEW;
  const place = (name, x0, y0, w, order, drop = false) => ({ name, order, drop, left: pct((x0 / W) * 100), top: pct(((y0 - top) / VIEW) * 100), width: pct((w / W) * 100) });
  const floor = sketch(line(8, FLOOR + 1, W - 8, FLOOR, Math.round(W / 28), 0.7), false).replaceAll('class="ln', 'class="floor ln');
  write(`${prefix}-floor`, 0, FLOOR - 6, W, 12, floor);
  const out = [place(`${prefix}-floor`, 0, FLOOR - 6, W, 0)];
  lamps.forEach(([kind, x, order, s, extra], n) => {
    wool = marbled.includes(n) ? "marbled" : brown.includes(n) ? "brown" : "plain";
    hang = null;
    lampKind = kind;
    const body = kinds[kind](x, s, extra);
    const [x0, y0, x1, y1] = box.map(Math.round);
    if (hang) {
      const [hx, hy] = hang;
      // Black and white lamps glow whiter, so their cords are a cooler, paler tan.
      const cordClass = wool === "marbled" ? 'class="sup pale ln' : 'class="sup ln';
      const cord = withMarbleRandom(() => sketch(line(hx + r(-3, 3), CEILING, hx, hy, 14, 1.4), false)).replaceAll('class="ln', cordClass);
      write(`${prefix}-${n}-cord`, hx - 10, CEILING, 20, hy - CEILING + 4, cord);
      out.push(place(`${prefix}-${n}-cord`, hx - 10, CEILING, 20, order, true));
    }
    write(`${prefix}-${n}`, x0, y0, x1 - x0, y1 - y0, body);
    // Pendants drop in from above; everything standing on the floor rises from below.
    out.push(place(`${prefix}-${n}`, x0, y0, x1 - x0, order, !!hang));
  });
  return { width: W, height: VIEW, lamps: out };
};
// Phone: a crowded U in 390 units — the floor lamp's cluster on the left, a wool column on the right, low lamps
// in the middle under the cord.
const phone = drawing("m", 390, [
  ["floor", 66, 0],
  ["tall", 34, 0.35],
  ["boulder", 96, 0.6],
  ["pebble", 52, 0.85],
  ["column", 336, 0.2, 0.74],
  ["small", 366, 0.45, 0.95],
  ["egg", 288, 0.6],
  ["pebble", 322, 0.85, 1.05, 1],
  ["stool", 158, 1.3],
  ["small", 238, 1.7],
  ["pebble", 190, 2, 0.95, -1],
  // A smaller pendant on the right, hanging a little higher than the left one.
  ["pendant", 340, 0.3, 0.62, 312],
], { marbled: [0, 8], brown: [2, 9] });

// Desktop: the same clusters pushed out to the edges of a 1200-unit-wide row, with copies filling the gaps and
// getting lower towards the cord in the middle (x = 600).
const DW = 1200;
const wideLamps = [
  // Back row: the tallest pieces.
  ["floor", 66, 0],
  ["column", 1150, 0],
  ["floor", 300, 0.6, 0.8],
  ["column", 960, 0.6, 0.72],
  ["tall", 1060, 0.4, 0.95],
  ["tall", 410, 1, 0.75],
  // Front row: crowding round the feet of the tall ones.
  ["tall", 34, 0.35],
  ["boulder", 96, 0.6],
  ["pebble", 52, 0.85],
  ["egg", 196, 0.5],
  ["small", 252, 0.8],
  ["stool", 352, 1.1],
  ["pebble", 300, 1.2, 1, -1],
  ["boulder", 470, 1.5, 0.75],
  ["small", 530, 1.9, 0.8],
  ["egg", 1092, 0.6],
  ["pebble", 1146, 0.85, 1.3, 1],
  ["boulder", 1004, 0.8, 0.9],
  ["egg", 880, 1.1, 0.85],
  ["stool", 780, 1.5],
  ["small", 700, 1.8, 0.85],
  ["pebble", 652, 2.1, 0.95, -1],
  ["pebble", 930, 1.3],
  // Between the sheep and the right edge, hanging a little higher than the pendant on the far left.
  ["pendant", 900, 0.3, 0.9, 330],
];
const desktop = drawing("d", DW, wideLamps, { marbled: [11, 23], brown: [2, 7, 14, 17, 22] });

fs.writeFileSync(new URL("../src/components/hero-lamps.json", import.meta.url), JSON.stringify({ phone, desktop }, null, 2) + "\n");
console.log("lamp images", (bytes / 1024).toFixed(1), "KB");
