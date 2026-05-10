import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import PhaseAnalyser from './phase-analyser.mdx';
import PhaseKonkluder from './phase-konkluder.mdx';
import PhaseMaal from './phase-maal.mdx';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import Theory from './theory.mdx';

export const frontmatter: ExperimentFrontmatter = {
  version: 2,
  title: 'Sim-gate-test — milestone/data-points/predicate',
  simulationId: 'testbed',
  learningObjectives: ['Bekræft at sim-drevne gate-typer evalueres korrekt'],
  keyConcepts: ['frameworktest', 'gates'],
  difficulty: 'intro',
  modes: {
    guided: {
      phases: [
        {
          id: 'planlaeg',
          title: 'Planlæg',
          intro: 'Milestone-gate: klik knappen "Fyr milestone m1" i simulationen.',
          gate: { type: 'milestone', requires: 'm1' },
        },
        {
          id: 'maal',
          title: 'Mål',
          intro: 'Data-points-gate: tryk "Tilføj datapunkt" mindst 3 gange.',
          gate: { type: 'data-points', min: 3 },
        },
        {
          id: 'analyser',
          title: 'Analysér',
          intro: 'Predikat-gate (boolesk): aktivér prædikat-flaget i simulationen.',
          gate: { type: 'predicate', name: 'flag-on' },
        },
        {
          id: 'konkluder',
          title: 'Konkludér',
          intro: 'Predikat-gate (numerisk): træk slideren til værdi > 5.',
          gate: { type: 'predicate', name: 'value-above-5' },
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
  maal: PhaseMaal,
  analyser: PhaseAnalyser,
  konkluder: PhaseKonkluder,
};
