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
