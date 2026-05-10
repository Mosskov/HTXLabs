import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import PhaseAnalyser from './phase-analyser.mdx';
import PhaseDiskuter from './phase-diskuter.mdx';
import PhaseKonkluder from './phase-konkluder.mdx';
import PhaseMaal from './phase-maal.mdx';
import PhaseOpstil from './phase-opstil.mdx';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import Theory from './theory.mdx';

export const frontmatter: ExperimentFrontmatter = {
  version: 7,
  title: 'Hej, Verden — framework-test',
  topic: 'test-labs',
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
          gate: {
            type: 'all-filled',
            widgetIds: ['hypotese-test', 'minord-test', 'override-test'],
          },
        },
        {
          id: 'opstil',
          title: 'Opstil',
          intro: 'Always-gate (passerer altid).',
          gate: { type: 'always' },
        },
        {
          id: 'maal',
          title: 'Mål',
          intro: 'All-checked-gate: sæt flueben ved alle punkter på tjeklisten.',
          gate: { type: 'all-checked', widgetIds: ['materialer-test'] },
        },
        {
          id: 'analyser',
          title: 'Analysér',
          intro: 'All-correct-gate: besvar begge quizzer korrekt og klik Tjek.',
          gate: { type: 'all-correct', widgetIds: ['quiz1-test', 'quiz2-test'] },
        },
        {
          id: 'diskuter',
          title: 'Diskutér',
          intro:
            'Keyword-count-gate: skriv en kort refleksion der nævner både en relations- og en kraft-relateret idé.',
          gate: { type: 'keyword-count', widgetId: 'diskussion-test', min: 'all' },
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
  opstil: PhaseOpstil,
  maal: PhaseMaal,
  analyser: PhaseAnalyser,
  diskuter: PhaseDiskuter,
  konkluder: PhaseKonkluder,
};
