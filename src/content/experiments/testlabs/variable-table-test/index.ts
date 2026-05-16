// Focused testlab for the VariableTable widget — three instances exercise
// defaults, requireUnits, and per-instance label overrides; all-filled gate.
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { ComponentType } from 'react';
import PhasePlanlaeg from './phase-planlaeg.mdx';
import Theory from './theory.mdx';

export const frontmatter: ExperimentFrontmatter = {
  version: 1,
  title: 'VariableTable — widget-test',
  simulationId: '__none',
  learningObjectives: [
    'Bekræft at VariableTable-widgetten registrerer korrekt og at requireUnits + override-props virker',
  ],
  keyConcepts: ['variabler', 'widgettest'],
  difficulty: 'c-level',
  modes: {
    guided: {
      phases: [
        {
          id: 'planlaeg',
          title: 'Planlæg',
          steps: [
            'Udfyld alle tre VariableTable-instanser.',
            'Verificér at requireUnits og override-labels opfører sig som forventet.',
          ],
          gate: {
            type: 'all-filled',
            widgetIds: ['variables-default', 'variables-units', 'variables-overrides'],
          },
        },
      ],
    },
  },
  labModes: { virtual: { enabled: true } },
  allowPaste: false,
  // Diagnostic widget-probe — hidden from students in production.
  devOnly: true,
  tags: ['test'],
};

export { Theory };
export const phaseBodies: Record<string, ComponentType> = {
  planlaeg: PhasePlanlaeg,
};
