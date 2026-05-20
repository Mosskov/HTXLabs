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
  z.object({
    type: z.literal('rubric-required'),
    /** Widget ids that must each register `{ kind: 'rubric', satisfied: true }`.
     * `.min(1)` because an empty list would vacuously satisfy `every` and
     * silently auto-open the gate. */
    widgetIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('all-satisfied'),
    /** Widget ids whose kind-aware satisfaction bit must all be true. Reads
     *  `correct` from kind='correct', `allChecked` from 'checked', `filled`
     *  from 'filled', `satisfied` from 'rubric', and `foundCount === total`
     *  from 'keywords'. `.min(2)` because the single-widget case is already
     *  covered by the kind-specific gates (`all-filled`, `rubric-required`,
     *  …); a singleton would just be a less-specific version. */
    widgetIds: z.array(z.string()).min(2),
    /** Opt-in correctness requirement for `kind: 'filled'` widgets in the
     *  list. When true, `widgetSatisfied` requires `filled && correct === true`
     *  for those widgets (other kinds are unaffected). A widget that publishes
     *  `kind: 'filled'` without `correct` (no `expected` configured) fails
     *  strict — strict refuses to silently accept presence as correctness. */
    strict: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('all-validated'),
    /** Widget ids that must each register `kind: 'filled'` with
     *  `correct: true`. Widget-agnostic correctness gate — currently used by
     *  `<VariableTable expected>`. `.min(1)` because a singleton case is
     *  legitimate (one VariableTable with an answer key), unlike
     *  `all-satisfied`. */
    widgetIds: z.array(z.string()).min(1),
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

/** Object form of an instruction-box step. A step may instead be a plain
 *  string (untracked line — the shorthand). The object form lets a step
 *  declare a target widget whose satisfaction marks the line done; the
 *  instruction-box then renders it as a small progress tracker. */
export const PhaseStep = z.object({
  text: z.string().min(1),
  /** Widget id whose satisfaction marks this line done. Omit = untracked. */
  widgetId: z.string().optional(),
  /** For a VariableTable target: which section satisfies this line. Omit to
   *  use whole-widget satisfaction. */
  section: z.enum(['iv', 'dv', 'constants']).optional(),
});
export type PhaseStep = z.infer<typeof PhaseStep>;

export const Phase = z
  .object({
    id: z.string(),
    title: z.string(),
    intro: z.string().optional(),
    steps: z.array(z.union([z.string().min(1), PhaseStep])).optional(),
    gate: Gate.default({ type: 'always' }),
  })
  .refine((p) => !(p.intro && p.steps), {
    message:
      'A phase has either `intro` (single sentence, no header) or `steps` (lettered checklist with auto-header), not both.',
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
  /** HTX gymnasieniveau: A = højeste, C = laveste. Default to C so labs
   * authored without an explicit value land on the broadest audience. */
  difficulty: z.enum(['c-level', 'b-level', 'a-level']).default('c-level'),
  /** Optional rough estimate of how long the lab takes end-to-end (minutes).
   * Surfaced as a small chip on the lab landing page; chip hides when absent. */
  estimatedMinutes: z.number().int().positive().optional(),

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

  // Hide from the production build's content index when true. Used for labs
  // that depend on the local embed server (Rubric engine Phase 1). The
  // `import.meta.env.PROD` check happens in src/lib/content.ts via
  // `isVisibleInEnv`; .optional() (not .default(false)) so existing fixtures
  // and frontmatter shapes don't change.
  devOnly: z.boolean().optional(),

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
