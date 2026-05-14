// @vitest-environment node
import { meta } from '@/simulations/template-sim/meta';
import { computeY, coverWideRange } from '@/simulations/template-sim/physics';
import { describe, expect, it } from 'vitest';

describe('template-sim physics', () => {
  it('meta has a matching id', () => {
    expect(meta.id).toBe('template-sim');
  });

  describe('computeY', () => {
    it('applies Y = slope·X + intercept', () => {
      expect(computeY(0, 2, 1)).toBe(1);
      expect(computeY(5, 2, 1)).toBe(11);
      expect(computeY(-3, 1.5, 0.5)).toBeCloseTo(-4, 6);
    });
  });

  describe('coverWideRange', () => {
    it('false for empty input', () => {
      expect(coverWideRange([])).toBe(false);
    });

    it('false when only low values present', () => {
      expect(coverWideRange([{ x: 1, y: 0 }, { x: 2, y: 0 }])).toBe(false);
    });

    it('false when only high values present', () => {
      expect(coverWideRange([{ x: 8, y: 0 }, { x: 9, y: 0 }])).toBe(false);
    });

    it('false at the boundary (X exactly 3 or 7 is not enough)', () => {
      expect(coverWideRange([{ x: 3, y: 0 }, { x: 7, y: 0 }])).toBe(false);
    });

    it('true once at least one point < 3 and one > 7 exist', () => {
      expect(coverWideRange([{ x: 2.5, y: 0 }, { x: 7.5, y: 0 }])).toBe(true);
    });
  });
});
