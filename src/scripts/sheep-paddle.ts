// The sheep paddling its legs while the cord is pulled all the way out, as if trying to reach the ground: each pair
// of legs moves in opposite directions (one forward while the other goes back) and swaps over, and a leg lifts its
// knee as it swings forward and straightens as it reaches back down.

export interface PaddlePose {
  /** Hip rotation in degrees; negative swings the foot forward. */
  hip: number;
  /** Knee bend in degrees, before the leg's own bend direction is applied. */
  bend: number;
}

export interface PaddleShape {
  /** Hip swing either way, in degrees. */
  swing: number;
  /** Extra knee bend at the top of the forward swing, in degrees. */
  lift: number;
}

/**
 * Pose of one leg at a point in the cycle.
 * @param cycle Position in the loop, 0..1 (it wraps).
 * @param legIndex 0, 1 hind legs and 2, 3 front legs; neighbours move in opposite directions.
 */
export function paddlePose(cycle: number, legIndex: number, shape: PaddleShape): PaddlePose {
  const a = (cycle + (legIndex % 2) * 0.5) * Math.PI * 2;
  const forward = Math.max(0, Math.cos(a));
  return { hip: -shape.swing * Math.sin(a), bend: shape.lift * forward ** 1.5 };
}
