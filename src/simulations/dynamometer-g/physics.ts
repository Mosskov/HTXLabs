/**
 * dynamometer-g — pure physics functions. Unit-tested in tests/unit/simulations/dynamometer-g/physics.test.ts.
 *
 * Rule: no React, no DOM, no imports from '@/lab-guide' or '@/sim-runtime'.
 * Pure inputs → outputs only.
 */

/** Tyngdeacceleration g i Danmark, m/s². */
export const G_DK = 9.82;

/** Tyngdekraft på en hængende masse: F = m·g. */
export function forceFor(mass: number, g: number = G_DK): number {
  return mass * g;
}

/**
 * Map a force onto a chosen dynamometer's full-scale range.
 * If the force exceeds the scale the indicator pegs at max and `overScale` is
 * true so the UI can render an "uden for skala" tag (SPEC §20).
 */
export function pegReading(
  force: number,
  scaleMax: number,
): { reading: number; overScale: boolean } {
  if (force > scaleMax) return { reading: scaleMax, overScale: true };
  if (force < 0) return { reading: 0, overScale: false };
  return { reading: force, overScale: false };
}
