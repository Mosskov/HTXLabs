// @vitest-environment node
import { Phase } from '@/lib/schema';
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
