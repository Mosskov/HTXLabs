// Diagnostic testlab for the rubric engine. Loads pendulum-hypothesis.json,
// validates it via parseRubric at module-load (bad rubric → dev build fails),
// renders <RubricTester> in its single phase.
import { parseRubric } from '@/lib/rubric/engine';
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import rubricJson from './rubrics/template-hypothesis.json';
import Theory from './theory.mdx';

const parsed = parseRubric(rubricJson);
if (!parsed.ok) {
  throw new Error(
    `[rubric-test] pendulum-hypothesis.json failed validation:\n${JSON.stringify(parsed.errors, null, 2)}`,
  );
}

export const frontmatter: ExperimentFrontmatter = {
  version: 1,
  title: 'Rubric-motor — diagnostisk testlab',
  simulationId: '__none',
  learningObjectives: ['Verificere rubric-motorens scoring mod kendte hypoteseformuleringer'],
  keyConcepts: ['rubric', 'semantisk match', 'misforståelser'],
  difficulty: 'c-level',
  modes: {
    guided: {
      phases: [
        {
          id: 'planlaeg',
          title: 'Hypotese',
          intro: 'Skriv en hypotese og tryk Evaluér for at se per-kriterium scoring.',
          gate: { type: 'always' },
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
};
