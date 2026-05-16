// Diagnostic testlab for the production <RubricResponse> widget. Each phase
// isolates one facet of the widget's UI/state machine: status pill, hint
// tiers, override props, multi-widget gate, dependsOn churn, raw scoring.
// Both rubric JSONs are validated at module-load.
import { parseRubric } from '@/lib/rubric/engine';
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import templateHypothesis from '../template/rubrics/template-hypothesis.json';
import PhaseAnalyser from './phase-analyser.mdx';
import PhaseKonkluder from './phase-konkluder.mdx';
import PhaseMaal from './phase-maal.mdx';
import PhaseOpstil from './phase-opstil.mdx';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import widgetTestMini from './rubrics/widget-test-mini.json';
import Theory from './theory.mdx';

for (const [name, json] of [
  ['template-hypothesis', templateHypothesis],
  ['widget-test-mini', widgetTestMini],
] as const) {
  const parsed = parseRubric(json);
  if (!parsed.ok) {
    throw new Error(
      `[rubric-widget-test] ${name}.json failed validation:\n${JSON.stringify(parsed.errors, null, 2)}`,
    );
  }
}

export const frontmatter: ExperimentFrontmatter = {
  version: 1,
  title: 'Rubric-widget — diagnostisk testlab',
  simulationId: '__none',
  learningObjectives: ['Verificere RubricResponse-widgetens tilstand, props og gate-kobling'],
  keyConcepts: ['rubric', 'widget-state', 'hint-tier', 'rubric-required', 'all-satisfied'],
  difficulty: 'c-level',
  modes: {
    guided: {
      phases: [
        {
          id: 'planlaeg',
          title: 'Baseline',
          steps: [
            'Skriv en hypotese og tryk Tjek for at se status-pille og hint-tiers rulle frem.',
          ],
          gate: { type: 'rubric-required', widgetIds: ['hypotese'] },
        },
        {
          id: 'opstil',
          title: 'Overrides',
          steps: ['Bekræft at brugerdefinerede labels og tegnbegrænsning vises korrekt.'],
          gate: { type: 'rubric-required', widgetIds: ['overrides'] },
        },
        {
          id: 'maal',
          title: 'Multi-rubric',
          steps: ['Tjek begge svarfelter. Fasen åbner først når begge har grøn pille.'],
          gate: { type: 'all-satisfied', widgetIds: ['rubA', 'rubB'] },
        },
        {
          id: 'analyser',
          title: 'dependsOn',
          steps: [
            'Skriv en hypotese og tryk Tjek.',
            'Tryk på Skift-knappen — gate skal lukke selvom teksten er uændret.',
          ],
          gate: { type: 'rubric-required', widgetIds: ['dep'] },
        },
        {
          id: 'konkluder',
          title: 'Engine-probe',
          steps: ['Diagnostisk værktøj — skriv en formulering og se rå per-kriterium scoring.'],
          gate: { type: 'always' },
        },
      ],
    },
  },
  labModes: { virtual: { enabled: true } },
  allowPaste: true,
  devOnly: true,
  tags: ['test', 'rubric-widget'],
};

export { Theory };
export const phaseBodies: Record<string, ComponentType> = {
  planlaeg: PhasePlanlaeg,
  opstil: PhaseOpstil,
  maal: PhaseMaal,
  analyser: PhaseAnalyser,
  konkluder: PhaseKonkluder,
};
