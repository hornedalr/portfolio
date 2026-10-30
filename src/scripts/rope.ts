// Lamp-pull cord: a Verlet rope hanging from a spring-loaded reel. Pure math, no DOM, so it can be unit-tested in Node.
//
// Pulling past the rest length draws extra cord out of the reel (`ext`), spread evenly over every simulated segment
// so the whole cord lengthens and bends as one. On release the reel springs back and hits a hard stop, which flicks
// the handle up and lets it bounce and swing.

/** Physics values that can be changed on a live rope without rebuilding it. */
export interface RopePhysics {
  /** Maximum extra cord that can be pulled out of the reel. */
  maxStretch: number;
  gravity: number;
  /** Velocity kept per step (1 = no air drag). */
  damping: number;
  /** Constraint solver passes per step; higher = stiffer cord. */
  iterations: number;
  /** Speed cap per point, in px per step. */
  maxSpeed: number;
  /** Handle weight relative to one cord segment. */
  handleWeight: number;
  /** Reel spring frequency per step; higher = faster snap back and a bigger fling. */
  reelStiffness: number;
}

export interface RopeOptions extends Partial<RopePhysics> {
  anchorX: number;
  anchorY: number;
  restLength: number;
  points?: number;
}

/** Stretch (px) over which a held cord goes from free-hanging to fully taut. */
const TAUT_EASE = 12;

export const DEFAULT_PHYSICS: RopePhysics = {
  maxStretch: 110,
  gravity: 0.6,
  damping: 0.985,
  iterations: 16,
  maxSpeed: 24,
  handleWeight: 2.5,
  reelStiffness: 0.08,
};

export class Rope {
  readonly n: number;
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  private readonly pxs: Float32Array;
  private readonly pys: Float32Array;
  private readonly inv: Float32Array;
  private readonly o: RopeOptions;
  private readonly baseSeg: number;
  private p: RopePhysics;
  private segLen: number;
  private ext = 0;
  private extV = 0;
  private dragging = false;
  private targetX = 0;
  private targetY = 0;

  constructor(options: RopeOptions) {
    this.o = options;
    this.n = options.points ?? 14;
    this.p = { ...DEFAULT_PHYSICS };
    this.baseSeg = options.restLength / (this.n - 1);
    this.segLen = this.baseSeg;
    this.xs = new Float32Array(this.n);
    this.ys = new Float32Array(this.n);
    this.pxs = new Float32Array(this.n);
    this.pys = new Float32Array(this.n);
    this.inv = new Float32Array(this.n).fill(1);
    this.inv[0] = 0;
    this.configure(options);
    this.reset();
  }

  /** Updates physics in place, keeping the current motion. */
  configure(physics: Partial<RopePhysics>): void {
    for (const key of Object.keys(DEFAULT_PHYSICS) as (keyof RopePhysics)[]) {
      const v = physics[key];
      if (typeof v === "number" && Number.isFinite(v)) this.p[key] = v;
    }
    this.inv[this.n - 1] = 1 / Math.max(this.p.handleWeight, 0.01);
  }

  get handleX(): number {
    return this.xs[this.n - 1];
  }

  get handleY(): number {
    return this.ys[this.n - 1];
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  /** Extra cord currently pulled out of the reel, in pixels. */
  get stretch(): number {
    return this.ext;
  }

  /** Motion remaining in the system; the caller can stop animating once this is ~0. */
  get energy(): number {
    let e = 0;
    for (let i = 1; i < this.n; i++) {
      const vx = this.xs[i] - this.pxs[i];
      const vy = this.ys[i] - this.pys[i];
      e += vx * vx + vy * vy;
    }
    return e + this.ext + Math.abs(this.extV);
  }

  reset(): void {
    for (let i = 0; i < this.n; i++) {
      this.xs[i] = this.pxs[i] = this.o.anchorX;
      this.ys[i] = this.pys[i] = this.o.anchorY + i * this.baseSeg;
    }
    this.segLen = this.baseSeg;
    this.ext = 0;
    this.extV = 0;
  }

  startDrag(x: number, y: number): void {
    this.dragging = true;
    this.extV = 0;
    this.setDragTarget(x, y);
  }

  /** Pointer target for the handle; pulling past rest length gets progressively harder, like a spring. */
  setDragTarget(x: number, y: number): void {
    const { anchorX, anchorY, restLength } = this.o;
    const { maxStretch } = this.p;
    let dx = x - anchorX;
    let dy = Math.max(y - anchorY, 8);
    const d = Math.hypot(dx, dy);
    if (d > restLength) {
      const eased = restLength + maxStretch * Math.tanh((d - restLength) / maxStretch);
      dx *= eased / d;
      dy *= eased / d;
    }
    this.targetX = anchorX + dx;
    this.targetY = anchorY + dy;
  }

  endDrag(): void {
    if (!this.dragging) return;
    this.dragging = false;
    // Break perfect vertical symmetry so a slack rope can't stay folded onto itself.
    this.xs[this.n >> 1] += 0.5;
  }

  /** Yanks cord out of the reel at the given speed (px/step), e.g. for a tap- or keyboard-triggered tug. */
  tug(speed: number): void {
    if (this.dragging) return;
    this.extV = speed;
  }

  /** Adds velocity to the handle, e.g. a small sideways nudge on hover. */
  impulse(vx: number, vy: number): void {
    const h = this.n - 1;
    this.pxs[h] -= vx;
    this.pys[h] -= vy;
  }

  /** Advances one fixed 60 Hz step. */
  step(): void {
    const { n, xs, ys, pxs, pys, inv } = this;
    const h = n - 1;
    const { anchorX, anchorY } = this.o;

    if (this.dragging) {
      this.ext = Math.max(0, Math.hypot(this.targetX - anchorX, this.targetY - anchorY) - this.o.restLength);
    } else if (this.ext > 0 || this.extV !== 0) {
      this.extV -= this.p.reelStiffness * this.p.reelStiffness * this.ext;
      this.ext += this.extV;
      if (this.ext <= 0) {
        this.ext = 0;
        this.extV = 0;
      }
    }

    this.segLen = this.baseSeg + this.ext / h;

    for (let i = 1; i < n; i++) {
      if (i === h && this.dragging) {
        pxs[h] = xs[h];
        pys[h] = ys[h];
        xs[h] = this.targetX;
        ys[h] = this.targetY;
        continue;
      }
      let vx = (xs[i] - pxs[i]) * this.p.damping;
      let vy = (ys[i] - pys[i]) * this.p.damping;
      const speed = Math.hypot(vx, vy);
      const maxSpeed = this.p.maxSpeed;
      if (speed > maxSpeed) {
        vx *= maxSpeed / speed;
        vy *= maxSpeed / speed;
      }
      pxs[i] = xs[i];
      pys[i] = ys[i];
      xs[i] += vx;
      ys[i] += vy + this.p.gravity;
    }

    const handleInv = this.dragging ? 0 : inv[h];
    for (let k = 0; k < this.p.iterations; k++) {
      for (let i = 0; i < h; i++) {
        const j = i + 1;
        const dx = xs[j] - xs[i];
        const dy = ys[j] - ys[i];
        const d = Math.hypot(dx, dy);
        // A cord only resists stretching; slack segments are free to bunch up.
        if (d <= this.segLen) continue;
        const wa = inv[i];
        const wb = j === h ? handleInv : inv[j];
        const sum = wa + wb;
        if (sum === 0) continue;
        const diff = (d - this.segLen) / d / sum;
        xs[i] += dx * diff * wa;
        ys[i] += dy * diff * wa;
        xs[j] -= dx * diff * wb;
        ys[j] -= dy * diff * wb;
      }
    }

    // A cord pulled past its rest length is under tension and cannot sag; ease it onto the anchor-handle line.
    if (this.dragging && this.ext > 0) {
      const k = Math.min(this.ext / TAUT_EASE, 1);
      for (let i = 1; i < h; i++) {
        const t = i / h;
        xs[i] += (xs[0] + (xs[h] - xs[0]) * t - xs[i]) * k;
        ys[i] += (ys[0] + (ys[h] - ys[0]) * t - ys[i]) * k;
      }
    }

    // Follow-the-leader pass removes residual solver stretch so the rest pose is exact.
    if (!this.dragging) {
      for (let i = 0; i < h; i++) {
        const dx = xs[i + 1] - xs[i];
        const dy = ys[i + 1] - ys[i];
        const d = Math.hypot(dx, dy);
        if (d > this.segLen) {
          xs[i + 1] = xs[i] + (dx / d) * this.segLen;
          ys[i + 1] = ys[i] + (dy / d) * this.segLen;
        }
      }
    }
  }

  /** Smooth SVG path from the anchor through the rope points. */
  toPath(): string {
    const { n, xs, ys } = this;
    let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
    for (let i = 1; i < n - 1; i++) {
      const mx = (xs[i] + xs[i + 1]) / 2;
      const my = (ys[i] + ys[i + 1]) / 2;
      d += ` Q${xs[i].toFixed(1)} ${ys[i].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    d += ` L${xs[n - 1].toFixed(1)} ${ys[n - 1].toFixed(1)}`;
    return d;
  }
}
