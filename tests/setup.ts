import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Some test files opt into `// @vitest-environment node` (pure-logic tests).
// Skip DOM-only teardown there — localStorage and the document are absent.
const hasDom = typeof document !== 'undefined';

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  localStorage.clear();
});
