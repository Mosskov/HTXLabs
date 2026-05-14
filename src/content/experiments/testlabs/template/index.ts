// Template lab: 7 canonical phases. Demonstrates 4 authorable gate
// kinds (all-filled, all-checked, all-correct, keyword-count) and all 3
// sim-driven kinds (data-points, predicate, milestone) by pairing with
// `template-sim`. The canonical example /new-lab points teachers at.
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import PhaseAnalyser from './phase-analyser.mdx';
import PhaseDiskuter from './phase-diskuter.mdx';
import PhaseKonkluder from './phase-konkluder.mdx';
import PhaseMaal from './phase-maal.mdx';
import PhaseOpstil from './phase-opstil.mdx';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import PhaseRapporter from './phase-rapporter.mdx';
import Theory from './theory.mdx';

export const frontmatter: ExperimentFrontmatter = {
  version: 5,
  title: 'Template',
  simulationId: 'template-sim',
  learningObjectives: ['Forstå hvordan en generisk lab er opbygget i frameworket'],
  keyConcepts: ['lab-struktur', 'gates', 'widgets'],
  difficulty: 'c-level',
  estimatedMinutes: 30,
  modes: {
    guided: {
      phases: [
        {
          id: 'planlaeg',
          title: 'Planlæg',
          steps: [
            'Læs teorien og overvej hvilken sammenhæng du forventer mellem X og Y.',
            'Formulér en kort hypotese om hvordan Y afhænger af X.',
          ],
          gate: { type: 'all-filled', widgetIds: ['hypotese'] },
        },
        {
          id: 'opstil',
          title: 'Opstil',
          steps: ['Gør måleopstillingen klar.', 'Kryds materialerne af, når du har dem klar.'],
          gate: { type: 'all-checked', widgetIds: ['materialer'] },
        },
        {
          id: 'maal',
          title: 'Mål',
          steps: ['Registrér mindst 5 målepunkter i simulationen.'],
          gate: { type: 'data-points', min: 5, widgetId: 'malinger' },
        },
        {
          id: 'analyser',
          title: 'Analysér',
          steps: [
            'Plot dine målepunkter og se på sammenhængen.',
            'Besvar analysespørgsmålene korrekt.',
          ],
          gate: { type: 'all-correct', widgetIds: ['analyse-quiz'] },
        },
        {
          id: 'diskuter',
          title: 'Diskutér',
          steps: ['Diskutér resultatet — hvad ser du, og hvor sikker er målingen?'],
          gate: { type: 'keyword-count', widgetId: 'diskussion', min: 'all' },
        },
        {
          id: 'konkluder',
          title: 'Konkludér',
          steps: ['Saml din konklusion — du skal have varieret X bredt før du kan gå videre.'],
          gate: {
            type: 'predicate',
            name: 'wide-range',
            message:
              'Variér X bredere i simulationen før du konkluderer (mindst ét lavt og ét højt punkt).',
          },
        },
        {
          id: 'rapporter',
          title: 'Rapportér',
          steps: ['Gennemse dit arbejde.', 'Markér rapporten som gennemset i simulationen.'],
          gate: { type: 'milestone', requires: 'review-completed' },
        },
      ],
    },
  },
  labModes: { virtual: { enabled: true } },
  allowPaste: false,
  tags: ['template'],
};

export { Theory };
export const phaseBodies: Record<string, ComponentType> = {
  planlaeg: PhasePlanlaeg,
  opstil: PhaseOpstil,
  maal: PhaseMaal,
  analyser: PhaseAnalyser,
  diskuter: PhaseDiskuter,
  konkluder: PhaseKonkluder,
  rapporter: PhaseRapporter,
};
