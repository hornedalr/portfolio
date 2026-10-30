import { DEFAULT_PHYSICS, type RopePhysics } from "./rope";
import saved from "../data/cord-settings.json";

export interface CordSettings extends RopePhysics {
  /** Cord length at rest, in px. */
  restLength: number;
  /** Simulation points along the cord; more = smoother curve. */
  points: number;
  /** Pull past rest (px) needed before release toggles the theme. */
  trigger: number;
  /** Reel speed for a tap or keyboard tug. */
  tapTug: number;
  /** Sideways nudge when a mouse hovers the ball. */
  hoverNudge: number;
  ballRadius: number;
  cordWidth: number;
  /** How much thinner the cord gets at full stretch. */
  tensionThinning: number;
}

export const DEFAULT_SETTINGS: CordSettings = {
  ...DEFAULT_PHYSICS,
  restLength: 130,
  points: 14,
  trigger: 50,
  tapTug: 2.5,
  hoverNudge: 1.5,
  ballRadius: 13,
  cordWidth: 2.5,
  tensionThinning: 1.1,
};

/** Merges untrusted values over defaults, keeping only known numeric keys. */
export function sanitizeSettings(input: unknown): CordSettings {
  const out = { ...DEFAULT_SETTINGS };
  if (input && typeof input === "object") {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof CordSettings)[]) {
      const v = (input as Record<string, unknown>)[key];
      if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    }
  }
  return out;
}

export const cordSettings: CordSettings = sanitizeSettings(saved);
