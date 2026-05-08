import { describe, expect, it } from 'vitest';
import * as Mod from './Checklist';

describe('Checklist', () => {
  it('exports the component', () => {
    expect(Mod.Checklist).toBeDefined();
    expect(typeof Mod.Checklist).toBe('function');
  });

  it.todo('registers widget state with kind checked on mount');
  it.todo('persists ticks via setWidgetValue');
  // TODO: full DOM tests need @testing-library/react + jsdom installed.
  //   npm i -D @testing-library/react @testing-library/jest-dom jsdom
  // Then add `test: { environment: 'jsdom', setupFiles: [...] }` to vite.config.ts.
});
