import type { SimulationMeta } from '@/sim-contract';

export const meta: SimulationMeta = {
  id: 'dynamometer-g',
  title: 'Bestemmelse af g med dynamometer',
  defaultParams: {
    mass: 0.05,
    dynamometer: 'dynamometer-10N',
  },
  paramSchema: {
    mass: { type: 'range', min: 0, max: 0.1, step: 0.001, unit: 'kg' },
    dynamometer: {
      type: 'enum',
      values: [
        'dynamometer-1N',
        'dynamometer-5N',
        'dynamometer-10N',
        'dynamometer-50N',
      ],
    },
  },
  milestones: [],
};
