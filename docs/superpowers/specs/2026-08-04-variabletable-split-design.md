# VariableTable split — design

_2026-08-04. Behavior-preserving restructure of `src/lab-guide/widgets/VariableTable.tsx`._

## Goal

Split the 1786-line `VariableTable.tsx` into modules no larger than ~500 lines, so that
a reader (human or AI) can hold any one of them in context at once. Extract the pure
logic into independently unit-testable sibling modules.

**Success criterion:** `npm run verify` passes, and the four existing test files
(2688 lines) are **byte-identical** to their pre-refactor state. Any test that needs
editing is evidence we changed behavior — a bug, not a judgment call.

## Non-goals

Explicitly out of scope. Each of these is a defensible piece of work; none belongs here.

- **No behavior change.** Not one student-visible difference. No bug fixes, even for
  bugs noticed in passing — those get written down, not fixed.
- **No `variableTableCorrectness.ts` restructure.** 671 lines, but ~40 small pure
  exports with clear names. Cohesive, not tangled. Its one long function
  (`evaluateRowGroup`, lines 376–562) could use a look; that is a separate job.
- **No `RubricResponse.tsx` work.** 855 lines, same disease. Out of scope. Noted
  because the pattern recurs and the hint plumbing extracted here may shrink that job.
- **No BACKLOG debt folded in.** Specifically not `R-B1` (extract widget-registration
  hook). `R-B1` is a cross-widget abstraction; designing it while staring at one widget
  produces an abstraction that fits one caller. Revisit after this lands, with the
  registration dance isolated in a named module.
- **No collapsing the three `<RowGroupSection>` calls** into a `.map()` over a config
  array. Would cut ~98 lines to ~35, but trades grep-ability for brevity in a file a
  colleague has to read.

## Current state

`VariableTable.tsx` is not uniformly bloated. Two functions carry it.

| Region | Lines | Count |
|---|---|---|
| types + `Props` | 83–176 | ~95 |
| pure helpers | 177–342 | ~165 |
| **`VariableTable`** | **343–1128** | **785** |
| `RowGroupSection` | 1129–1270 | ~140 |
| `RepeatableRow` | 1271–1405 | ~135 |
| **`Field`** | **1406–1745** | **340** |
| `InWidgetTjekButton` | 1746–1786 | ~40 |

Separable units inside them:

| Concern | Lines | Nature |
|---|---|---|
| value/bounds plumbing | 177–286 | already pure |
| lock model | 444–546 | pure fns of `(locks, errors)` |
| Tjek lock-diff (inside `handleTjek`) | 634–689 | pure |
| Tjek-dim derivation | 603–616 | pure |
| hint resolution (`cellInfoFor`, spendable count, spend resolution) | 730–844, 925–960 | pure + one dispatch |
| missing-row messages | 846–871 | pure |
| unlock edit-session (in `Field`) | 1511–1608 | custom hook |
| flash class computation (in `Field`) | 1610–1641 | pure string fn |

### Existing type-only import cycle

`VariableTable.tsx` imports 10 symbols from `variableTableCorrectness.ts`;
`variableTableCorrectness.ts` imports `type VariableEntry` back from `VariableTable.tsx`
(line 41). Type-only, so it erases at runtime and nothing breaks today — but it is a real
cycle. Moving the shared types into `variableTableValues.ts` breaks it as a side effect
of the extraction.

### Layout convention

`src/lab-guide/widgets/` is flat: 17 files, zero subdirectories. The precedent for
"widget plus its logic" already exists as flat siblings — `VariableTable.tsx` +
`variableTableCorrectness.ts`. New modules follow it. No subdirectory is introduced.

A `widgets/VariableTable/` folder was considered. It gives nicer names
(`VariableTable/locks.ts`) and `./VariableTable` would resolve to the folder index, so
importers wouldn't change. Rejected: `variableTableCorrectness.ts` is imported directly
by several outside files, so it either stays outside the folder (incoherent) or those
imports churn anyway — and the folder is a new pattern in a flat directory.

## Target layout

All files in `src/lab-guide/widgets/`. Line counts are estimates.

| File | Est. | Contents |
|---|---|---|
| `VariableTable.tsx` | ~640 | `Props`, `VariableTable` orchestrator, `InWidgetTjekButton`, `prefersReducedMotion`, type re-exports |
| `VariableTableRows.tsx` | ~280 | `RowGroupProps`, `RowGroupSection`, `RepeatableRowProps`, `RepeatableRow` |
| `VariableTableField.tsx` | ~200 | `FieldProps`, `Field`, `flashClasses` |
| `variableTableHints.ts` | ~150 | `CellHintInfo`, `EMPTY_CELL_INFO`, `freeDiagnosticFor`, `cellInfoFor`, `countSpendable`, `resolveSpend`, `missingMessagesFor` |
| `variableTableValues.ts` | ~110 | shared types, `EMPTY`, `CELLS`, bounds defaults, `cellKey`, `resolveBounds`, `emptyRows`, `readRows`, `readValues`, `entryFilled`, `entryEmpty`, `sectionFilled`, `valuesEqual`, `clampExpected`, `warnMalformed` |
| `variableTableLocks.ts` | ~110 | `cellLockedAndCorrect`, `cellLockedForStudent`, `lockKeyForStudent`, `sectionFullyLockedCorrect` |
| `useVariableTableUnlockSession.ts` | ~100 | the unlock edit-session hook |
| `variableTableTjek.ts` | ~60 | `FlashPayload`, `TjekDimReason`, `computeTjekOutcome`, `deriveTjekDimReason` |
| `variableTableCorrectness.ts` | 671 | **unchanged** except its `VariableEntry` import is repointed |

Every file starts with one `//` module-purpose line (repo convention).

`VariableTable.tsx` stays the largest at ~640 — a 64% reduction, and the residue is
irreducible without changes this spec rules out: ~95 lines are the `Props` interface (24
author-override props, each documented, per SPEC §17), and ~98 are the three
`<RowGroupSection>` call sites we are deliberately not collapsing. The orchestrator body
itself lands around ~350. Every other file is under ~300.

`Section` lives in `variableTableValues.ts` while `Cell` stays in
`variableTableCorrectness.ts`. Deliberate: `Cell` is a correctness concept, `Section` is a
layout/values concept. Do not consolidate them.

`useVariableTableUnlockSession.ts` is the first hook file inside `widgets/` — existing
hooks (`useRegisteredWidgetState`, etc.) sit at `lab-guide/` root because they are
framework-wide registries. This one is widget-specific, so it belongs beside its widget.
Named with the `variableTable`-prefix convention rather than a short `useVtUnlockSession`,
for consistency with the sibling modules.

## Module contracts

Functions that currently close over `locks`, `errors`, `tiers`, `reveals`, and
`sectionClean` take them as explicit parameters. No factory/closure wrapper — explicit
params are plainer and directly testable.

### `variableTableValues.ts`

Moves lines 83–100 and 177–286 verbatim. Adds one named type for the section union,
currently inlined as `'iv' | 'dv' | 'constants'` in ~20 signatures:

```ts
export type Section = 'iv' | 'dv' | 'constants';
export interface VariableEntry { name: string; symbol: string; unit: string }
export interface VariableTableValues { iv: VariableEntry[]; dv: VariableEntry[]; constants: VariableEntry[] }
export type SectionConfig = { count: number } | { min: number; max: number };
export interface Bounds { min: number; max: number }
```

`Bounds` becomes exported (currently module-private) because `VariableTableRows.tsx`
needs it.

### `variableTableLocks.ts`

```ts
type Locks = Record<string, boolean>;

cellLockedAndCorrect(locks: Locks, errors: CorrectnessReport | undefined,
  section: Section, expectedIndex: number, cell: Cell): boolean

cellLockedForStudent(locks: Locks, errors: CorrectnessReport | undefined,
  section: Section, studentIndex: number, cell: Cell): boolean

lockKeyForStudent(locks: Locks, errors: CorrectnessReport | undefined,
  section: Section, studentIndex: number, cell: Cell): string | null

sectionFullyLockedCorrect(locks: Locks, errors: CorrectnessReport | undefined,
  section: Section,
  sectionExpected: ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>,
): { covered: boolean; configured: number }
```

The `correct` / `sections` aggregation (lines 521–546) stays in the component — it reads
props (`expected`, `constantsConfig`) and the `filled` derivation, so extracting it would
mean threading most of the component's state through a second signature.

### `variableTableTjek.ts`

```ts
export interface FlashPayload {
  keys: Record<string, 'correct' | 'wrong'>;
  nonce: number;
  withTransition: boolean;
}
export type TjekDimReason = 'empty' | 'clean' | null;

computeTjekOutcome(input: {
  values: VariableTableValues;
  errors: CorrectnessReport;
  expected: Record<Section, ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>>;
  locks: Record<string, boolean>;
}): {
  newlyLocked: string[];
  newlyUnlocked: string[];
  flashKeys: Record<string, 'correct' | 'wrong'>;
}

deriveTjekDimReason(
  values: VariableTableValues,
  sectionChecked: Record<Section, boolean>,
  lastCheckedExists: boolean,
  hasExpected: boolean,
): TjekDimReason
```

`prefersReducedMotion()` (lines 338–341) **stays in `VariableTable.tsx`.** It reads
`window.matchMedia`; keeping it out preserves this module as 100% pure. `handleTjek`
reduces to: dim guard → `setVariableTableLastChecked` → `computeTjekOutcome` →
`lockVtCells` / `unlockVtCell` → `setFlash` with the timer.

Dim-tooltip resolution stays in the component (it reads `strings.da`); only the reason
is derived here.

### `variableTableHints.ts`

The shared read-only context becomes one explicit parameter:

```ts
export interface HintCtx {
  hasExpected: boolean;
  tiers: Record<string, number>;
  reveals: Record<string, string[]>;
  sectionClean: Record<Section, boolean>;
}

cellInfoFor(ctx: HintCtx, section: Section,
  sectionExpected: ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>,
  matches: RowMatch[] | undefined, studentIndex: number, cell: Cell): CellHintInfo

countSpendable(ctx: HintCtx, values: VariableTableValues,
  errors: CorrectnessReport,
  expected: Record<Section, ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>>): number

resolveSpend(ctx: HintCtx, section: Section,
  sectionExpected: ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }> | undefined,
  matches: RowMatch[] | undefined, studentIndex: number, cell: Cell,
): { cellKey: string; revealedText: string; hintCap: number } | null

missingMessagesFor(ctx: HintCtx, section: Section,
  sectionExpected: ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }> | undefined,
  matches: RowMatch[] | undefined, template: string): string[]
```

`resolveSpend` returns the payload; the component dispatches `spendAndRevealVtTier` and
calls `exitSpendMode`. Both side effects stay in the component.

### `useVariableTableUnlockSession.ts`

Moves lines 1511–1608 (the `editingUnlocked` state, `unlockSnapshotRef`,
focus-on-readonly-transition effect, long-press timer + cleanup, wrapper handlers, blur
commit).

```ts
useVariableTableUnlockSession(args: {
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
}
```

### Type re-exports

`VariableTable.tsx` re-exports the moved types so its public surface is unchanged:

```ts
export type { VariableEntry, VariableTableValues, SectionConfig } from './variableTableValues';
```

Seven files import these types. Six keep working untouched — including both affected test
files. The seventh, `variableTableCorrectness.ts`, is repointed from `./VariableTable` to
`./variableTableValues`, which breaks the cycle.

Repointing the five `src/` consumers (`runner.ts`, `RunnerContext.tsx`,
`runnerReducer.ts`, `TemplateHypothesisSection.tsx`) directly at `variableTableValues` is
an optional follow-up, not part of this work.

## Execution order

Bottom-up, leaves first. Each step ends with the full existing suite green, so a
regression is attributable to one step.

1. `variableTableValues.ts` — move types + pure helpers; repoint
   `variableTableCorrectness.ts`; add re-exports.
2. `variableTableLocks.ts` — closures to explicit params.
3. `variableTableTjek.ts` — `computeTjekOutcome` + `deriveTjekDimReason`.
4. `variableTableHints.ts` — `HintCtx` + the four functions.
5. `useVariableTableUnlockSession.ts` — hook extraction.
6. `VariableTableField.tsx` — `Field` + `flashClasses`, consuming the hook.
7. `VariableTableRows.tsx` — `RowGroupSection` + `RepeatableRow`.
8. New unit tests for the extracted pure modules.

Steps 1–7 are pure motion: no new tests, existing suite as the oracle. Step 8 is the only
step that adds test files.

## Verification

- **Per step:** `npm test -- --run` green; the four existing VariableTable/correctness
  test files unchanged (`git diff --stat` shows them absent).
- **Per step:** `npm run lint` clean — catches orphaned imports from the motion, and any
  re-export Biome dislikes.
- **Final:** `npm run verify` (lint + tests + build) clean.
- **Final:** `git diff --stat` confirms zero changes under `tests/unit/lab-guide/widgets/`
  for the four pre-existing files.
- **Manual:** the template lab's `planlaeg` phase and
  `testlabs/variable-table-test/flerdimensional` exercised in `npm run dev` — Tjek,
  emerald/rose flash, lock, all three unlock affordances (double-click, Enter/F2,
  long-press), hint spend, popup.

Test coverage before the refactor: 2688 lines across `VariableTable.test.tsx` (668),
`VariableTable.lock.test.tsx` (648), `VariableTable.tjek.test.tsx` (685),
`variableTableCorrectness.test.ts` (687).

## Risks

**Closure-to-parameter conversion.** The largest real risk. Functions that captured
`locks` / `errors` / `tiers` / `reveals` / `sectionClean` now receive them, so a wrong
argument compiles but misbehaves. Mitigation: the lock and Tjek paths are the most
heavily tested in the widget (648 + 685 lines), and the conversion is per-step verified.

**`hasExpected` must be threaded, not re-derived.** `cellInfoFor` and `sectionClean` both
branch on `expected !== undefined`. In the extracted modules that is `ctx.hasExpected`.
Re-deriving it from a truthiness check on the expected *array* is wrong — an author can
set `expected` with empty section arrays.

**Two documented limitations must survive verbatim.** Both look like bugs and are not:
- `cellInfoFor`'s `expectedIndex = studentIndex` fallback (line 762) when the matcher
  finds no pairing — correct for single-row sections, a known limitation for multi-row.
- `missingMessagesFor`'s one-message-per-section cap (line 868).

**`useRegisteredWidgetState` dep array must stay identical.** Lines 556–568 include
`JSON.stringify` deps and a deliberately redundant `errors` key with a comment explaining
why. Copy it unchanged.

**`Field`'s focus calls are `document.getElementById(id)`-based**, not ref-based (lines
1494, 1504–1506, 1537). Moving `Field` to another file does not affect them, but they
depend on the `id` prop matching the rendered input's DOM id — do not "improve" them to
refs as part of the move.

**Flash CSS depends on class names in `globals.css`** (`animate-vt-flash-fade`,
`animate-vt-flash-fade-to-white`). `flashClasses` builds these as strings; a typo is
invisible to the type checker and to most tests. Covered by the manual check.
