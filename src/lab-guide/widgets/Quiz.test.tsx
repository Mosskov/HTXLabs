import { describe, expect, it } from 'vitest';
import * as Mod from './Quiz';

describe('Quiz', () => {
  it('exports the component', () => {
    expect(Mod.Quiz).toBeDefined();
    expect(typeof Mod.Quiz).toBe('function');
  });

  it.todo('registers widget state with kind correct on Tjek');
  it.todo('persists picked option via setWidgetValue');
  it.todo('re-locks the gate when the user picks a different option after a check');
  // TODO: full DOM tests need @testing-library/react + jsdom installed.
  //   npm i -D @testing-library/react @testing-library/jest-dom jsdom
  // Then add `test: { environment: 'jsdom', setupFiles: [...] }` to vite.config.ts.
});
