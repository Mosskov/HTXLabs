import { describe, expect, it } from 'vitest';
import * as Physics from '@/simulations/dynamometer-g/physics';
import { meta } from '@/simulations/dynamometer-g/meta';

describe('dynamometer-g physics', () => {
  it('module exports something', () => {
    expect(Physics).toBeDefined();
    expect(Object.keys(Physics).length).toBeGreaterThan(0);
  });

  it('meta has a matching id', () => {
    expect(meta.id).toBe('dynamometer-g');
  });

  it.todo('forceFor / period / etc. — replace with real physics tests');
});
