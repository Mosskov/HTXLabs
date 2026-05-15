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
});
