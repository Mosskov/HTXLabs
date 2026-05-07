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

export interface DynamometerSpec {
  scaleMax: number;
  majorTick: number;
  minorTick: number;
  label: string;
}

/**
 * Per-instrument scale data. Keys match `meta.paramSchema.dynamometer.values`.
 * Tick spacing follows typical school dynamometers (10 minor steps per major).
 */
export const DYNAMOMETERS: Record<string, DynamometerSpec> = {
  'dynamometer-1N': { scaleMax: 1, majorTick: 0.2, minorTick: 0.02, label: '1 N' },
  'dynamometer-5N': { scaleMax: 5, majorTick: 1, minorTick: 0.1, label: '5 N' },
  'dynamometer-10N': { scaleMax: 10, majorTick: 2, minorTick: 0.2, label: '10 N' },
  'dynamometer-50N': { scaleMax: 50, majorTick: 10, minorTick: 1, label: '50 N' },
};

const DEFAULT_DYNAMOMETER: DynamometerSpec = DYNAMOMETERS['dynamometer-10N'] as DynamometerSpec;

/** Look up a dynamometer spec by id; falls back to the 10 N spec for unknown ids. */
export function dynamometerSpec(id: string): DynamometerSpec {
  return DYNAMOMETERS[id] ?? DEFAULT_DYNAMOMETER;
}
