/**
 * Visual tokens for `mekanik` simulations.
 *
 * Imported by every mekanik sim so that the topic looks coherent across labs
 * (dynamometer, pendul, friktion, …). Other topics get their own sibling
 * folder under `_shared/`.
 *
 * Keep this file flat and plain — colleagues should be able to read it and
 * tweak a hex value without learning a system. See ./STYLE.md for the
 * conventions these tokens encode.
 */

export const COLORS = {
  /** Primary structural strokes and dark fills (caps, ceiling bar). */
  navy: '#3a4a63',
  /** Lighter navy for cap top-edge highlight (pill 3D illusion). */
  navyHighlight: '#5a6a83',
  /** Body interior — slightly off-white so ticks read clearly. Used as the mid stop in the body gradient. */
  bodyFill: '#fafbfc',
  /** Left highlight stop for the body gradient (cylindrical-tube illusion). */
  bodyFillHighlight: '#ffffff',
  /** Right shadow stop for the body gradient. */
  bodyFillShadow: '#e8edf2',
  /** Hatched ceiling lines. */
  hatch: '#3a4a63',
  /** Indicator arrow + over-scale break-apart strokes. */
  indicator: '#e53935',
  /** Mass badge background — used as the mid stop in the metallic badge gradient. */
  badgeFill: '#3b82f6',
  /** Bright highlight band in the metallic badge gradient. */
  badgeFillHighlight: '#7baef5',
  /** Top/bottom edges of the metallic badge gradient. */
  badgeFillShadow: '#1e5fc7',
  /** Text on the mass badge. */
  badgeText: '#ffffff',
  /** Tick / scale numeric labels. */
  scaleText: '#3a4a63',
  /** Outer card background (when sim is shown without a parent panel). */
  cardFill: '#f5f7fa',
  /** Outer card border. */
  cardBorder: '#e3e8ef',
} as const;

export const STROKE = {
  thin: 1,
  medium: 1.5,
  thick: 2,
  /** Ceiling bar / caps — the heaviest strokes. */
  bar: 2.5,
} as const;

export const FONT = {
  /** Tick numbers on the scale. */
  tick: 10,
  /** "N" label on the top cap. */
  cap: 12,
  /** Mass badge ("0,027 kg"). */
  badge: 13,
  /** Over-scale "UPS!" alert. */
  alert: 14,
  family: 'system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

export const RADIUS = {
  /** Mass badge corner radius. */
  badge: 4,
  /** Top + bottom navy caps. */
  cap: 4,
  /** Dynamometer body. */
  body: 6,
  /** Outer card. */
  card: 12,
} as const;

/** Shared transition for input-driven sims (SPEC §20: no animation loop). */
export const TRANSITION = {
  indicator: 'transform 200ms ease-out',
  mass: 'transform 200ms ease-out',
} as const;
