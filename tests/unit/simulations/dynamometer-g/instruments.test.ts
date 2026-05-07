import { DYNAMOMETERS } from '@/simulations/dynamometer-g/instruments';
import { meta } from '@/simulations/dynamometer-g/meta';
// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('dynamometer-g instruments', () => {
  describe('DYNAMOMETERS map', () => {
    const allowedIds = (meta.paramSchema.dynamometer as { values: string[] }).values;

    it('has an entry for every id in meta.paramSchema', () => {
      for (const id of allowedIds) {
        expect(
          (DYNAMOMETERS as Record<string, unknown>)[id],
          `missing entry for ${id}`,
        ).toBeDefined();
      }
    });

    it.each(allowedIds)('%s spec is internally consistent', (id) => {
      const spec = (DYNAMOMETERS as Record<string, (typeof DYNAMOMETERS)[keyof typeof DYNAMOMETERS]>)[id];
      // scaleMax matches the numeric prefix of the id (e.g. 'dynamometer-10N' -> 10).
      const numFromId = Number(id.replace(/^dynamometer-/, '').replace(/N$/, ''));
      expect(spec.scaleMax).toBe(numFromId);

      // majorTick divides scaleMax cleanly.
      expect(Math.round(spec.scaleMax / spec.majorTick) * spec.majorTick).toBeCloseTo(
        spec.scaleMax,
        6,
      );

      // minorTick divides majorTick cleanly.
      expect(Math.round(spec.majorTick / spec.minorTick) * spec.minorTick).toBeCloseTo(
        spec.majorTick,
        6,
      );

      // Minor ticks should be finer than major.
      expect(spec.minorTick).toBeLessThan(spec.majorTick);
    });
  });
});
