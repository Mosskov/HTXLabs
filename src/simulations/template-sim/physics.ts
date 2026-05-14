// template-sim — pure helpers. Y = slope·X + intercept (deliberately abstract;
// no real physics). `coverWideRange` is the predicate used by the konkluder
// gate in the template lab.
//
// Rule: no React, no DOM, no imports from '@/lab-guide' or '@/sim-runtime'.
// Pure inputs → outputs only.

export interface Measurement {
  x: number;
  y: number;
}

/** Linear relation between X and Y — the only "physics" in this sim. */
export function computeY(x: number, slope: number, intercept: number): number {
  return slope * x + intercept;
}

/** Predicate: the measurement set spans the X slider — at least one point
 *  below 3 and at least one above 7 (slider runs 0..10). Used by the
 *  `wide-range` gate to require students to actually vary X. */
export function coverWideRange(measurements: ReadonlyArray<Measurement>): boolean {
  return measurements.some((m) => m.x < 3) && measurements.some((m) => m.x > 7);
}
