// Visual playground for HintBucket + Tjek disabled-button styles. devOnly —
// production students never see it. Single phase, gate `always` (no
// progression logic; the playground is a look-at-the-pixels harness).
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import Theory from './theory.mdx';

export const frontmatter: ExperimentFrontmatter = {
  version: 1,
  title: 'Disabled-style-test — kandidat-galleri',
  simulationId: '__none',
  learningObjectives: ['Sammenligne kandidat-stilarter for HintBucket + Tjek disabled-tilstand'],
  keyConcepts: ['hint-bucket', 'tjek', 'visual-regression'],
  difficulty: 'c-level',
  modes: {
    guided: {
      phases: [
        {
          id: 'planlaeg',
          title: 'Galleri',
          intro: 'Side-by-side visning af alle kandidat-skemaer.',
          gate: { type: 'always' },
        },
      ],
    },
  },
  labModes: { virtual: { enabled: true } },
  allowPaste: true,
  devOnly: true,
  tags: ['test', 'visual-regression'],
};

export { Theory };
export const phaseBodies: Record<string, ComponentType> = {
  planlaeg: PhasePlanlaeg,
};
