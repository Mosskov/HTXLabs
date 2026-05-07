import { z } from 'zod';

export const Gate = z.discriminatedUnion('type', [
  z.object({ type: z.literal('always') }),
  z.object({ type: z.literal('milestone'), requires: z.string() }),
  z.object({
    type: z.literal('data-points'),
    min: z.number().int(),
    validOnly: z.boolean().default(true),
  }),
  z.object({ type: z.literal('all-correct'), widgetIds: z.array(z.string()) }),
  z.object({ type: z.literal('all-checked'), widgetIds: z.array(z.string()) }),
  z.object({ type: z.literal('all-filled'), widgetIds: z.array(z.string()) }),
  z.object({
    type: z.literal('keyword-count'),
    widgetId: z.string(),
    min: z.number().int(),
  }),
  z.object({ type: z.literal('predicate'), name: z.string() }),
]);
export type Gate = z.infer<typeof Gate>;

export const Phase = z.object({
  id: z.string(),
  title: z.string(),
  intro: z.string().optional(),
  gate: Gate.default({ type: 'always' }),
});
export type Phase = z.infer<typeof Phase>;

export const ExperimentFrontmatter = z.object({
  version: z.number().int().default(1),
  title: z.string(),
  topic: z.string(),
  simulationId: z.string(),

  simulationOverrides: z
    .object({
      defaultParams: z.record(z.union([z.number(), z.string()])).optional(),
      paramSchema: z.record(z.unknown()).optional(),
    })
    .optional(),

  learningObjectives: z.array(z.string()).min(1),
  keyConcepts: z.array(z.string()).default([]),
  difficulty: z.enum(['intro', 'core', 'advanced']).default('core'),

  modes: z.object({
    guided: z.object({ phases: z.array(Phase).min(1) }),
    'semi-guided': z.object({ phases: z.array(Phase).min(1) }).optional(),
    open: z.object({ phases: z.array(Phase).min(1) }).optional(),
  }),

  labModes: z
    .object({
      virtual: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
      real: z
        .object({
          enabled: z.boolean().default(false),
          equipment: z.array(z.string()).optional(),
          procedure: z.string().optional(),
        })
        .optional(),
    })
    .default({ virtual: { enabled: true } }),

  // SEN escape hatch — disable global copy/paste protection on this lab.
  allowPaste: z.boolean().default(false),

  tags: z.array(z.string()).default([]),
});
export type ExperimentFrontmatter = z.infer<typeof ExperimentFrontmatter>;

export const TopicFrontmatter = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  order: z.number().int().default(100),
});
export type TopicFrontmatter = z.infer<typeof TopicFrontmatter>;
