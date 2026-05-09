// @vitest-environment node
import { parseModeParam } from '@/lib/url';
import { describe, expect, it } from 'vitest';

describe('parseModeParam', () => {
  it('round-trips guided', () => {
    expect(parseModeParam('guided')).toBe('guided');
  });

  it('round-trips semi-guided', () => {
    expect(parseModeParam('semi-guided')).toBe('semi-guided');
  });

  it('round-trips open', () => {
    expect(parseModeParam('open')).toBe('open');
  });

  it('falls back to guided on unknown values', () => {
    expect(parseModeParam('whatever')).toBe('guided');
  });

  it('falls back to guided on null', () => {
    expect(parseModeParam(null)).toBe('guided');
  });

  it('falls back to guided on empty string', () => {
    expect(parseModeParam('')).toBe('guided');
  });
});
