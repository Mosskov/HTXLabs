import { meta } from '@/simulations/dynamometer-g/meta';
import { DYNAMOMETERS, G_DK, forceFor, pegReading } from '@/simulations/dynamometer-g/physics';
// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('dynamometer-g physics', () => {
  it('meta has a matching id', () => {
    expect(meta.id).toBe('dynamometer-g');
  });

  describe('forceFor', () => {
    it('returns 0 for zero mass', () => {
      expect(forceFor(0)).toBe(0);
    });

    it('uses g = 9,82 m/s² in Denmark by default', () => {
      expect(forceFor(0.027)).toBeCloseTo(0.027 * G_DK, 6);
      expect(forceFor(0.1)).toBeCloseTo(0.982, 6);
    });

    it('respects an explicit g override', () => {
      expect(forceFor(0.1, 9.81)).toBeCloseTo(0.981, 6);
    });
  });

  describe('pegReading', () => {
    it('passes through a force inside the scale', () => {
      expect(pegReading(0.5, 1)).toEqual({ reading: 0.5, overScale: false });
    });

    it('pegs at the scale max when force exceeds it', () => {
      expect(pegReading(1.5, 1)).toEqual({ reading: 1, overScale: true });
    });

    it('clamps negative forces to zero', () => {
      expect(pegReading(-0.1, 1)).toEqual({ reading: 0, overScale: false });
    });

    it('treats force exactly at scaleMax as in-scale', () => {
      expect(pegReading(1, 1)).toEqual({ reading: 1, overScale: false });
    });
  });

  describe('DYNAMOMETERS map', () => {
    const allowedIds = (meta.paramSchema.dynamometer as { values: string[] }).values;

    it('has an entry for every id in meta.paramSchema', () => {
      for (const id of allowedIds) {
        expect(DYNAMOMETERS[id], `missing entry for ${id}`).toBeDefined();
      }
    });

    it.each(allowedIds)('%s spec is internally consistent', (id) => {
      const spec = DYNAMOMETERS[id];
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
