import * as Mod from '@/lab-guide/widgets/FreeTextResponse';
import { describe, expect, it } from 'vitest';

describe('FreeTextResponse', () => {
  it('exports the component', () => {
    expect(Mod.FreeTextResponse).toBeDefined();
    expect(typeof Mod.FreeTextResponse).toBe('function');
  });

  it.todo('registers {kind:"filled", filled} when no keywordGroups provided');
  it.todo('registers {kind:"keywords", foundCount} when keywordGroups provided');
  it.todo('clamps foundCount to 0 while minWords floor not yet met (spam-gap closure)');
  it.todo('renders the keyword counter "Nøgleord fundet: n / t" in keyword mode');
  it.todo('honours keywordsFoundLabel override with {n}/{t} substitution');
  // TODO: full DOM tests need @testing-library/react + jsdom installed.
  //   npm i -D @testing-library/react @testing-library/jest-dom jsdom
  // Then add `test: { environment: 'jsdom', setupFiles: [...] }` to vite.config.ts.
});
