// Diagnostic testlab for the production <RubricResponse> widget. Reorganised
// around capability areas: each phase maps to one capability slot (basic
// surface, prop overrides, multi-widget, dependsOn, engine probe). Both
// rubric JSONs are validated at module-load.
import { parseRubric } from '@/lib/rubric/engine';
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import templateHypothesis from '../template/rubrics/template-hypothesis.json';
import PhaseAnalyser from './phase-analyser.mdx';
import PhaseKonkluder from './phase-konkluder.mdx';
import PhaseMaal from './phase-maal.mdx';
import PhaseOpstil from './phase-opstil.mdx';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import widgetTestHypothesis from './rubrics/widget-test-hypothesis.json';
import widgetTestMini from './rubrics/widget-test-mini.json';
import Theory from './theory.mdx';

for (const [name, json] of [
  ['template-hypothesis', templateHypothesis],
  ['widget-test-mini', widgetTestMini],
  ['widget-test-hypothesis', widgetTestHypothesis],
] as const) {
  const parsed = parseRubric(json);
  if (!parsed.ok) {
    throw new Error(
      `[rubric-widget-test] ${name}.json failed validation:\n${JSON.stringify(parsed.errors, null, 2)}`,
    );
  }
}

export const frontmatter: ExperimentFrontmatter = {
  version: 3,
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
          title: 'Kapacitet 1: Grundflade',
          steps: [
            'Standardprops, ét rubric, fuld hint-ladder. Skriv en hypotese og tryk Tjek for at se panel-flowet og gaten åbne ved pass.',
          ],
          gate: { type: 'always' },
        },
        {
          id: 'opstil',
          title: 'Kapacitet 2: Prop-overrides',
          steps: [
            'Brugerdefinerede labels + tegnbegrænsning. Bekræft at hver override-prop vises korrekt.',
          ],
          gate: { type: 'always' },
        },
        {
          id: 'maal',
          title: 'Kapacitet 3: Flere rubrics',
          steps: [
            'To <RubricResponse>-widgets i samme fase. Tjek begge — gate-koblingen bevares i prosa, men gate er åben her så testlab kan cykle frit.',
          ],
          gate: { type: 'always' },
        },
        {
          id: 'analyser',
          title: 'Kapacitet 4: dependsOn',
          steps: [
            'Skriv en hypotese og tryk Tjek.',
            'Tryk på Skift-knappen — verificér dirty-derivationen uden at gate blokerer fremdrift.',
          ],
          gate: { type: 'always' },
        },
        {
          id: 'konkluder',
          title: 'Kapacitet 5: Motor-probe',
          steps: [
            'Rå per-kriterium scoring via RubricTester. Skriv en formulering og se anker-scores + status-tabel.',
          ],
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
