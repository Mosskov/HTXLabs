// @vitest-environment node
import { CriterionSchema, RubricSchema } from '@/lib/rubric/schema';
import { describe, expect, it } from 'vitest';

const validRubric = {
  id: 'test',
  version: 1,
  title: 'Test rubric',
  criteria: [
    {
      id: 'c1',
      label: 'First',
      any: [{ kind: 'literal', terms: ['x'] }],
    },
    {
      id: 'c2',
      label: 'Second',
      any: [
        { kind: 'semantic', anchors: ['a paraphrase'], threshold: 0.6 },
        { kind: 'regex', pattern: '\\bword\\b' },
      ],
    },
  ],
};

describe('RubricSchema', () => {
  it('accepts a valid rubric', () => {
    const result = RubricSchema.safeParse(validRubric);
    expect(result.success).toBe(true);
  });

  it('rejects missing version', () => {
    const { version: _omit, ...bad } = validRubric;
    const result = RubricSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level keys (.strict)', () => {
    const result = RubricSchema.safeParse({ ...validRubric, extra: 'oops' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys nested in a criterion (.strict)', () => {
    const result = RubricSchema.safeParse({
      ...validRubric,
      criteria: [{ ...validRubric.criteria[0], typo: 'oops' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate criterion ids', () => {
    const result = RubricSchema.safeParse({
      ...validRubric,
      criteria: [validRubric.criteria[0], { ...validRubric.criteria[1], id: 'c1' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('duplicate'))).toBe(true);
    }
  });

  it('rejects threshold outside [0, 1]', () => {
    const result = RubricSchema.safeParse({
      ...validRubric,
      criteria: [
        {
          id: 'c1',
          label: 'x',
          any: [{ kind: 'semantic', anchors: ['a'], threshold: 1.5 }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty anchors array on a semantic check', () => {
    const result = RubricSchema.safeParse({
      ...validRubric,
      criteria: [
        {
          id: 'c1',
          label: 'x',
          any: [{ kind: 'semantic', anchors: [], threshold: 0.5 }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a criterion with no checks in `any`', () => {
    const result = RubricSchema.safeParse({
      ...validRubric,
      criteria: [{ id: 'c1', label: 'x', any: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed check kind', () => {
    const result = RubricSchema.safeParse({
      ...validRubric,
      criteria: [
        {
          id: 'c1',
          label: 'x',
          any: [{ kind: 'bogus', terms: ['a'] }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a criterion with vetoes and misconceptions', () => {
    const result = RubricSchema.safeParse({
      ...validRubric,
      criteria: [
        {
          id: 'c1',
          label: 'x',
          any: [{ kind: 'literal', terms: ['x'] }],
          none: [{ kind: 'regex', pattern: 'bad' }],
          misconceptions: [{ kind: 'regex', pattern: 'oops', hint: 'try again' }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('defaults required to true when omitted', () => {
    const result = CriterionSchema.safeParse({
      id: 'c1',
      label: 'x',
      any: [{ kind: 'literal', terms: ['x'] }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.required).toBe(true);
  });

  describe('tiered hints', () => {
    it('accepts a criterion with hints[]', () => {
      const result = CriterionSchema.safeParse({
        id: 'c1',
        label: 'x',
        hints: ['tier 1', 'tier 2', 'tier 3'],
        any: [{ kind: 'literal', terms: ['x'] }],
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.hints).toEqual(['tier 1', 'tier 2', 'tier 3']);
    });

    it('still accepts legacy hint (single string)', () => {
      const result = CriterionSchema.safeParse({
        id: 'c1',
        label: 'x',
        hint: 'one shot',
        any: [{ kind: 'literal', terms: ['x'] }],
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.hint).toBe('one shot');
    });

    it('rejects when both hint and hints are present', () => {
      const result = CriterionSchema.safeParse({
        id: 'c1',
        label: 'x',
        hint: 'one',
        hints: ['t1', 't2'],
        any: [{ kind: 'literal', terms: ['x'] }],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) => i.message.includes("'c1'") && i.message.includes('not both'),
          ),
        ).toBe(true);
      }
    });

    it('accepts empty hints[]', () => {
      const result = CriterionSchema.safeParse({
        id: 'c1',
        label: 'x',
        hints: [],
        any: [{ kind: 'literal', terms: ['x'] }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('retired `reveal` field (F9)', () => {
    it('rejects a criterion that still carries `reveal`', () => {
      const result = CriterionSchema.safeParse({
        id: 'c1',
        label: 'x',
        hints: ['t1'],
        reveal: 'answer',
        any: [{ kind: 'literal', terms: ['x'] }],
      });
      expect(result.success).toBe(false);
    });
  });
});
