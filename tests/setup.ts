import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Some test files opt into `// @vitest-environment node` (pure-logic tests).
// Skip DOM-only teardown there — localStorage and the document are absent.
const hasDom = typeof document !== 'undefined';

// jsdom implements neither `window.matchMedia` nor `Element.prototype.scrollIntoView`.
// Stub both globally so any component reaching for them — RevealWhen's
// `scrollOnReveal` path and every future lab adopting it — does not crash.
// Plain functions (not `vi.fn()`) so a test's `vi.restoreAllMocks()` cannot
// wipe them; tests that assert on these spy locally and restore their own spy.
if (hasDom) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  localStorage.clear();
});
