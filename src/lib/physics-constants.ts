/**
 * Project-wide physical constants. Sim-specific data tables (instrument
 * catalogues, apparatus parameters) belong in the sim's own folder, not here.
 *
 * Add constants on demand — don't pre-populate. Each entry needs a short
 * Danish comment naming the unit, and a note for values that vary by location
 * (like G_DK).
 */

/** Tyngdeacceleration i Danmark (~56° N), m/s². Varierer med breddegrad. */
export const G_DK = 9.82;
