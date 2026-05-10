// Per-sim Danish chrome for the testbed sim. Sims own their own strings —
// the framework's lab-guide/strings.da.ts is reserved for lab-shell + widgets.
export const strings = {
  fireMilestone: 'Fyr milestone',
  addDataPoint: 'Tilføj datapunkt (lokalt: {n})',
  togglePredicateFlag: 'Toggle prædikat-flag (nu: {flag})',
  valueLabel: 'Værdi: {n}',
  flagTrue: 'true',
  flagFalse: 'false',
  paused: '(paused)',
} as const;
