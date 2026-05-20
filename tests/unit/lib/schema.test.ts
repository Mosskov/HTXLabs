// @vitest-environment node
import { ExperimentFrontmatter, Gate, Phase } from '@/lib/schema';
import { describe, expect, it } from 'vitest';

describe('Phase schema', () => {
  it('accepts a phase with `steps` only', () => {
    const result = Phase.safeParse({ id: 'x', title: 'X', steps: ['a', 'b'] });
    expect(result.success).toBe(true);
  });

  it('accepts a phase with `intro` only', () => {
    const result = Phase.safeParse({ id: 'x', title: 'X', intro: 'just one sentence' });
    expect(result.success).toBe(true);
  });

  it('accepts a phase with neither (box is optional)', () => {
    const result = Phase.safeParse({ id: 'x', title: 'X' });
    expect(result.success).toBe(true);
  });

  it('rejects a phase with both `intro` and `steps`', () => {
    const result = Phase.safeParse({ id: 'x', title: 'X', intro: 'a', steps: ['b'] });
    expect(result.success).toBe(false);
  });

  it('accepts object-form steps with a widget target', () => {
    const result = Phase.safeParse({
      id: 'x',
      title: 'X',
      steps: [{ text: 'a', widgetId: 'w', section: 'iv' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a mixed string + object steps array', () => {
    const result = Phase.safeParse({
      id: 'x',
      title: 'X',
      steps: ['plain', { text: 'tracked', widgetId: 'w' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an object step with an out-of-enum section', () => {
    const result = Phase.safeParse({ id: 'x', title: 'X', steps: [{ text: 'a', section: 'bogus' }] });
    expect(result.success).toBe(false);
  });

  it('rejects an object step with empty text', () => {
    const result = Phase.safeParse({ id: 'x', title: 'X', steps: [{ text: '' }] });
    expect(result.success).toBe(false);
  });
});

describe('Gate schema — rubric-required', () => {
  it('accepts rubric-required with a non-empty widgetIds list', () => {
    const result = Gate.safeParse({ type: 'rubric-required', widgetIds: ['hypotese'] });
    expect(result.success).toBe(true);
  });

  it('accepts rubric-required with multiple widgetIds', () => {
    const result = Gate.safeParse({
      type: 'rubric-required',
      widgetIds: ['kraft', 'symbol', 'unit'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects rubric-required with no widgetIds key', () => {
    const result = Gate.safeParse({ type: 'rubric-required' });
    expect(result.success).toBe(false);
  });

  it('rejects rubric-required with an empty widgetIds array', () => {
    // Empty list would make `every` vacuously true → silent auto-open.
    const result = Gate.safeParse({ type: 'rubric-required', widgetIds: [] });
    expect(result.success).toBe(false);
  });
});

describe('Gate schema — all-satisfied', () => {
  it('accepts all-satisfied with two widgetIds', () => {
    const result = Gate.safeParse({ type: 'all-satisfied', widgetIds: ['a', 'b'] });
    expect(result.success).toBe(true);
  });

  it('accepts all-satisfied with more than two widgetIds', () => {
    const result = Gate.safeParse({ type: 'all-satisfied', widgetIds: ['a', 'b', 'c'] });
    expect(result.success).toBe(true);
  });

  it('rejects all-satisfied with a single widgetId', () => {
    // Singleton is already covered by the kind-specific gates — guard against
    // an authoring mistake that would silently degrade the gate's semantics.
    const result = Gate.safeParse({ type: 'all-satisfied', widgetIds: ['only'] });
    expect(result.success).toBe(false);
  });

  it('rejects all-satisfied with an empty widgetIds array', () => {
    const result = Gate.safeParse({ type: 'all-satisfied', widgetIds: [] });
    expect(result.success).toBe(false);
  });

  it('rejects all-satisfied with no widgetIds key', () => {
    const result = Gate.safeParse({ type: 'all-satisfied' });
    expect(result.success).toBe(false);
  });
});

describe('Gate schema — all-validated', () => {
  it('accepts all-validated with a single widgetId (singleton allowed)', () => {
    const result = Gate.safeParse({ type: 'all-validated', widgetIds: ['a'] });
    expect(result.success).toBe(true);
  });

  it('accepts all-validated with multiple widgetIds', () => {
    const result = Gate.safeParse({ type: 'all-validated', widgetIds: ['a', 'b', 'c'] });
    expect(result.success).toBe(true);
  });

  it('rejects all-validated with an empty widgetIds array', () => {
    // Empty array → every() returns true vacuously → silent auto-open.
    const result = Gate.safeParse({ type: 'all-validated', widgetIds: [] });
    expect(result.success).toBe(false);
  });

  it('rejects all-validated with no widgetIds key', () => {
    const result = Gate.safeParse({ type: 'all-validated' });
    expect(result.success).toBe(false);
  });
});

describe('ExperimentFrontmatter — devOnly', () => {
  const base = {
    title: 'Test',
    simulationId: '__none',
    learningObjectives: ['x'],
    modes: { guided: { phases: [{ id: 'planlaeg', title: 'Planlæg' }] } },
  };

  it('parses with devOnly: true', () => {
    const result = ExperimentFrontmatter.safeParse({ ...base, devOnly: true });
    expect(result.success).toBe(true);
    expect(result.success && result.data.devOnly).toBe(true);
  });

  it('parses with devOnly omitted (the common case)', () => {
    const result = ExperimentFrontmatter.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.success && result.data.devOnly).toBeUndefined();
  });
});
