import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import PhaseKonkluder from './phase-konkluder.mdx';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import Theory from './theory.mdx';

export const frontmatter: ExperimentFrontmatter = {
  version: 1,
  title: 'Hej, Verden — framework-test',
  topic: 'mekanik',
  simulationId: '__none',
  learningObjectives: ['Bekræft at lab-pipeline fungerer'],
  keyConcepts: ['frameworktest'],
  difficulty: 'intro',
  modes: {
    guided: {
      phases: [
        {
          id: 'planlaeg',
          title: 'Planlæg',
          intro: "Skriv et svar i widget'en herunder.",
          gate: { type: 'all-filled', widgetIds: ['hypotese-test'] },
        },
        {
          id: 'konkluder',
          title: 'Konkludér',
          intro: 'Skriv en kort konklusion.',
          gate: { type: 'all-filled', widgetIds: ['konklusion-test'] },
        },
      ],
    },
  },
  labModes: { virtual: { enabled: true } },
  allowPaste: false,
  tags: ['test'],
};

export { Theory };
export const phaseBodies: Record<string, ComponentType> = {
  planlaeg: PhasePlanlaeg,
  konkluder: PhaseKonkluder,
};
