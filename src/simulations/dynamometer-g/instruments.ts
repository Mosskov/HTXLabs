/**
 * Per-instrument scale data for the dynamometer-g sim. Source of truth for
 * the dynamometer enum advertised in meta.ts.
 *
 * Tick spacing follows typical school dynamometers (5 minor steps per major).
 */

export interface DynamometerSpec {
  scaleMax: number;
  majorTick: number;
  minorTick: number;
  label: string;
}

export const DYNAMOMETERS = {
  'dynamometer-1N': { scaleMax: 1, majorTick: 0.2, minorTick: 0.04, label: '1 N' },
  'dynamometer-5N': { scaleMax: 5, majorTick: 1, minorTick: 0.2, label: '5 N' },
  'dynamometer-10N': { scaleMax: 10, majorTick: 2, minorTick: 0.4, label: '10 N' },
  'dynamometer-50N': { scaleMax: 50, majorTick: 10, minorTick: 2, label: '50 N' },
} as const satisfies Record<string, DynamometerSpec>;

export type DynamometerId = keyof typeof DYNAMOMETERS;

const DEFAULT_DYNAMOMETER: DynamometerSpec = DYNAMOMETERS['dynamometer-10N'];

/** Look up a dynamometer spec by id; falls back to the 10 N spec for unknown ids. */
export function dynamometerSpec(id: string): DynamometerSpec {
  return (DYNAMOMETERS as Record<string, DynamometerSpec>)[id] ?? DEFAULT_DYNAMOMETER;
}
