// Per-sim Danish chrome for template-sim. Sims own their own strings —
// the framework's lab-guide/strings.da.ts is reserved for lab-shell + widgets.
export const strings = {
  /** Slider label. Vars: {n} = current X formatted. */
  xLabel: 'X = {n}',
  /** Readout for the computed Y. Vars: {n} = current Y formatted. */
  yReadout: 'Y = {n}',
  /** Button: record current (X, Y) as a measurement. */
  addMeasurement: '+ Tilføj måling',
  /** Button: fire the review-completed milestone. */
  markReviewed: 'Markér rapport gennemset',
  /** Shown after the review milestone has fired. */
  reviewedConfirmation: '✓ Rapport markeret som gennemset',
  /** Running count of recorded measurements. Vars: {n}. */
  measurementCount: 'Målinger: {n}',
  /** Caption above the slider explaining the relation. */
  paramsCaption: 'Sammenhæng: Y = a·X + b',
  paused: '(pause)',
} as const;
