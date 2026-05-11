// reference-sim metadata. Symbolic X/Y; no real units. The canonical example
// /new-simulation points authors at when they want to see all three sim-driven
// event kinds wired together.
import type { SimulationMeta } from '@/sim-contract';

export const meta: SimulationMeta = {
  id: 'reference-sim',
  title: 'Reference simulation',
  locale: { da: { title: 'Reference-simulation (X, Y)' } },
  mode: 'interactive',
  defaultParams: {
    slope: 1.5,
    intercept: 0.5,
  },
  paramSchema: {
    slope: { type: 'range', min: 0.5, max: 3, step: 0.1, unit: '' },
    intercept: { type: 'range', min: -2, max: 2, step: 0.1, unit: '' },
  },
  milestones: ['first-measurement', 'review-completed'],
};
