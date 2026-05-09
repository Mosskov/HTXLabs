import * as Mod from '@/lab-guide/widgets/Quiz';
import { describe, expect, it } from 'vitest';

describe('Quiz', () => {
  it('exports the component', () => {
    expect(Mod.Quiz).toBeDefined();
    expect(typeof Mod.Quiz).toBe('function');
  });

  it.todo('registers widget state with kind correct on Tjek');
  it.todo('persists picked option as widgetValues[id]');
  it.todo('persists last-checked option as widgetValues[`${id}:checked`] sibling key');
  it.todo(
    're-locks the gate when the user picks a different option after a check (derived from value !== checkedFor)',
  );
  it.todo('preserves passed `correct` state across remount (sibling key restores checkedFor)');
  it.todo(
    'preserves passed `correct` state across reload (registers correct:true without re-Tjek)',
  );
  // TODO: full DOM tests need @testing-library/react + jsdom installed.
  //   npm i -D @testing-library/react @testing-library/jest-dom jsdom
  // Then add `test: { environment: 'jsdom', setupFiles: [...] }` to vite.config.ts.
});
