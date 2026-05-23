// Zod schemas for the rubric engine: Check, Veto, Criterion, Rubric. All strict; unique criterion ids.
import { z } from 'zod';

export const CheckSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('semantic'),
      anchors: z.array(z.string()).min(1),
      threshold: z.number().min(0).max(1),
      minWords: z.number().int().optional(),
      hint: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('regex'),
      pattern: z.string(),
      flags: z.string().optional(),
      hint: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('literal'),
      terms: z.array(z.string()).min(1),
      hint: z.string().optional(),
    })
    .strict(),
]);
export type Check = z.infer<typeof CheckSchema>;

export const VetoSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('regex'),
      pattern: z.string(),
      flags: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('literal'),
      terms: z.array(z.string()).min(1),
    })
    .strict(),
]);
export type Veto = z.infer<typeof VetoSchema>;

export const MisconceptionSchema = z
  .object({
    kind: z.literal('regex'),
    pattern: z.string(),
    flags: z.string().optional(),
    hint: z.string(),
  })
  .strict();
export type Misconception = z.infer<typeof MisconceptionSchema>;

export const CriterionSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    required: z.boolean().default(true),
    /** Legacy single-shot hint. Normalized to `hints: [hint]` in the engine.
     *  Mutually exclusive with `hints` — both-present rejected by superRefine. */
    hint: z.string().optional(),
    /** Tiered progressive hints; engine surfaces these on CriterionResult.hints. */
    hints: z.array(z.string()).optional(),
    /** 4th-tier "show the answer" reveal text. Costs 2 tokens to unlock in the
     *  request-driven hint system; semantically distinct from a ladder tier.
     *  Requires `hint` or `hints` to be set — the reveal only makes sense once
     *  the ladder exists. */
    reveal: z.string().optional(),
    any: z.array(CheckSchema).min(1),
    none: z.array(VetoSchema).optional(),
    misconceptions: z.array(MisconceptionSchema).optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.hint !== undefined && c.hints !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `criterion '${c.id}': use 'hint' or 'hints', not both`,
        path: ['hints'],
      });
    }
    if (c.reveal !== undefined && c.hint === undefined && c.hints === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `criterion '${c.id}': 'reveal' requires 'hint' or 'hints' to be set`,
        path: ['reveal'],
      });
    }
  });
export type Criterion = z.infer<typeof CriterionSchema>;

export const RubricSchema = z
  .object({
    id: z.string(),
    version: z.number().int().min(1),
    title: z.string(),
    criteria: z.array(CriterionSchema).min(1),
  })
  .strict()
  .superRefine((r, ctx) => {
    const seen = new Set<string>();
    for (const c of r.criteria) {
      if (seen.has(c.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate criterion id "${c.id}"`,
          path: ['criteria'],
        });
      }
      seen.add(c.id);
    }
  });
export type Rubric = z.infer<typeof RubricSchema>;
