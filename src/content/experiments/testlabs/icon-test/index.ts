// Visual gallery for the hand-rolled icons in src/icons/. devOnly — production
// students never see it. Single phase, gate `always` (no progression logic
// needed; this is a look-at-the-pixels harness).
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import Theory from './theory.mdx';

export const frontmatter: ExperimentFrontmatter = {
  version: 1,
  title: 'Icon-test — visuelt galleri',
  simulationId: '__none',
  learningObjectives: ['Inspicere de håndlavede ikoner ved forskellige størrelser'],
  keyConcepts: ['icons', 'visual-regression'],
  difficulty: 'c-level',
  modes: {
    guided: {
      phases: [
        {
          id: 'planlaeg',
          title: 'Galleri',
          intro: 'Visuel inspektion af alle ikoner i src/icons/ ved tre størrelser.',
          gate: { type: 'always' },
        },
      ],
    },
  },
  labModes: { virtual: { enabled: true } },
  allowPaste: true,
  devOnly: true,
  tags: ['test', 'icons'],
};

export { Theory };
export const phaseBodies: Record<string, ComponentType> = {
  planlaeg: PhasePlanlaeg,
};
