// Zod schemas for ExperimentFrontmatter, Phase, Gate, TopicFrontmatter; canonical phase ids; Mode/LabMode.
import { z } from 'zod';

export const Mode = z.enum(['guided', 'semi-guided', 'open']);
export type Mode = z.infer<typeof Mode>;

export const LabMode = z.enum(['virtual', 'real']);
export type LabMode = z.infer<typeof LabMode>;

export const Gate = z.discriminatedUnion('type', [
  z.object({ type: z.literal('always') }),
  z.object({ type: z.literal('milestone'), requires: z.string() }),
  z.object({
    type: z.literal('data-points'),
    min: z.number().int(),
    /** Optional widget id whose registered count satisfies the gate. When set,
     * the handler reads the widget's `count` facet instead of the per-phase
     * sim counter — lets a `<DataTable>` author flip between sim and manual
     * modes without touching this gate spec. */
    widgetId: z.string().optional(),
  }),
  z.object({ type: z.literal('all-correct'), widgetIds: z.array(z.string()) }),
  z.object({ type: z.literal('all-checked'), widgetIds: z.array(z.string()) }),
  z.object({ type: z.literal('all-filled'), widgetIds: z.array(z.string()) }),
  z.object({
    type: z.literal('keyword-count'),
    widgetId: z.string(),
    /** Threshold of matched keyword-groups required. `'all'` means the widget
     * must report `foundCount === total` — i.e. every group hit at least once.
     * A numeric value enables partial credit (e.g. 3 of 5 groups). */
    min: z.union([z.number().int(), z.literal('all')]),
  }),
  z.object({
    type: z.literal('predicate'),
    name: z.string(),
    /** Author override for the locked-phase message (SPEC §27). Falls back to
     * the generic Danish prompt when omitted. */
    message: z.string().optional(),
  }),
]);
export type Gate = z.infer<typeof Gate>;

/** The 7 canonical phase ids per SPEC §2. The schema accepts any string so the
 * framework testbed (`tags: ['test']`) can use ad-hoc ids; non-test labs that
 * stray from this list get a console warning at module-load via
 * `validateAuthorableGates`. */
export const CANONICAL_PHASE_IDS = [
  'planlaeg',
  'opstil',
  'maal',
  'analyser',
  'diskuter',
  'konkluder',
  'rapporter',
] as const;
export type CanonicalPhaseId = (typeof CANONICAL_PHASE_IDS)[number];

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
  simulationId: z.string(),

  simulationOverrides: z
    .object({
      defaultParams: z.record(z.union([z.number(), z.string()])).optional(),
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
