# VariableTable Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1786-line `src/lab-guide/widgets/VariableTable.tsx` into flat sibling modules of at most ~640 lines, extracting its pure logic into independently unit-testable files, with zero behavior change.

**Architecture:** Bottom-up extraction, leaves first. Four pure logic modules (`variableTableValues`, `variableTableLocks`, `variableTableTjek`, `variableTableHints`), one custom hook (`useVariableTableUnlockSession`), and two component files (`VariableTableField`, `VariableTableRows`) are peeled off in dependency order. Functions that currently close over component state take it as explicit parameters. All new files are flat siblings in `src/lab-guide/widgets/` — matching the existing `VariableTable.tsx` + `variableTableCorrectness.ts` precedent. No subdirectory is created.

**Tech Stack:** TypeScript, React 18, Vitest 2 + @testing-library/react 16, Biome 1.9, Tailwind v3, Vite.

**Spec:** [docs/superpowers/specs/2026-08-04-variabletable-split-design.md](../specs/2026-08-04-variabletable-split-design.md)

**Branch:** `refactor/variabletable-split` (already created; spec committed as `7b34ec3`)

## Global Constraints

Every task's requirements implicitly include this section.

- **Behavior-preserving. Zero student-visible change.** No bug fixes, even for bugs noticed in passing — write them into `docs/BACKLOG.md` instead, in the task where you noticed them.
- **These four files must stay byte-identical.** They are the behavior oracle:
  - `tests/unit/lab-guide/widgets/VariableTable.test.tsx` (668 lines)
  - `tests/unit/lab-guide/widgets/VariableTable.lock.test.tsx` (648 lines)
  - `tests/unit/lab-guide/widgets/VariableTable.tjek.test.tsx` (685 lines)
  - `tests/unit/lab-guide/widgets/variableTableCorrectness.test.ts` (687 lines)

  Verify with `git diff --stat` after every task — these paths must not appear. **If one of them needs an edit to pass, stop and report it.** That is evidence of a behavior change, which is a bug, not a judgment call.
- **"Verbatim" means verbatim** — including every comment, JSDoc block, and `biome-ignore` directive. The comments in this file carry hard-won context (browser event ordering, matcher-pairing drift, reduced-motion contract). Do not reword, condense, or "improve" them while moving them.
- **Module-purpose header:** every `src/**/*.{ts,tsx}` file starts with one `//` comment line stating its role. New test files get one too (existing convention — see `variableTableCorrectness.test.ts`).
- **Flat layout.** All new files go directly in `src/lab-guide/widgets/`. Do not create a subdirectory.
- **Import alias:** prefer `@/*` over relative paths in tests. Inside `src/lab-guide/widgets/`, match the existing relative style (`./variableTableCorrectness`, `../strings.da`).
- **Test file conventions:** explicit `import { describe, expect, it } from 'vitest'` even though `globals: true`. Pure-logic test files open with `// @vitest-environment node`.
- **No new dependencies. No new testing patterns.** In particular: do **not** introduce `renderHook`. It is available in `@testing-library/react` 16.3.2 but used nowhere in this repo; adding it would be a new pattern requiring maintainer sign-off.
- **Biome must pass:** `npm run lint`. Note it runs `biome check src` — it does **not** lint `tests/`. Do not rely on lint to catch problems in new test files.
- **Never push to `main`.** Work stays on `refactor/variabletable-split`. Do not push at all without explicit instruction (pushing `main` triggers the live GitHub Pages deploy).
- **Danish strings:** this refactor moves strings, it never adds or edits them. Framework defaults stay in `src/lab-guide/strings.da.ts`.

## File Structure

All paths under `src/lab-guide/widgets/` unless noted.

| File | Est. lines | Responsibility |
|---|---|---|
| `variableTableValues.ts` | ~110 | **Create (Task 1).** Shared types (`VariableEntry`, `VariableTableValues`, `SectionConfig`, `Bounds`, `Section`), constants, bounds resolution, value rehydration from persisted state, filled predicates, expected-array clamping + dev warnings. |
| `variableTableLocks.ts` | ~110 | **Create (Task 2).** Pure lock-model resolution: is a cell locked-and-still-correct, studentIndex→expectedIndex mapping, section lock coverage. |
| `variableTableTjek.ts` | ~60 | **Create (Task 3).** Pure Tjek lock-diff (`computeTjekOutcome`) + dim-reason derivation. `FlashPayload` / `TjekDimReason` types. |
| `variableTableHints.ts` | ~150 | **Create (Task 4).** Per-cell hint resolution, spendable counting, spend-payload resolution, missing-row messages. |
| `useVariableTableUnlockSession.ts` | ~100 | **Create (Task 5).** `Field`'s unlock edit-session: session state, value+lockKey snapshot, focus-on-transition, long-press timer, blur commit. |
| `VariableTableField.tsx` | ~200 | **Create (Task 6).** `FieldProps`, `Field`, and the pure `flashClasses` helper. |
| `VariableTableRows.tsx` | ~280 | **Create (Task 7).** `RowGroupProps`, `RowGroupSection`, `RepeatableRowProps`, `RepeatableRow`. |
| `VariableTable.tsx` | 1786 → ~640 | **Modify (every task).** Retains `Props`, the `VariableTable` orchestrator, `InWidgetTjekButton`, `prefersReducedMotion`, and type re-exports. |
| `variableTableCorrectness.ts` | 671 | **Modify (Tasks 1, 4).** Task 1 repoints its `VariableEntry` import (breaking the existing type-only cycle). Task 4 fixes one stale comment. Otherwise untouched. |

New test files (not linted by `npm run lint`):

| File | Task |
|---|---|
| `tests/unit/lab-guide/widgets/variableTableValues.test.ts` | 1 |
| `tests/unit/lab-guide/widgets/variableTableLocks.test.ts` | 2 |
| `tests/unit/lab-guide/widgets/variableTableTjek.test.ts` | 3 |
| `tests/unit/lab-guide/widgets/variableTableHints.test.ts` | 4 |
| `tests/unit/lab-guide/widgets/variableTableFlashClasses.test.ts` | 6 |

### A note on TDD in this plan

Tasks 1–4 and 6 write a new test file **before** moving the code. Be clear-eyed about what that buys: the test goes RED because the module does not exist yet (import error), not because the behavior is missing — the behavior already exists and already passes through the component-level suite. This is **characterization testing**, not classic TDD.

Two rules make it worth doing anyway:

1. **Derive test cases from the documented contract** — the JSDoc and inline comments in the source, and the named risks in the spec. Do **not** derive them by reading the implementation line-by-line and asserting whatever it currently returns; that produces tautologies that lock in bugs.
2. **The real safety net is the existing suite.** Run it before and after every task. It is what actually proves behavior preservation.

Tasks 5 and 7 are pure motion with no new test file — existing RTL coverage exercises them directly.

---

### Task 1: `variableTableValues.ts` — shared types and value plumbing

Breaks the existing type-only import cycle between `VariableTable.tsx` and `variableTableCorrectness.ts` as a side effect.

**Files:**
- Create: `src/lab-guide/widgets/variableTableValues.ts`
- Create: `tests/unit/lab-guide/widgets/variableTableValues.test.ts`
- Modify: `src/lab-guide/widgets/VariableTable.tsx` (remove lines 83–100 and 177–286; add imports + type re-exports)
- Modify: `src/lab-guide/widgets/variableTableCorrectness.ts:41` (repoint one import)

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  ```ts
  export type Section = 'iv' | 'dv' | 'constants';
  export interface VariableEntry { name: string; symbol: string; unit: string }
  export interface VariableTableValues { iv: VariableEntry[]; dv: VariableEntry[]; constants: VariableEntry[] }
  export type SectionConfig = { count: number } | { min: number; max: number };
  export interface Bounds { min: number; max: number }

  export const EMPTY: VariableEntry;
  export const CELLS: readonly Cell[];
  export const DEFAULT_IV_BOUNDS: Bounds;
  export const DEFAULT_DV_BOUNDS: Bounds;
  export const DEFAULT_CONSTANTS_BOUNDS: Bounds;

  export function cellKey(section: Section, expectedIndex: number, cell: Cell): string;
  export function resolveBounds(config: SectionConfig | undefined, fallback: Bounds): Bounds;
  export function emptyRows(n: number): VariableEntry[];
  export function readRows(raw: unknown, min: number): VariableEntry[];
  export function readValues(raw: unknown, bounds: { iv: Bounds; dv: Bounds; constants: Bounds }): VariableTableValues;
  export function entryFilled(e: VariableEntry, requireUnits: boolean): boolean;
  export function entryEmpty(e: VariableEntry): boolean;
  export function sectionFilled(rows: VariableEntry[], bounds: Bounds, requireUnits: boolean): boolean;
  export function valuesEqual(a: unknown, b: unknown): boolean;
  export function clampExpected<T>(widgetId: string, section: Section, expected: T[], bounds: Bounds): T[];
  export function warnMalformed(widgetId: string, section: Section, expected: ReadonlyArray<{ symbol?: unknown; name?: unknown }>): void;
  ```
  `Cell` is imported from `./variableTableCorrectness` — it stays there. `Bounds` becomes exported (currently module-private) because Task 7 needs it.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lab-guide/widgets/variableTableValues.test.ts`:

```ts
// @vitest-environment node
// Pure-helper unit tests for variableTableValues: bounds resolution, value
// rehydration from persisted state, filled/empty predicates, and expected-array
// clamping.
import {
  DEFAULT_CONSTANTS_BOUNDS,
  DEFAULT_IV_BOUNDS,
  cellKey,
  clampExpected,
  emptyRows,
  entryEmpty,
  entryFilled,
  readRows,
  readValues,
  resolveBounds,
  sectionFilled,
  valuesEqual,
} from '@/lab-guide/widgets/variableTableValues';
import { describe, expect, it, vi } from 'vitest';

const filledEntry = { name: 'højde', symbol: 'h', unit: 'm' };

describe('cellKey', () => {
  it('joins section, expected index, and cell with dots', () => {
    expect(cellKey('iv', 0, 'symbol')).toBe('iv.0.symbol');
    expect(cellKey('constants', 2, 'name')).toBe('constants.2.name');
  });
});

describe('resolveBounds', () => {
  it('returns the fallback when no config is given', () => {
    expect(resolveBounds(undefined, DEFAULT_IV_BOUNDS)).toEqual({ min: 1, max: 1 });
  });
  it('pins min and max to the same value for { count }', () => {
    expect(resolveBounds({ count: 3 }, DEFAULT_IV_BOUNDS)).toEqual({ min: 3, max: 3 });
  });
  it('passes { min, max } through', () => {
    expect(resolveBounds({ min: 1, max: 4 }, DEFAULT_IV_BOUNDS)).toEqual({ min: 1, max: 4 });
  });
});

describe('emptyRows', () => {
  it('builds n distinct empty entries', () => {
    const rows = emptyRows(2);
    expect(rows).toEqual([
      { name: '', symbol: '', unit: '' },
      { name: '', symbol: '', unit: '' },
    ]);
    // Distinct objects — a shared reference would alias edits across rows.
    expect(rows[0]).not.toBe(rows[1]);
  });
  it('returns [] for a non-finite count', () => {
    expect(emptyRows(Number.POSITIVE_INFINITY)).toEqual([]);
  });
  it('clamps negatives to []', () => {
    expect(emptyRows(-1)).toEqual([]);
  });
});

describe('readRows', () => {
  it('pads a short persisted array up to min', () => {
    expect(readRows([filledEntry], 2)).toEqual([filledEntry, { name: '', symbol: '', unit: '' }]);
  });
  it('fills missing cells on a partial persisted row', () => {
    expect(readRows([{ symbol: 'h' }], 1)).toEqual([{ name: '', symbol: 'h', unit: '' }]);
  });
  it('falls back to min empty rows for a non-array', () => {
    expect(readRows(undefined, 1)).toEqual([{ name: '', symbol: '', unit: '' }]);
    expect(readRows('nonsense', 0)).toEqual([]);
  });
  it('keeps rows beyond min', () => {
    expect(readRows([filledEntry, filledEntry], 1)).toHaveLength(2);
  });
});

describe('readValues', () => {
  const bounds = { iv: { min: 1, max: 1 }, dv: { min: 1, max: 1 }, constants: { min: 0, max: 5 } };

  it('rehydrates each section independently', () => {
    const out = readValues({ iv: [filledEntry] }, bounds);
    expect(out.iv).toEqual([filledEntry]);
    expect(out.dv).toEqual([{ name: '', symbol: '', unit: '' }]);
    expect(out.constants).toEqual([]);
  });
  it('returns min-sized empty sections for a non-object', () => {
    const out = readValues(null, bounds);
    expect(out.iv).toHaveLength(1);
    expect(out.dv).toHaveLength(1);
    expect(out.constants).toHaveLength(0);
  });
});

describe('entryFilled', () => {
  it('ignores the unit cell when requireUnits is false', () => {
    expect(entryFilled({ name: 'højde', symbol: 'h', unit: '' }, false)).toBe(true);
  });
  it('requires the unit cell when requireUnits is true', () => {
    expect(entryFilled({ name: 'højde', symbol: 'h', unit: '' }, true)).toBe(false);
    expect(entryFilled(filledEntry, true)).toBe(true);
  });
  it('treats whitespace-only as not filled', () => {
    expect(entryFilled({ name: '   ', symbol: 'h', unit: 'm' }, false)).toBe(false);
  });
});

describe('entryEmpty', () => {
  it('is true for blank and whitespace-only entries', () => {
    expect(entryEmpty({ name: '', symbol: '', unit: '' })).toBe(true);
    expect(entryEmpty({ name: ' ', symbol: '\t', unit: '  ' })).toBe(true);
  });
  it('is false when any cell has content', () => {
    expect(entryEmpty({ name: '', symbol: 'h', unit: '' })).toBe(false);
  });
});

describe('sectionFilled', () => {
  it('is false below min row count', () => {
    expect(sectionFilled([], { min: 1, max: 1 }, false)).toBe(false);
  });
  it('is false above a finite max row count', () => {
    expect(sectionFilled([filledEntry, filledEntry], { min: 1, max: 1 }, false)).toBe(false);
  });
  it('allows any count under an infinite max', () => {
    expect(sectionFilled([filledEntry, filledEntry], DEFAULT_CONSTANTS_BOUNDS, false)).toBe(true);
  });
  it('is false when any row is unfilled', () => {
    expect(sectionFilled([filledEntry, { name: '', symbol: '', unit: '' }], { min: 1, max: 2 }, false)).toBe(false);
  });
});

describe('valuesEqual', () => {
  it('compares structurally', () => {
    expect(valuesEqual([filledEntry], [{ ...filledEntry }])).toBe(true);
    expect(valuesEqual([filledEntry], [{ ...filledEntry, unit: 'cm' }])).toBe(false);
  });
});

describe('clampExpected', () => {
  it('returns the input unchanged when it fits', () => {
    const arr = [{ symbol: 'h' }];
    expect(clampExpected('w1', 'iv', arr, { min: 1, max: 1 })).toBe(arr);
  });
  it('returns the input unchanged under an infinite max', () => {
    const arr = [{ symbol: 'h' }, { symbol: 't' }];
    expect(clampExpected('w1', 'constants', arr, DEFAULT_CONSTANTS_BOUNDS)).toBe(arr);
  });
  it('truncates to max when the author oversupplied', () => {
    // PL14 guard: extra entries would be permanently unlockable — the student
    // physically cannot render enough rows to satisfy them.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const arr = [{ symbol: 'h' }, { symbol: 't' }, { symbol: 'v' }];
    expect(clampExpected('w1', 'iv', arr, { min: 1, max: 2 })).toEqual([{ symbol: 'h' }, { symbol: 't' }]);
    warn.mockRestore();
  });
});
```

The `console.warn` spy silences expected dev-guard noise. We deliberately do **not** assert the warning fired — `import.meta.env.DEV` depends on run mode, so asserting it would make the test mode-dependent. The truncation return value is the deterministic contract.

- [ ] **Step 2: Run the test to verify it fails**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableValues.test.ts
```

Expected: FAIL — cannot resolve `@/lab-guide/widgets/variableTableValues` (module does not exist).

- [ ] **Step 3: Create the module**

Create `src/lab-guide/widgets/variableTableValues.ts`, starting with a module-purpose header:

```ts
// Shared VariableTable types plus pure value plumbing: bounds resolution,
// rehydration of persisted widget values, filled/empty predicates, and
// expected-array clamping with dev-only authoring warnings.
import type { Cell } from './variableTableCorrectness';
```

Then:
1. Move lines **83–100** of `VariableTable.tsx` verbatim (`VariableEntry`, `VariableTableValues`, `SectionConfig`, `Bounds`), adding `export` to `Bounds`.
2. Move lines **177–286** verbatim (`EMPTY`, `CELLS`, `cellKey`, `resolveBounds`, `DEFAULT_*_BOUNDS`, `emptyRows`, `readRows`, `readValues`, `entryFilled`, `entryEmpty`, `sectionFilled`, `valuesEqual`, `clampExpected`, `warnMalformed`), adding `export` to each.
3. Add `export type Section = 'iv' | 'dv' | 'constants';` and replace the inline `'iv' | 'dv' | 'constants'` unions in the moved signatures with `Section`.

`Section` lives here while `Cell` stays in `variableTableCorrectness.ts` — deliberate: `Cell` is a correctness concept, `Section` is a layout/values concept. Do not consolidate them.

- [ ] **Step 4: Run the new test to verify it passes**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableValues.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire up `VariableTable.tsx` and break the import cycle**

In `VariableTable.tsx`:
- Delete the moved lines (83–100, 177–286).
- Import what the component still uses from the new module.
- Re-export the public types so the widget's public surface is unchanged:

```ts
export type { VariableEntry, VariableTableValues, SectionConfig } from './variableTableValues';
```

In `variableTableCorrectness.ts`, repoint line 41:

```ts
// before
import type { VariableEntry } from './VariableTable';
// after
import type { VariableEntry } from './variableTableValues';
```

That single edit breaks the type-only cycle. The re-export keeps all six other type-importing files working untouched — including `VariableTable.test.tsx` and `variableTableCorrectness.test.ts`.

- [ ] **Step 6: Run the full suite and lint**

```sh
npm test -- --run
npm run lint
git diff --stat
```

Expected: all tests pass. Lint clean. `git diff --stat` shows `VariableTable.tsx` and `variableTableCorrectness.ts` modified, the two new files added, and **none** of the four oracle test files.

- [ ] **Step 7: Commit**

```sh
git add src/lab-guide/widgets/variableTableValues.ts \
        src/lab-guide/widgets/VariableTable.tsx \
        src/lab-guide/widgets/variableTableCorrectness.ts \
        tests/unit/lab-guide/widgets/variableTableValues.test.ts
git commit -m "refactor(VariableTable): extract shared types and value plumbing

Moves VariableEntry, VariableTableValues, SectionConfig, Bounds and the
pure value helpers into variableTableValues.ts. Repointing the
VariableEntry import in variableTableCorrectness.ts breaks the existing
type-only cycle between it and VariableTable.tsx.

Public types are re-exported from VariableTable.tsx, so all other
importers — including both affected test files — are untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `variableTableLocks.ts` — pure lock-model resolution

**Files:**
- Create: `src/lab-guide/widgets/variableTableLocks.ts`
- Create: `tests/unit/lab-guide/widgets/variableTableLocks.test.ts`
- Modify: `src/lab-guide/widgets/VariableTable.tsx` (remove lines 444–519; update call sites)

**Interfaces:**
- Consumes: `Section`, `cellKey`, `CELLS` from `./variableTableValues` (Task 1).
- Produces:
  ```ts
  export type Locks = Record<string, boolean>;

  export function cellLockedAndCorrect(locks: Locks, errors: CorrectnessReport | undefined,
    section: Section, expectedIndex: number, cell: Cell): boolean;

  export function cellLockedForStudent(locks: Locks, errors: CorrectnessReport | undefined,
    section: Section, studentIndex: number, cell: Cell): boolean;

  export function lockKeyForStudent(locks: Locks, errors: CorrectnessReport | undefined,
    section: Section, studentIndex: number, cell: Cell): string | null;

  export function sectionFullyLockedCorrect(locks: Locks, errors: CorrectnessReport | undefined,
    section: Section,
    sectionExpected: ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>,
  ): { covered: boolean; configured: number };
  ```
  The four functions currently close over `locks` and `errors`; they now take both as leading parameters. No factory wrapper — explicit params are plainer and directly testable.

**Stays in the component:** the `correct` / `sections` aggregation (lines 521–546). It reads props (`expected`, `constantsConfig`) and the `filled` derivation, so extracting it would mean threading most of the component's state through a second signature.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lab-guide/widgets/variableTableLocks.test.ts`:

```ts
// @vitest-environment node
// Pure-helper unit tests for variableTableLocks. Covers the rule documented in
// the module header: a cell is locked-and-correct only when a lock entry exists
// AND the current matcher report still pairs its expected row to a student row
// whose value passes for that cell — so a stale lock never resurrects a gate.
import type { CorrectnessReport } from '@/lab-guide/widgets/variableTableCorrectness';
import {
  cellLockedAndCorrect,
  cellLockedForStudent,
  lockKeyForStudent,
  sectionFullyLockedCorrect,
} from '@/lab-guide/widgets/variableTableLocks';
import { describe, expect, it } from 'vitest';

const matched: CorrectnessReport = {
  iv: [{ status: 'matched', expectedIndex: 0, studentIndex: 0 }],
  dv: [],
};

const partialSymbolWrong: CorrectnessReport = {
  iv: [{ status: 'partial', expectedIndex: 0, studentIndex: 0, errors: { symbol: { type: 'mismatch' } } }],
  dv: [],
};

const missing: CorrectnessReport = {
  iv: [{ status: 'missing', expectedIndex: 0 }],
  dv: [],
};

// Student row 1 paired to expected row 0 — the multi-row reshuffle case.
const crossPaired: CorrectnessReport = {
  iv: [{ status: 'matched', expectedIndex: 0, studentIndex: 1 }],
  dv: [],
};

describe('cellLockedAndCorrect', () => {
  it('is false with no lock entry', () => {
    expect(cellLockedAndCorrect({}, matched, 'iv', 0, 'symbol')).toBe(false);
  });
  it('is true for a locked cell on a fully matched row', () => {
    expect(cellLockedAndCorrect({ 'iv.0.symbol': true }, matched, 'iv', 0, 'symbol')).toBe(true);
  });
  it('is false for a locked cell that the matcher now reports wrong', () => {
    // Stale lock — the student edited the value after locking it.
    expect(cellLockedAndCorrect({ 'iv.0.symbol': true }, partialSymbolWrong, 'iv', 0, 'symbol')).toBe(false);
  });
  it('is true for a locked cell with no error on a partial row', () => {
    expect(cellLockedAndCorrect({ 'iv.0.name': true }, partialSymbolWrong, 'iv', 0, 'name')).toBe(true);
  });
  it('is false when the expected row has no student pairing at all', () => {
    expect(cellLockedAndCorrect({ 'iv.0.symbol': true }, missing, 'iv', 0, 'symbol')).toBe(false);
  });
  it('is false when there is no correctness report', () => {
    expect(cellLockedAndCorrect({ 'iv.0.symbol': true }, undefined, 'iv', 0, 'symbol')).toBe(false);
  });
});

describe('cellLockedForStudent', () => {
  it('resolves studentIndex to expectedIndex via the matcher', () => {
    expect(cellLockedForStudent({ 'iv.0.symbol': true }, crossPaired, 'iv', 1, 'symbol')).toBe(true);
  });
  it('is false for a student row with no matcher pairing', () => {
    expect(cellLockedForStudent({ 'iv.0.symbol': true }, crossPaired, 'iv', 0, 'symbol')).toBe(false);
  });
});

describe('lockKeyForStudent', () => {
  it('returns the expected-row-keyed lock key for a locked cell', () => {
    expect(lockKeyForStudent({ 'iv.0.symbol': true }, crossPaired, 'iv', 1, 'symbol')).toBe('iv.0.symbol');
  });
  it('returns null when the cell is not locked', () => {
    expect(lockKeyForStudent({}, crossPaired, 'iv', 1, 'symbol')).toBeNull();
  });
  it('returns null for an unpaired student row', () => {
    expect(lockKeyForStudent({ 'iv.0.symbol': true }, missing, 'iv', 0, 'symbol')).toBeNull();
  });
});

describe('sectionFullyLockedCorrect', () => {
  const expectedIv = [{ name: 'højde', symbol: 'h' }];

  it('counts only configured cells and reports full coverage', () => {
    const locks = { 'iv.0.name': true, 'iv.0.symbol': true };
    expect(sectionFullyLockedCorrect(locks, matched, 'iv', expectedIv)).toEqual({
      covered: true,
      configured: 2,
    });
  });
  it('reports partial coverage when one configured cell is unlocked', () => {
    expect(sectionFullyLockedCorrect({ 'iv.0.name': true }, matched, 'iv', expectedIv)).toEqual({
      covered: false,
      configured: 2,
    });
  });
  it('ignores unconfigured cells — unit is absent from the expected entry', () => {
    const locks = { 'iv.0.name': true, 'iv.0.symbol': true };
    // `unit` is not configured, so leaving it unlocked must not break coverage.
    expect(sectionFullyLockedCorrect(locks, matched, 'iv', expectedIv).covered).toBe(true);
  });
  it('reports vacuous coverage for an expected entry with no configured cells', () => {
    expect(sectionFullyLockedCorrect({}, matched, 'iv', [{}])).toEqual({
      covered: true,
      configured: 0,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableLocks.test.ts
```

Expected: FAIL — cannot resolve `@/lab-guide/widgets/variableTableLocks`.

- [ ] **Step 3: Create the module**

Create `src/lab-guide/widgets/variableTableLocks.ts` with a module-purpose header:

```ts
// Pure lock-model resolution for VariableTable: whether a cell is
// locked-and-still-correct, studentIndex -> expectedIndex mapping for the
// render path, and per-section lock coverage. A lock alone is never enough —
// the current matcher report must still agree, so a stale lock cannot
// resurrect a satisfied gate.
```

Move lines **444–519** of `VariableTable.tsx` verbatim (`cellLockedAndCorrect`, `cellLockedForStudent`, `lockKeyForStudent`, `sectionFullyLockedCorrect`), converting each from a closure to an exported function with `locks` and `errors` as leading parameters. Keep every explanatory comment — especially the one on `lockKeyForStudent` about snapshotting the key before matcher pairing can shift.

- [ ] **Step 4: Run the new test to verify it passes**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableLocks.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update the component call sites**

In `VariableTable.tsx`, delete the four inner functions and thread `locks` / `errors` at each call site. The `locks` local (line 444) and `errors` local (line 426) stay where they are.

```ts
// before
getLocked={(s, cell) => cellLockedForStudent('iv', s, cell)}
// after
getLocked={(s, cell) => cellLockedForStudent(locks, errors, 'iv', s, cell)}
```

Call sites to update: the `ivLock` / `dvLock` / `constantsLock` derivations (lines 521–526) and the `getLocked` / `getLockKey` props on all three `<RowGroupSection>` elements.

**Watch for:** `flashForStudent` (lines 974–985) uses the same studentIndex→expectedIndex pairing but reads `flash`, not `locks`. It is **not** part of this task — leave it in the component.

- [ ] **Step 6: Run the full suite and lint**

```sh
npm test -- --run
npm run lint
git diff --stat
```

Expected: all pass; none of the four oracle test files appear in the diff.

- [ ] **Step 7: Commit**

```sh
git add src/lab-guide/widgets/variableTableLocks.ts \
        src/lab-guide/widgets/VariableTable.tsx \
        tests/unit/lab-guide/widgets/variableTableLocks.test.ts
git commit -m "refactor(VariableTable): extract pure lock-model resolution

Converts the four lock-resolution closures into exported functions taking
locks and errors as explicit parameters. No behavior change; the
correct/sections aggregation stays in the component because it reads
props and the filled derivation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `variableTableTjek.ts` — pure Tjek lock-diff

**Files:**
- Create: `src/lab-guide/widgets/variableTableTjek.ts`
- Create: `tests/unit/lab-guide/widgets/variableTableTjek.test.ts`
- Modify: `src/lab-guide/widgets/VariableTable.tsx` (remove lines 319–336 and 603–610; rewrite `handleTjek` body 634–689)

**Interfaces:**
- Consumes: `Section`, `VariableTableValues`, `cellKey`, `CELLS`, `entryEmpty` from `./variableTableValues` (Task 1).
- Produces:
  ```ts
  export interface FlashPayload {
    keys: Record<string, 'correct' | 'wrong'>;
    nonce: number;
    withTransition: boolean;
  }
  export type TjekDimReason = 'empty' | 'clean' | null;

  export type SectionExpected = ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>;

  export function computeTjekOutcome(input: {
    values: VariableTableValues;
    errors: CorrectnessReport;
    expected: Record<Section, SectionExpected>;
    locks: Record<string, boolean>;
  }): {
    newlyLocked: string[];
    newlyUnlocked: string[];
    flashKeys: Record<string, 'correct' | 'wrong'>;
  };

  export function deriveTjekDimReason(
    values: VariableTableValues,
    sectionChecked: Record<Section, boolean>,
    lastCheckedExists: boolean,
    hasExpected: boolean,
  ): TjekDimReason;
  ```

**Stays in the component:** `prefersReducedMotion()` (lines 338–341). It reads `window.matchMedia`; keeping it out is what makes this module 100% pure. Dim-*tooltip* resolution also stays in the component (it reads `strings.da`) — only the *reason* is derived here.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lab-guide/widgets/variableTableTjek.test.ts`:

```ts
// @vitest-environment node
// Pure-helper unit tests for variableTableTjek. Covers the per-cell lock/flash
// rules documented in VariableTable's header: correct+filled locks and flashes
// emerald, wrong+filled flashes rose without locking, empty is ignored, and a
// stale lock is dropped (rose-flashed only when the value regressed rather than
// being cleared).
import type { CorrectnessReport } from '@/lab-guide/widgets/variableTableCorrectness';
import { computeTjekOutcome, deriveTjekDimReason } from '@/lab-guide/widgets/variableTableTjek';
import type { VariableTableValues } from '@/lab-guide/widgets/variableTableValues';
import { describe, expect, it } from 'vitest';

const blank = { name: '', symbol: '', unit: '' };

function values(iv: Partial<typeof blank>[]): VariableTableValues {
  return { iv: iv.map((r) => ({ ...blank, ...r })), dv: [], constants: [] };
}

// Only `symbol` is configured, so `name` and `unit` must be ignored throughout.
const expected = { iv: [{ symbol: 'h' }], dv: [], constants: [] };

const matched: CorrectnessReport = {
  iv: [{ status: 'matched', expectedIndex: 0, studentIndex: 0 }],
  dv: [],
};
const symbolWrong: CorrectnessReport = {
  iv: [{ status: 'partial', expectedIndex: 0, studentIndex: 0, errors: { symbol: { type: 'mismatch' } } }],
  dv: [],
};

describe('computeTjekOutcome', () => {
  it('locks and emerald-flashes a correct filled cell', () => {
    const out = computeTjekOutcome({ values: values([{ symbol: 'h' }]), errors: matched, expected, locks: {} });
    expect(out.newlyLocked).toEqual(['iv.0.symbol']);
    expect(out.newlyUnlocked).toEqual([]);
    expect(out.flashKeys).toEqual({ 'iv.0.symbol': 'correct' });
  });

  it('rose-flashes a wrong filled cell without locking it', () => {
    const out = computeTjekOutcome({ values: values([{ symbol: 'x' }]), errors: symbolWrong, expected, locks: {} });
    expect(out.newlyLocked).toEqual([]);
    expect(out.flashKeys).toEqual({ 'iv.0.symbol': 'wrong' });
  });

  it('ignores an empty cell entirely', () => {
    const out = computeTjekOutcome({ values: values([{}]), errors: symbolWrong, expected, locks: {} });
    expect(out.newlyLocked).toEqual([]);
    expect(out.newlyUnlocked).toEqual([]);
    expect(out.flashKeys).toEqual({});
  });

  it('drops a stale lock silently when the value was cleared', () => {
    // Cleared, not wrong — so no flash, but the lock must not survive.
    const out = computeTjekOutcome({
      values: values([{}]),
      errors: symbolWrong,
      expected,
      locks: { 'iv.0.symbol': true },
    });
    expect(out.newlyUnlocked).toEqual(['iv.0.symbol']);
    expect(out.flashKeys).toEqual({});
  });

  it('is a no-op for a locked cell that is still correct', () => {
    const out = computeTjekOutcome({
      values: values([{ symbol: 'h' }]),
      errors: matched,
      expected,
      locks: { 'iv.0.symbol': true },
    });
    expect(out.newlyLocked).toEqual([]);
    expect(out.newlyUnlocked).toEqual([]);
    expect(out.flashKeys).toEqual({});
  });

  it('drops the lock and rose-flashes a regressed locked cell', () => {
    const out = computeTjekOutcome({
      values: values([{ symbol: 'x' }]),
      errors: symbolWrong,
      expected,
      locks: { 'iv.0.symbol': true },
    });
    expect(out.newlyUnlocked).toEqual(['iv.0.symbol']);
    expect(out.flashKeys).toEqual({ 'iv.0.symbol': 'wrong' });
  });

  it('ignores cells the author did not configure', () => {
    const out = computeTjekOutcome({
      values: values([{ name: 'højde', symbol: 'h', unit: 'm' }]),
      errors: matched,
      expected,
      locks: {},
    });
    // Only `symbol` is configured — `name` and `unit` produce no keys.
    expect(Object.keys(out.flashKeys)).toEqual(['iv.0.symbol']);
  });

  it('ignores rows the matcher reports as missing', () => {
    const missing: CorrectnessReport = { iv: [{ status: 'missing', expectedIndex: 0 }], dv: [] };
    const out = computeTjekOutcome({ values: values([]), errors: missing, expected, locks: {} });
    expect(out.flashKeys).toEqual({});
  });
});

describe('deriveTjekDimReason', () => {
  const allClean = { iv: true, dv: true, constants: true };
  const allDirty = { iv: false, dv: false, constants: false };
  const filledValues = values([{ symbol: 'h' }]);

  it('is null when no answer key is configured', () => {
    expect(deriveTjekDimReason(values([]), allDirty, false, false)).toBeNull();
  });
  it("is 'empty' when nothing has been entered anywhere", () => {
    expect(deriveTjekDimReason(values([{}]), allDirty, false, true)).toBe('empty');
  });
  it("is 'clean' when every section still matches the last snapshot", () => {
    expect(deriveTjekDimReason(filledValues, allClean, true, true)).toBe('clean');
  });
  it('is null when a section has been edited since the last Tjek', () => {
    expect(deriveTjekDimReason(filledValues, allDirty, true, true)).toBeNull();
  });
  it("prefers 'empty' over 'clean'", () => {
    expect(deriveTjekDimReason(values([{}]), allClean, true, true)).toBe('empty');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableTjek.test.ts
```

Expected: FAIL — cannot resolve `@/lab-guide/widgets/variableTableTjek`.

- [ ] **Step 3: Create the module**

Create `src/lab-guide/widgets/variableTableTjek.ts` with a module-purpose header:

```ts
// Pure Tjek derivations for VariableTable: the per-cell lock/unlock/flash diff
// a Tjek click produces, and the reason the Tjek button is dimmed. No DOM and
// no store access — the component owns both.
```

1. Move `FlashPayload` (lines 324–328) and `TjekDimReason` (lines 330–336) verbatim, with their JSDoc.
2. Extract `computeTjekOutcome` from the body of `handleTjek` (lines 634–689) — the `sectionData` array build plus the nested loop. Take `values` / `errors` / `expected` / `locks` from the input object instead of the enclosing closure. Keep the comments about empty-cell handling and stale-lock cleanup.
3. Extract `deriveTjekDimReason` from lines 603–610 (`valuesAllEmpty`, `allSectionsClean`, and the ternary).

- [ ] **Step 4: Run the new test to verify it passes**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableTjek.test.ts
```

Expected: PASS.

- [ ] **Step 5: Rewrite `handleTjek` and the dim derivation in the component**

`handleTjek` becomes store orchestration only:

```ts
function handleTjek() {
  if (!expected || !errors) return;
  // Dimmed Tjek is a no-op — the click hit a no-changes-or-empty state. Let
  // the dim affordance carry the signal; don't snapshot the values again.
  if (tjekDimReason !== null) return;
  setVariableTableLastChecked(id, values);

  const { newlyLocked, newlyUnlocked, flashKeys } = computeTjekOutcome({
    values,
    errors,
    expected: {
      iv: ivExpectedArr,
      dv: dvExpectedArr,
      constants: constantsExpectedArr ?? [],
    },
    locks,
  });

  if (newlyLocked.length > 0) lockVtCells(id, newlyLocked);
  for (const k of newlyUnlocked) unlockVtCell(id, k);

  const withTransition = !prefersReducedMotion();
  flashNonceRef.current += 1;
  const nonce = flashNonceRef.current;
  setFlash({ keys: flashKeys, nonce, withTransition });
  if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
  flashTimerRef.current = setTimeout(() => {
    setFlash(null);
    flashTimerRef.current = null;
  }, 1500);
}
```

And the dim derivation replaces lines 603–610, keeping the tooltip resolution (611–616) as-is:

```ts
const tjekDimReason = deriveTjekDimReason(
  values,
  sectionChecked,
  lastChecked !== undefined,
  expected !== undefined,
);
```

- [ ] **Step 6: Run the full suite and lint**

```sh
npm test -- --run
npm run lint
git diff --stat
```

Expected: all pass. `VariableTable.tjek.test.tsx` (685 lines) is the heaviest oracle for this task — if it fails, the diff logic changed. None of the four oracle files may appear in the diff.

- [ ] **Step 7: Commit**

```sh
git add src/lab-guide/widgets/variableTableTjek.ts \
        src/lab-guide/widgets/VariableTable.tsx \
        tests/unit/lab-guide/widgets/variableTableTjek.test.ts
git commit -m "refactor(VariableTable): extract pure Tjek lock-diff

computeTjekOutcome takes values/errors/expected/locks and returns the
newlyLocked, newlyUnlocked and flashKeys diff. handleTjek reduces to store
orchestration. prefersReducedMotion stays in the component so this module
has no DOM dependency.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `variableTableHints.ts` — per-cell hint resolution

**Files:**
- Create: `src/lab-guide/widgets/variableTableHints.ts`
- Create: `tests/unit/lab-guide/widgets/variableTableHints.test.ts`
- Modify: `src/lab-guide/widgets/VariableTable.tsx` (remove lines 288–317, 743–839, 846–871, 925–960)
- Modify: `src/lab-guide/widgets/variableTableCorrectness.ts:621` (stale comment)

**Interfaces:**
- Consumes: `Section`, `VariableTableValues`, `cellKey`, `CELLS` from `./variableTableValues` (Task 1). `SectionExpected` from `./variableTableTjek` (Task 3).
- Produces:
  ```ts
  export interface CellHintInfo {
    cap: number;
    nextTier: number | null;
    freeDiagnostic: string | null;
    popupEntries: HintPopupEntry[];
  }
  export const EMPTY_CELL_INFO: CellHintInfo;

  export interface HintCtx {
    hasExpected: boolean;
    tiers: Record<string, number>;
    reveals: Record<string, string[]>;
    sectionClean: Record<Section, boolean>;
  }

  export function freeDiagnosticFor(err: CellError | undefined, cell: Cell): string | null;

  export function cellInfoFor(ctx: HintCtx, section: Section, sectionExpected: SectionExpected,
    matches: RowMatch[] | undefined, studentIndex: number, cell: Cell): CellHintInfo;

  export function countSpendable(ctx: HintCtx, values: VariableTableValues,
    errors: CorrectnessReport, expected: Record<Section, SectionExpected>): number;

  export function resolveSpend(ctx: HintCtx, section: Section,
    sectionExpected: SectionExpected | undefined, matches: RowMatch[] | undefined,
    studentIndex: number, cell: Cell): { cellKey: string; revealedText: string; hintCap: number } | null;

  export function missingMessagesFor(ctx: HintCtx, section: Section,
    sectionExpected: SectionExpected | undefined, matches: RowMatch[] | undefined,
    template: string): string[];
  ```
  `resolveSpend` returns the payload only. The component dispatches `spendAndRevealVtTier` and calls `exitSpendMode` — both side effects stay there.

**Two documented limitations must survive verbatim.** Both look like bugs and are not:
- `cellInfoFor`'s `expectedIndex = studentIndex` fallback (line 762) when the matcher finds no pairing. Correct for single-row sections; a known limitation for multi-row.
- `missingMessagesFor`'s one-message-per-section cap (line 868), which exists to avoid hint spam.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lab-guide/widgets/variableTableHints.test.ts`. Assertions are structural (cap sizes, tier gating, entry ordering and tones) rather than exact Danish strings, so a copy edit in `strings.da.ts` does not break them:

```ts
// @vitest-environment node
// Pure-helper unit tests for variableTableHints. Covers the gating rules
// documented in VariableTable's header: paid tiers advance only on a clean
// section, free diagnostics surface only on a clean section, and already-paid
// reveals survive any subsequent edit — including clearing the cell.
import type { CorrectnessReport } from '@/lab-guide/widgets/variableTableCorrectness';
import {
  type HintCtx,
  cellInfoFor,
  countSpendable,
  freeDiagnosticFor,
  missingMessagesFor,
  resolveSpend,
} from '@/lab-guide/widgets/variableTableHints';
import type { VariableTableValues } from '@/lab-guide/widgets/variableTableValues';
import { describe, expect, it } from 'vitest';

const clean: HintCtx = {
  hasExpected: true,
  tiers: {},
  reveals: {},
  sectionClean: { iv: true, dv: true, constants: true },
};
const dirty: HintCtx = { ...clean, sectionClean: { iv: false, dv: false, constants: false } };

const expectedIv = [{ symbol: 'h' }];
const symbolWrong: CorrectnessReport = {
  iv: [{ status: 'partial', expectedIndex: 0, studentIndex: 0, errors: { symbol: { type: 'mismatch' } } }],
  dv: [],
};
const caseWrong: CorrectnessReport = {
  iv: [{ status: 'partial', expectedIndex: 0, studentIndex: 0, errors: { symbol: { type: 'case-mismatch' } } }],
  dv: [],
};

describe('freeDiagnosticFor', () => {
  it('returns text for the two free diagnostic error types', () => {
    expect(freeDiagnosticFor({ type: 'case-mismatch' }, 'symbol')).toBeTypeOf('string');
    expect(freeDiagnosticFor({ type: 'whitespace-internal' }, 'symbol')).toBeTypeOf('string');
  });
  it('returns null for paid error types and for no error', () => {
    expect(freeDiagnosticFor({ type: 'mismatch' }, 'symbol')).toBeNull();
    expect(freeDiagnosticFor(undefined, 'symbol')).toBeNull();
  });
});

describe('cellInfoFor', () => {
  it('returns the empty info when no answer key is configured', () => {
    const ctx: HintCtx = { ...clean, hasExpected: false };
    expect(cellInfoFor(ctx, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol')).toEqual({
      cap: 0,
      nextTier: null,
      freeDiagnostic: null,
      popupEntries: [],
    });
  });

  it('offers tier 1 on a failing cell in a clean section', () => {
    const info = cellInfoFor(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol');
    expect(info.cap).toBeGreaterThan(0);
    expect(info.nextTier).toBe(1);
  });

  it('offers no tier mid-edit', () => {
    // Spending mid-edit would charge for a hint about an error that may shift
    // on the next keystroke.
    expect(cellInfoFor(dirty, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol').nextTier).toBeNull();
  });

  it('offers no tier once the ladder is exhausted', () => {
    const cap = cellInfoFor(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol').cap;
    const capped: HintCtx = { ...clean, tiers: { 'iv.0.symbol': cap } };
    expect(cellInfoFor(capped, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol').nextTier).toBeNull();
  });

  it('surfaces a free diagnostic only on a clean section', () => {
    expect(cellInfoFor(clean, 'iv', expectedIv, caseWrong.iv, 0, 'symbol').freeDiagnostic).toBeTypeOf('string');
    expect(cellInfoFor(dirty, 'iv', expectedIv, caseWrong.iv, 0, 'symbol').freeDiagnostic).toBeNull();
  });

  it('keeps paid reveals visible even mid-edit', () => {
    // Once spent, the hint is paid for and stays readable through every later
    // edit, including clearing the cell to retry.
    const ctx: HintCtx = { ...dirty, reveals: { 'iv.0.symbol': ['betalt hint'] } };
    const info = cellInfoFor(ctx, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol');
    expect(info.popupEntries.map((e) => e.text)).toContain('betalt hint');
  });

  it('orders free diagnostics before paid reveals', () => {
    const ctx: HintCtx = { ...clean, reveals: { 'iv.0.symbol': ['betalt hint'] } };
    const info = cellInfoFor(ctx, 'iv', expectedIv, caseWrong.iv, 0, 'symbol');
    expect(info.popupEntries[0]?.tone).toBe('misconception');
    expect(info.popupEntries.at(-1)?.tone).toBe('hint');
  });

  it('falls back to expectedIndex = studentIndex when the matcher finds no pairing', () => {
    // Documented limitation: correct for single-row sections, known-imperfect
    // for multi-row sections that reshuffle pairing. Must not be "fixed" here.
    const ctx: HintCtx = { ...clean, reveals: { 'iv.0.symbol': ['betalt hint'] } };
    const info = cellInfoFor(ctx, 'iv', expectedIv, undefined, 0, 'symbol');
    expect(info.popupEntries.map((e) => e.text)).toContain('betalt hint');
  });
});

describe('countSpendable', () => {
  const values: VariableTableValues = { iv: [{ name: '', symbol: 'x', unit: '' }], dv: [], constants: [] };
  const expected = { iv: expectedIv, dv: [], constants: [] };

  it('counts cells with a remaining ladder', () => {
    expect(countSpendable(clean, values, symbolWrong, expected)).toBe(1);
  });
  it('counts nothing mid-edit', () => {
    expect(countSpendable(dirty, values, symbolWrong, expected)).toBe(0);
  });
});

describe('resolveSpend', () => {
  it('returns the spend payload for a failing cell with a remaining tier', () => {
    const out = resolveSpend(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol');
    expect(out?.cellKey).toBe('iv.0.symbol');
    expect(out?.revealedText).toBeTypeOf('string');
    expect(out?.hintCap).toBeGreaterThan(0);
  });
  it('returns null for a cell with no error', () => {
    expect(resolveSpend(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'name')).toBeNull();
  });
  it('returns null once the ladder is exhausted', () => {
    const cap = cellInfoFor(clean, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol').cap;
    const capped: HintCtx = { ...clean, tiers: { 'iv.0.symbol': cap } };
    expect(resolveSpend(capped, 'iv', expectedIv, symbolWrong.iv, 0, 'symbol')).toBeNull();
  });
  it('returns null when there is no matcher pairing', () => {
    expect(resolveSpend(clean, 'iv', expectedIv, undefined, 0, 'symbol')).toBeNull();
  });
});

describe('missingMessagesFor', () => {
  const missing: CorrectnessReport = {
    iv: [
      { status: 'missing', expectedIndex: 0 },
      { status: 'missing', expectedIndex: 1 },
    ],
    dv: [],
  };
  const twoExpected = [{ symbol: 'h' }, { symbol: 't' }];

  it('caps output at one message per section', () => {
    // Deliberate anti-spam cap — two missing rows still yield one message.
    expect(missingMessagesFor(clean, 'iv', twoExpected, missing.iv, '{symbol} mangler')).toEqual(['h mangler']);
  });
  it('returns nothing mid-edit', () => {
    expect(missingMessagesFor(dirty, 'iv', twoExpected, missing.iv, '{symbol} mangler')).toEqual([]);
  });
  it('returns nothing without an expected array', () => {
    expect(missingMessagesFor(clean, 'iv', undefined, missing.iv, '{symbol} mangler')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableHints.test.ts
```

Expected: FAIL — cannot resolve `@/lab-guide/widgets/variableTableHints`.

- [ ] **Step 3: Create the module**

Create `src/lab-guide/widgets/variableTableHints.ts` with a module-purpose header:

```ts
// Pure hint resolution for VariableTable: per-cell ladder cap and next spendable
// tier, popup entries (free diagnostics + already-paid reveals), the live
// spendable-target count, spend-payload resolution, and missing-row messages.
// Paid reveals ignore the clean-section gate; everything else respects it.
```

1. Move `CellHintInfo` (288–300), `EMPTY_CELL_INFO` (302–307), `freeDiagnosticFor` (309–317) verbatim with their JSDoc.
2. Move `cellInfoFor` (743–811), replacing the closed-over `expected` / `tiers` / `reveals` / `sectionClean` with `ctx` fields. **`ctx.hasExpected` replaces the `expected === undefined` check** — do not re-derive it from the expected array's length, because an author can configure `expected` with empty section arrays.
3. Move the spendable-count loop (818–839) into `countSpendable`.
4. Move `onSpendCell`'s pure prefix (925–950) into `resolveSpend`, returning `{ cellKey, revealedText, hintCap }`. The `spendAndRevealVtTier` dispatch and `exitSpendMode()` call (951–959) stay in the component.
5. Move `missingMessagesFor` (846–871), preserving the one-per-section cap and its comment.

- [ ] **Step 4: Run the new test to verify it passes**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableHints.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update the component and fix the stale comment**

In `VariableTable.tsx`, build the context once per render and thread it:

```ts
const hintCtx: HintCtx = {
  hasExpected: expected !== undefined,
  tiers,
  reveals,
  sectionClean,
};
```

Rewrite `onSpendCell` to use `resolveSpend`:

```ts
const onSpendCell = (section: Section, studentIndex: number, cell: Cell) => {
  const sectionExpected =
    section === 'iv' ? ivExpectedArr : section === 'dv' ? dvExpectedArr : constantsExpectedArr;
  const matches =
    section === 'iv' ? errors?.iv : section === 'dv' ? errors?.dv : errors?.constants;
  const spend = resolveSpend(hintCtx, section, sectionExpected, matches, studentIndex, cell);
  if (spend === null) return;
  spendAndRevealVtTier({
    widgetId: id,
    cellKey: spend.cellKey,
    revealedText: spend.revealedText,
    hintCap: spend.hintCap,
  });
  // With HintLightbulb removed, the click-to-spend lives on the input
  // itself; spend mode must exit here instead of inside the lightbulb.
  exitSpendMode();
};
```

Update the `getInfo` props on all three `<RowGroupSection>` elements, the `spendableCount` derivation, and the three `missingMessagesFor` calls to pass `hintCtx`.

Then fix the now-stale cross-reference in `variableTableCorrectness.ts` line 621:

```ts
// before
//       `freeDiagnosticFor` in VariableTable.tsx) — drop it from the paid
// after
//       `freeDiagnosticFor` in variableTableHints.ts) — drop it from the paid
```

- [ ] **Step 6: Run the full suite and lint**

```sh
npm test -- --run
npm run lint
git diff --stat
```

Expected: all pass; none of the four oracle files in the diff.

- [ ] **Step 7: Commit**

```sh
git add src/lab-guide/widgets/variableTableHints.ts \
        src/lab-guide/widgets/VariableTable.tsx \
        src/lab-guide/widgets/variableTableCorrectness.ts \
        tests/unit/lab-guide/widgets/variableTableHints.test.ts
git commit -m "refactor(VariableTable): extract pure hint resolution

cellInfoFor, countSpendable, resolveSpend and missingMessagesFor now take
an explicit HintCtx instead of closing over component state. resolveSpend
returns a payload; the store dispatch and exitSpendMode stay in the
component. Also repoints a stale freeDiagnosticFor cross-reference in
variableTableCorrectness.ts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `useVariableTableUnlockSession.ts` — Field's unlock edit-session

**No new test file.** `VariableTable.lock.test.tsx` (648 lines) already drives all four unlock affordances — double-click, Enter, F2, and long-press — through the real component. Covering this hook directly would require `renderHook`, which is available but used nowhere in this repo; introducing it is a new testing pattern that needs maintainer sign-off (see Global Constraints).

**Files:**
- Create: `src/lab-guide/widgets/useVariableTableUnlockSession.ts`
- Modify: `src/lab-guide/widgets/VariableTable.tsx` (remove lines 1511–1608 from `Field`; call the hook)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export function useVariableTableUnlockSession(args: {
    id: string;
    locked: boolean;
    lockKey: string | null;
    value: string;
    onUnlock: (lockKey: string) => void;
  }): {
    isReadonlyRender: boolean;
    wrapperHandlers: {
      onDoubleClick: () => void;
      onKeyDown: (e: KeyboardEvent<HTMLSpanElement>) => void;
      onTouchStart: (e: TouchEvent<HTMLSpanElement>) => void;
      onTouchEnd: () => void;
      onTouchCancel: () => void;
      onTouchMove: () => void;
    };
    onInputBlur: (e: FocusEvent<HTMLInputElement>) => void;
  };
  ```

This is the first hook file inside `widgets/`. Existing hooks (`useRegisteredWidgetState`, `useRegisteredWidgetCheck`, `useRegisteredHintEligibility`) sit at `lab-guide/` root because they are framework-wide registries; this one is widget-specific, so it belongs beside its widget.

- [ ] **Step 1: Create the hook**

Create `src/lab-guide/widgets/useVariableTableUnlockSession.ts` with a module-purpose header:

```ts
// Unlock edit-session for a locked VariableTable cell. Opening a locked cell
// starts a transient session that renders it editable while the store lock
// entry stays in place; on blur the value is compared against the snapshot
// taken at session start, and only a real change commits the unlock. The lock
// key is snapshotted too, so an intervening edit that re-pairs this student row
// with a different expected row still clears the original entry.
import { type FocusEvent, type KeyboardEvent, type TouchEvent, useEffect, useRef, useState } from 'react';
```

Move lines **1511–1608** verbatim: the `editingUnlocked` state, `unlockSnapshotRef`, `isReadonlyRender` derivation, the focus-on-readonly→editable effect, the long-press timer + its cleanup effect, `clearPressTimer`, `startEditSession`, the six wrapper handlers, and `handleInputBlur`. Every comment in that range explains a non-obvious decision — keep all of them.

Return `{ isReadonlyRender, wrapperHandlers: { ... }, onInputBlur: handleInputBlur }`.

- [ ] **Step 2: Consume the hook in `Field`**

In `VariableTable.tsx`, replace the deleted block with:

```ts
const { isReadonlyRender, wrapperHandlers, onInputBlur } = useVariableTableUnlockSession({
  id,
  locked,
  lockKey,
  value,
  onUnlock,
});
```

Spread the handlers on the wrapper span (replacing the six explicit `on*` props at lines 1670–1675):

```tsx
<span
  className={/* unchanged */}
  tabIndex={isReadonlyRender ? 0 : undefined}
  role={isReadonlyRender ? 'button' : undefined}
  aria-label={/* unchanged */}
  {...wrapperHandlers}
>
```

And on the editable input, `onBlur={handleInputBlur}` becomes `onBlur={onInputBlur}`.

- [ ] **Step 3: Run the full suite and lint**

```sh
npm test -- --run
npm run lint
git diff --stat
```

Expected: all pass. `VariableTable.lock.test.tsx` is the oracle here — a failure means the session semantics changed. Pay attention to the net-zero-edit case (type, then backspace back to the original: the session must end silently with no store mutation).

- [ ] **Step 4: Commit**

```sh
git add src/lab-guide/widgets/useVariableTableUnlockSession.ts \
        src/lab-guide/widgets/VariableTable.tsx
git commit -m "refactor(VariableTable): extract Field's unlock edit-session hook

Moves the session state, value+lockKey snapshot, focus-on-transition
effect, long-press timer and blur commit into
useVariableTableUnlockSession. Covered by the existing lock test suite; no
renderHook introduced.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `VariableTableField.tsx` — the cell component

**Files:**
- Create: `src/lab-guide/widgets/VariableTableField.tsx`
- Create: `tests/unit/lab-guide/widgets/variableTableFlashClasses.test.ts`
- Modify: `src/lab-guide/widgets/VariableTable.tsx` (remove lines 1406–1740)

**Interfaces:**
- Consumes: `useVariableTableUnlockSession` (Task 5), `CellHintInfo` from `./variableTableHints` (Task 4).
- Produces:
  ```ts
  export interface FieldProps { /* moved verbatim from lines 1406–1445 */ }
  export function Field(props: FieldProps): JSX.Element;

  export function flashClasses(
    flash: 'correct' | 'wrong' | null,
    flashWithTransition: boolean,
    locked: boolean,
  ): { flashClass: string; inputFlashClass: string };
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lab-guide/widgets/variableTableFlashClasses.test.ts`:

```ts
// @vitest-environment node
// Pure-helper unit tests for flashClasses. The class names here are
// load-bearing: `animate-vt-flash-fade` and `animate-vt-flash-fade-to-white`
// are keyframe utilities defined in globals.css, and a typo is invisible to
// both the type checker and the component tests.
import { flashClasses } from '@/lab-guide/widgets/VariableTableField';
import { describe, expect, it } from 'vitest';

describe('flashClasses', () => {
  it('is transparent with no animation between Tjeks', () => {
    expect(flashClasses(null, true, false)).toEqual({
      flashClass: 'rounded bg-transparent',
      inputFlashClass: '',
    });
  });

  it('fades emerald to transparent on a newly locked cell', () => {
    const { flashClass } = flashClasses('correct', true, true);
    expect(flashClass).toContain('bg-emerald-100');
    expect(flashClass).toContain('animate-vt-flash-fade');
    expect(flashClass).not.toContain('animate-vt-flash-fade-to-white');
  });

  it('fades rose to white on a wrong cell', () => {
    // The editable input regains bg-white when the flash clears, so the
    // wrapper must fade to white rather than transparent.
    const { flashClass } = flashClasses('wrong', true, false);
    expect(flashClass).toContain('bg-rose-100');
    expect(flashClass).toContain('animate-vt-flash-fade-to-white');
  });

  it('omits the keyframe under reduced motion but keeps the colour', () => {
    const { flashClass } = flashClasses('correct', false, true);
    expect(flashClass).toContain('bg-emerald-100');
    expect(flashClass).not.toContain('animate-');
  });

  it('forces an unlocked input transparent during a rose flash', () => {
    // ProtectedInput hardcodes bg-white, which would cover the wrapper's flash.
    expect(flashClasses('wrong', true, false).inputFlashClass).toBe(' !bg-transparent');
  });

  it('leaves a locked input alone during a flash', () => {
    // The locked branch's input is already bg-transparent.
    expect(flashClasses('wrong', true, true).inputFlashClass).toBe('');
    expect(flashClasses('correct', true, false).inputFlashClass).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableFlashClasses.test.ts
```

Expected: FAIL — cannot resolve `@/lab-guide/widgets/VariableTableField`.

- [ ] **Step 3: Create the component file**

Create `src/lab-guide/widgets/VariableTableField.tsx` with a module-purpose header:

```ts
// One VariableTable cell: renders either a locked readonly input wrapped in an
// unlock-affordance span, or an editable ProtectedInput inside a HintPopup.
// Owns the spend-on-click/Enter dance and the per-Tjek flash classes; the
// unlock session lives in useVariableTableUnlockSession.
```

1. Move `FieldProps` (1406–1445) and `Field` (1447–1740) verbatim, exporting both.
2. Extract lines **1619–1641** into an exported `flashClasses(flash, flashWithTransition, locked)` returning `{ flashClass, inputFlashClass }`. Keep all three explanatory comments — they document why emerald fades to transparent, why rose fades to white, and why a static `!bg-rose-100` on the input would *defeat* the animation.
3. In `Field`, replace the inline computation with `const { flashClass, inputFlashClass } = flashClasses(flash, flashWithTransition, locked);`.

**Do not change** the `document.getElementById(id)` focus calls (1494, 1504–1506) to refs. They depend on the `id` prop matching the rendered input's DOM id, and converting them is a behavior risk outside this plan's scope.

- [ ] **Step 4: Run the new test to verify it passes**

```sh
npm test -- --run tests/unit/lab-guide/widgets/variableTableFlashClasses.test.ts
```

Expected: PASS.

- [ ] **Step 5: Import `Field` in `VariableTable.tsx`**

`RepeatableRow` (still in `VariableTable.tsx` until Task 7) needs `import { Field } from './VariableTableField';`. Remove any imports the deleted `Field` body left orphaned — Biome will name them.

- [ ] **Step 6: Run the full suite and lint**

```sh
npm test -- --run
npm run lint
git diff --stat
```

Expected: all pass; none of the four oracle files in the diff.

- [ ] **Step 7: Commit**

```sh
git add src/lab-guide/widgets/VariableTableField.tsx \
        src/lab-guide/widgets/VariableTable.tsx \
        tests/unit/lab-guide/widgets/variableTableFlashClasses.test.ts
git commit -m "refactor(VariableTable): extract the Field cell component

Moves FieldProps and Field into VariableTableField.tsx and pulls the flash
class computation out as a pure, directly tested flashClasses helper — the
keyframe utility names are load-bearing and previously untested.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `VariableTableRows.tsx` — section and row components

Pure motion. No new test file: `VariableTable.test.tsx` renders these through the real widget, covering add/remove affordances, the empty state, missing-message lists, and the grid layout.

**Files:**
- Create: `src/lab-guide/widgets/VariableTableRows.tsx`
- Modify: `src/lab-guide/widgets/VariableTable.tsx` (remove lines 1129–1404)

**Interfaces:**
- Consumes: `Field` from `./VariableTableField` (Task 6); `CellHintInfo` from `./variableTableHints` (Task 4); `VariableEntry`, `Bounds`, `Section` from `./variableTableValues` (Task 1); `Cell` from `./variableTableCorrectness`.
- Produces:
  ```ts
  export interface RowGroupProps { /* moved verbatim from lines 1129–1165 */ }
  export function RowGroupSection(props: RowGroupProps): JSX.Element;
  export interface RepeatableRowProps { /* moved verbatim from lines 1271–1298 */ }
  export function RepeatableRow(props: RepeatableRowProps): JSX.Element;
  ```
  `RepeatableRow` is exported for symmetry and testability even though only `RowGroupSection` consumes it.

- [ ] **Step 1: Create the file**

Create `src/lab-guide/widgets/VariableTableRows.tsx` with a module-purpose header:

```ts
// One VariableTable section (heading, rows, empty state, missing-row messages,
// add affordance) and one repeatable row (three Fields plus the remove button
// on a shared grid template, so every row lines up under the single header
// band).
```

Move lines **1129–1404** verbatim: `RowGroupProps`, `RowGroupSection`, `RepeatableRowProps`, `RepeatableRow`. Export all four.

Preserve exactly:
- The `// biome-ignore lint/suspicious/noArrayIndexKey` directive at line 1205 with its reason comment. Removing it breaks lint; rewording it loses the rationale (row position *is* row identity in this section).
- The grid template string at line 1334 and the comment above it explaining the reserved remove-button gutter.
- The `rowAria` helper and the comment explaining why every input needs a programmatic label (the visible label is mobile-only and the desktop header band is `aria-hidden`).

`format` comes from `../strings.da`.

- [ ] **Step 2: Import in `VariableTable.tsx`**

Add `import { RowGroupSection } from './VariableTableRows';` and remove imports the deleted bodies orphaned (likely `format`, `ReactNode`, `Bounds`, `VariableEntry` — Biome will name them).

- [ ] **Step 3: Run the full suite and lint**

```sh
npm test -- --run
npm run lint
git diff --stat
```

Expected: all pass; none of the four oracle files in the diff.

- [ ] **Step 4: Verify the size goal is met**

```sh
wc -l src/lab-guide/widgets/VariableTable*.tsx \
      src/lab-guide/widgets/variableTable*.ts \
      src/lab-guide/widgets/useVariableTableUnlockSession.ts
```

Expected: `VariableTable.tsx` ≈ 640 (down from 1786); every other new file under ~300; `variableTableCorrectness.ts` still 671. If `VariableTable.tsx` is materially over ~700, stop and report — something did not move.

- [ ] **Step 5: Commit**

```sh
git add src/lab-guide/widgets/VariableTableRows.tsx \
        src/lab-guide/widgets/VariableTable.tsx
git commit -m "refactor(VariableTable): extract section and row components

Moves RowGroupSection and RepeatableRow into VariableTableRows.tsx.
VariableTable.tsx is now ~640 lines, down from 1786. Pure motion, covered
by the existing component test suite.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Final verification and documentation sync

**Files:**
- Modify: `src/lab-guide/CLAUDE.md` (document the new module layout)
- Modify: `docs/STATUS.md` (record the landed work)
- Modify: `docs/BACKLOG.md` (only if bugs were noticed and deferred during Tasks 1–7)

- [ ] **Step 1: Confirm the oracle files are untouched across the whole branch**

```sh
git diff --stat main -- tests/unit/lab-guide/widgets/VariableTable.test.tsx \
                        tests/unit/lab-guide/widgets/VariableTable.lock.test.tsx \
                        tests/unit/lab-guide/widgets/VariableTable.tjek.test.tsx \
                        tests/unit/lab-guide/widgets/variableTableCorrectness.test.ts
```

Expected: **empty output.** This is the plan's primary success criterion. Non-empty output means behavior changed somewhere — investigate before going further.

- [ ] **Step 2: Full verification**

```sh
npm run verify
```

Expected: lint clean, all tests pass (271+ existing plus the new pure-module tests), production build succeeds.

- [ ] **Step 3: Manual check in the browser**

```sh
npm run dev
```

Exercise both testlabs — `testlabs/template` phase 1 (`planlaeg`) and `testlabs/variable-table-test/flerdimensional`:

- Tjek with a correct answer → cell locks, flashes emerald, renders as plain text.
- Tjek with a wrong answer → cell stays editable, flashes rose.
- Tjek with an empty cell → no flash, no lock.
- Unlock all three ways: double-click, Enter (and F2) on a focused locked cell, and a 500 ms long-press. Focus must land on the freshly-editable input each time.
- Net-zero edit: unlock, type, backspace to the original value, blur → the cell must stay locked (no re-flash on the next Tjek).
- Arm the hint bucket → failing cells paint an amber border; click one → a token is spent, the popup opens with the revealed tier, spend mode exits.
- Idle cell with popup content shows the small amber dot; the pip cluster grows on focus-within.
- Add and remove constant rows; check the empty-state copy at zero rows.
- The `Næste fase` footer button drives Tjek on the template lab (`checkInFooter`), including its dimmed tooltip.

The flash keyframes and pip animations are the parts no test covers — they depend on `animate-vt-flash-fade` / `animate-vt-flash-fade-to-white` in `globals.css`.

- [ ] **Step 4: Update `src/lab-guide/CLAUDE.md`**

Add to the **VariableTable** area of the "Widget conventions" section:

```markdown
- **VariableTable module layout**: `<VariableTable>` is split across flat siblings in
  `widgets/` — `VariableTable.tsx` (props + orchestrator + in-widget Tjek button),
  `VariableTableRows.tsx` (section + row), `VariableTableField.tsx` (one cell +
  `flashClasses`), and four pure logic modules: `variableTableValues.ts` (shared types,
  bounds, value rehydration), `variableTableLocks.ts` (lock resolution),
  `variableTableTjek.ts` (Tjek lock-diff + dim reason), `variableTableHints.ts` (hint
  ladders, spendable count, missing-row messages). `variableTableCorrectness.ts` remains
  the matcher. The shared types (`VariableEntry`, `VariableTableValues`, `SectionConfig`)
  live in `variableTableValues.ts` and are re-exported from `VariableTable.tsx`, which
  stays the widget's public entry point. `useVariableTableUnlockSession.ts` is the one
  hook inside `widgets/` — widget-specific, unlike the framework registries at
  `lab-guide/` root. Pure modules take component state as explicit parameters
  (`locks`, `errors`, `HintCtx`) rather than closing over it, which is what makes them
  directly unit-testable.
```

This is required by the repo convention: a change that introduces a new pattern updates the matching `CLAUDE.md` in the same commit. The widget-specific hook inside `widgets/` is that new pattern.

- [ ] **Step 5: Update `docs/STATUS.md`**

Add a "Recently landed" entry under **Current focus**, matching the existing entry style (bold lead, date, what changed, what verified it). State the before/after line counts, that the four test files are byte-identical, and that the type-only import cycle between `VariableTable.tsx` and `variableTableCorrectness.ts` is gone. Update the `_Last synced:_` line at the top.

- [ ] **Step 6: Record anything deferred**

If Tasks 1–7 surfaced bugs or smells that were deliberately not fixed, add them to `docs/BACKLOG.md` under **Widgets** or **Framework**, each as a short heading plus a one-line `**Why:**` rationale (the format that file documents). Candidates already known and intentionally left alone:

- `evaluateRowGroup` in `variableTableCorrectness.ts` is ~186 lines — the one long function in an otherwise well-decomposed module.
- `RubricResponse.tsx` is 855 lines with the same structure as pre-split `VariableTable.tsx`; the hint plumbing extracted here may shrink that job.
- `R-B1` (extract widget-registration hook) is now easier to design — the `registerWidgetState` + `setTick` dance is isolated.

If nothing was deferred, skip this step and say so.

- [ ] **Step 7: Commit**

```sh
git add src/lab-guide/CLAUDE.md docs/STATUS.md docs/BACKLOG.md
git commit -m "docs: record VariableTable module layout and landed split

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Report, do not merge or push**

Summarize for the maintainer: per-file line counts before and after, confirmation that the four oracle test files are byte-identical, the new tests added, `npm run verify` output, and the manual-check result.

**Do not merge to `main` and do not push.** Pushing `main` triggers the live GitHub Pages deploy. The merge decision is the maintainer's — `superpowers:finishing-a-development-branch` covers it when they are ready.

---

## Self-Review

**1. Spec coverage.** Every spec section maps to a task:

| Spec section | Task |
|---|---|
| `variableTableValues.ts` contract | 1 |
| Type re-exports + cycle break | 1 |
| `variableTableLocks.ts` contract | 2 |
| `variableTableTjek.ts` contract | 3 |
| `variableTableHints.ts` contract | 4 |
| `useVariableTableUnlockSession.ts` contract | 5 |
| `VariableTableField.tsx` + `flashClasses` | 6 |
| `VariableTableRows.tsx` | 7 |
| Verification (per-step + final + manual) | every task; 8 |
| Risk: closure→parameter conversion | 2, 3, 4 (explicit param lists) |
| Risk: `hasExpected` threaded not re-derived | 4, Step 3 item 2 |
| Risk: two documented limitations survive | 4 (preamble + two tests) |
| Risk: `useRegisteredWidgetState` dep array | see note below |
| Risk: `getElementById` focus calls | 6, Step 3 |
| Risk: flash CSS class names | 6 (dedicated test) + 8 (manual) |

**Deviation from the spec, deliberate:** the spec listed new unit tests as a single deferred step 8. This plan folds each module's tests into its own extraction task instead. Rationale: the skill's task-right-sizing rule (fold scaffolding into the task whose deliverable needs it), and each task then ends with an independently testable deliverable. The spec's step 8 becomes documentation sync. No coverage is lost — it moves earlier.

**Gap found and closed:** the spec named "`useRegisteredWidgetState` dep array must stay identical" as a risk, but no task touched lines 551–568, so no task mentioned it. Those lines stay in `VariableTable.tsx` untouched through all seven tasks — which satisfies the risk by construction. Recorded here so a task implementer who sees the `JSON.stringify` deps and the deliberately redundant `errors` key does not "tidy" them.

**2. Placeholder scan.** No "TBD", "TODO", "implement later", or "similar to Task N". Every code step has a real code block or a precise verbatim-move instruction with exact line ranges. Task 8 Step 6 is conditional ("if bugs were noticed") rather than a placeholder — it names the three known candidates.

**3. Type consistency.** Checked across tasks:
- `Section` defined in Task 1, used in Tasks 2, 3, 4.
- `Locks` defined in Task 2; Task 3's `computeTjekOutcome` takes the same shape inline as `locks: Record<string, boolean>` — consistent, though not the alias. Acceptable: Task 3 does not import from Task 2.
- `SectionExpected` defined in Task 3, reused in Task 4. Tasks 1 and 2 predate it and spell the shape inline, which is correct given the dependency order.
- `CellHintInfo` defined in Task 4, consumed in Tasks 6 and 7.
- `cellKey` naming is stable throughout; `resolveSpend` returns a field named `cellKey` (a string), which shadows the function name at the call site but does not collide — the component destructures it as `spend.cellKey`.
- `flashClasses` is the same name in Task 6's test, module, and consumer.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-04-variabletable-split.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration. Well suited here: the tasks are sequential with clean interfaces, and each ends with a green suite, so a fresh reviewer can gate each one.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.
