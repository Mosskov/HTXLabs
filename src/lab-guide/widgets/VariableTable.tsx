// Student-facing variable identification widget: three sections (IV, DV,
// constants), each independently configurable. By default IV and DV are
// single fixed rows and constants are 0..∞ student-added rows; authors can
// override per-section with `{ count: N }` for a fixed row count, or
// `{ min, max }` to let the student pick. The widget registers a `filled`
// widget state whenever every visible IV/DV cell is non-empty (and unit
// cells too when `requireUnits` is true), the row-count for each section
// falls in `[min, max]`, and — when the author set the `constants` prop —
// every visible constant row is filled.
//
// The `values` facet on the registration publishes a uniform array shape
// `{ iv: VariableEntry[], dv: VariableEntry[], constants: VariableEntry[] }`
// so sibling widgets (e.g. the template's hypothesis section) can read it
// the same way regardless of section count. Gate evaluators ignore `values`.
//
// Optional `expected` prop opts in to correctness checking + the Tjek flow.
// Lock model: clicking Tjek is the *event* that commits correctness. For
// every configured (`expectedRow[cell]` defined) cell:
//   - correct + filled → cell locks into a `readOnly` input styled as plain
//     text and flashes emerald for 1.5s. Unlock via double-click, Enter/F2 on
//     focus, or a 500ms long-press; the previously-rendered editable input
//     takes focus on unlock so a keyboard student can resume typing.
//   - wrong + filled → cell stays editable and flashes rose for 1.5s.
//   - empty → ignored (no flash, no lock).
// The widget publishes `correct: true` iff every configured expected cell is
// locked AND its current `RowMatch` still reports the cell correct (so a
// removed-then-readded-with-wrong-values row never silently resurrects the
// gate from a stale lock entry). The `sections` facet follows the same rule
// per section. Locks live in `RunnerState.variableTableLocks` keyed by
// `${section}.${expectedIndex}.${cell}` — expected-row identity, the same
// scheme `variableTableHintTiers` / `variableTableHintReveals` use — so
// multi-row sections entered in any order pair the same way across all
// three slices. The matcher implementation lives in
// `variableTableCorrectness.ts`.
//
// Hint system: when `expected` is set, the widget participates in the
// request-driven hint system. Auto-bump on Tjek is gone — students arm spend
// mode via the bucket. While armed, every failing cell with a remaining ladder
// gets a faint amber border + becomes the spend target itself (click or Enter
// to spend, which exits spend mode and re-focuses the cell so the popup opens
// against the freshly-revealed tier). When idle, a small amber dot sits at the
// input's top-right corner whenever the popup will open on focus (paid reveals
// or live free diagnostics). Locked cells carry no hint chrome — no armed
// border, no idle dot, no popup. Free diagnostics (case-mismatch + whitespace-
// internal) appear in the focus popup without a token cost, gated on the same
// checked-and-not-dirty rule as paid hints.
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHintSpend } from '../HintSpendContext';
import { useRunner } from '../RunnerContext';
import { Tooltip } from '../Tooltip';
import { format, strings } from '../strings.da';
import { useRegisteredHintEligibility } from '../useRegisteredHintEligibility';
import { useRegisteredWidgetCheck } from '../useRegisteredWidgetCheck';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import type { WidgetCheck } from '../widgetCheck';
import { HintBucket } from './HintBucket';
import { HintPopup, type HintPopupEntry } from './HintPopup';
import { ProtectedInput } from './ProtectedInput';
import {
  type Cell,
  type CellError,
  type CellSpec,
  type CorrectnessReport,
  type ExpectedVariables,
  type RowMatch,
  type VariableRowErrors,
  asExpectedArray,
  cellAcceptedValues,
  evaluateTable,
  maxTierForCell,
  resolveLadder,
} from './variableTableCorrectness';

export interface VariableEntry {
  name: string;
  symbol: string;
  unit: string;
}

export interface VariableTableValues {
  iv: VariableEntry[];
  dv: VariableEntry[];
  constants: VariableEntry[];
}

export type SectionConfig = { count: number } | { min: number; max: number };

interface Bounds {
  min: number;
  max: number;
}

interface Props {
  id: string;
  /** When true, the `unit` cell on every visible IV and DV row must be filled
   *  for the widget to report `filled: true`. Constants ignore this flag.
   *  Default `false` because not all lab theories teach specific units. */
  requireUnits?: boolean;
  /** Optional author-supplied answer key. When set, the widget computes a
   *  `correct: boolean` + structured `errors` payload (in addition to the
   *  default `filled` bit) so an `all-validated` gate can require correct
   *  answers. `iv` / `dv` accept a single object or an array; constants is
   *  always an array. Each cell in each expected entry is independently
   *  optional — the author validates only what they care about. */
  expected?: ExpectedVariables;
  /** Per-section row-count config. Omit to keep today's behaviour: IV/DV are
   *  exactly one fixed row, constants are 0..∞ student-added. `{ count: N }`
   *  pins the row count (no +/× controls). `{ min, max }` lets the student
   *  add/remove rows within bounds. */
  iv?: SectionConfig;
  dv?: SectionConfig;
  constants?: SectionConfig;
  /** Per-instance label overrides (SPEC §17). Defaults live in strings.da.ts. */
  ivLabel?: string;
  dvLabel?: string;
  constantsLabel?: string;
  nameHeader?: string;
  symbolHeader?: string;
  unitHeader?: string;
  addConstantLabel?: string;
  addIvLabel?: string;
  addDvLabel?: string;
  removeConstantAriaLabel?: string;
  removeIvAriaLabel?: string;
  removeDvAriaLabel?: string;
  constantRowAriaLabel?: string;
  ivRowAriaLabel?: string;
  dvRowAriaLabel?: string;
  constantMissingMessage?: string;
  ivMissingMessage?: string;
  dvMissingMessage?: string;
  /** Empty-state copy shown inside the Konstanter section when it has zero
   *  rows. Default: `strings.widgets.variableTable.constantsEmptyMessage`
   *  ("Ingen konstanter tilføjet endnu."). Pass `""` (empty string) to
   *  explicitly disable the empty-state branch and fall back to the
   *  bare add-link render. SPEC §17. */
  constantsEmptyMessage?: string;
  /** Empty-state copy for the IV section. Undefined by default — IV defaults
   *  to a single fixed row so the empty-state is unreachable unless the
   *  author overrides `iv: { min: 0, … }`. SPEC §17. */
  ivEmptyMessage?: string;
  /** Empty-state copy for the DV section. Undefined by default — see
   *  `ivEmptyMessage`. SPEC §17. */
  dvEmptyMessage?: string;
  /** Tjek button label override (SPEC §17). Only rendered when `expected`
   *  is provided. */
  checkLabel?: string;
  /** Opt in to driving the Tjek from the shared PhaseFooter button instead of
   *  the in-widget button. Meaningful only when `expected` is set; ignored in
   *  open mode (the in-widget button stays so free-advance keeps self-check).
   *  Default `false`. */
  checkInFooter?: boolean;
  /** Tooltip on a locked cell (SPEC §17). Leading `Korrekt.` doubles as the
   *  AT announcement of the locked/correct state; the rest carries the
   *  unlock affordance. */
  lockedTooltip?: string;
  /** SR-only description on an armed-spendable cell — surfaced via
   *  aria-describedby while spend mode is armed AND the cell has an unspent
   *  tier. Tells AT users the whole input rectangle is the spend target. */
  armedSpendableAriaDescription?: string;
  /** SR-only live-region announcement on full-success Tjek. Reuses existing
   *  Danish copy verbatim; exists only as the SPEC §17 override knob. */
  checkedAriaStatusLabel?: string;
  /** SEN accommodation — propagated to cell inputs to bypass paste-block. */
  allowPaste?: boolean;
}

const EMPTY: VariableEntry = { name: '', symbol: '', unit: '' };

const CELLS: readonly Cell[] = ['name', 'symbol', 'unit'];

function cellKey(section: 'iv' | 'dv' | 'constants', expectedIndex: number, cell: Cell): string {
  return `${section}.${expectedIndex}.${cell}`;
}

function resolveBounds(config: SectionConfig | undefined, fallback: Bounds): Bounds {
  if (config === undefined) return fallback;
  if ('count' in config) return { min: config.count, max: config.count };
  return { min: config.min, max: config.max };
}

const DEFAULT_IV_BOUNDS: Bounds = { min: 1, max: 1 };
const DEFAULT_DV_BOUNDS: Bounds = { min: 1, max: 1 };
const DEFAULT_CONSTANTS_BOUNDS: Bounds = { min: 0, max: Number.POSITIVE_INFINITY };

function emptyRows(n: number): VariableEntry[] {
  const finite = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return Array.from({ length: finite }, () => ({ ...EMPTY }));
}

function readRows(raw: unknown, min: number): VariableEntry[] {
  if (Array.isArray(raw)) {
    const rows = raw.map((c) => ({ ...EMPTY, ...(c as Partial<VariableEntry>) }));
    while (rows.length < min) rows.push({ ...EMPTY });
    return rows;
  }
  return emptyRows(min);
}

function readValues(
  raw: unknown,
  bounds: { iv: Bounds; dv: Bounds; constants: Bounds },
): VariableTableValues {
  if (raw && typeof raw === 'object') {
    const r = raw as { iv?: unknown; dv?: unknown; constants?: unknown };
    return {
      iv: readRows(r.iv, bounds.iv.min),
      dv: readRows(r.dv, bounds.dv.min),
      constants: readRows(r.constants, bounds.constants.min),
    };
  }
  return {
    iv: emptyRows(bounds.iv.min),
    dv: emptyRows(bounds.dv.min),
    constants: emptyRows(bounds.constants.min),
  };
}

function entryFilled(e: VariableEntry, requireUnits: boolean): boolean {
  const nameOk = e.name.trim().length > 0;
  const symbolOk = e.symbol.trim().length > 0;
  const unitOk = !requireUnits || e.unit.trim().length > 0;
  return nameOk && symbolOk && unitOk;
}

function entryEmpty(e: VariableEntry): boolean {
  return e.name.trim() === '' && e.symbol.trim() === '' && e.unit.trim() === '';
}

function sectionFilled(rows: VariableEntry[], bounds: Bounds, requireUnits: boolean): boolean {
  if (rows.length < bounds.min) return false;
  if (Number.isFinite(bounds.max) && rows.length > bounds.max) return false;
  return rows.every((r) => entryFilled(r, requireUnits));
}

/** Deep-equality via JSON. Used to detect per-section dirty state for paid-hint
 *  reveal-vs-edit gating + the free-diagnostic gate. `correct` no longer
 *  depends on this — locks own the correctness contract. */
function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Truncate an expected array to `max` entries, warning in dev when the
 *  author oversupplied (a permanent-lock authoring failure — the student
 *  physically cannot render enough rows). */
function clampExpected<T>(
  widgetId: string,
  section: 'iv' | 'dv' | 'constants',
  expected: T[],
  bounds: Bounds,
): T[] {
  if (!Number.isFinite(bounds.max) || expected.length <= bounds.max) return expected;
  if (import.meta.env.DEV) {
    console.warn(
      `[VariableTable id=${widgetId}] expected.${section}.length (${expected.length}) exceeds section max (${bounds.max}) — extra entries dropped to keep the widget useable in dev.`,
    );
  }
  return expected.slice(0, bounds.max);
}

/** Dev-only warning when an expected entry has neither symbol nor name set —
 *  such entries are silently dropped by `evaluateRowGroup` (no `missing`),
 *  so without this warning a misauthored lab would look fine. */
function warnMalformed(
  widgetId: string,
  section: 'iv' | 'dv' | 'constants',
  expected: ReadonlyArray<{ symbol?: unknown; name?: unknown }>,
): void {
  if (!import.meta.env.DEV) return;
  for (const e of expected) {
    if (e.symbol === undefined && e.name === undefined) {
      console.warn(
        `[VariableTable id=${widgetId}] expected.${section} entry has neither symbol nor name — it will never match any student row.`,
      );
    }
  }
}

/** Compact per-cell info aggregated for the row renderer. `cap === 0` means
 *  no hint ladder for this cell (e.g. `empty` error with no author hints) —
 *  the cell is not a spend target / `nextTier` stays `null`. `freeDiagnostic`
 *  is the case-mismatch / whitespace-internal text (no token cost).
 *  `popupEntries` holds the revealed-tier paid hints for the focus popup. */
interface CellHintInfo {
  cap: number;
  /** Next tier a spend click would unlock (1..cap). `null` when no advance is
   *  possible (cap reached or no error). */
  nextTier: number | null;
  freeDiagnostic: string | null;
  popupEntries: HintPopupEntry[];
}

const EMPTY_CELL_INFO: CellHintInfo = {
  cap: 0,
  nextTier: null,
  freeDiagnostic: null,
  popupEntries: [],
};

function freeDiagnosticFor(err: CellError | undefined, cell: Cell): string | null {
  if (!err) return null;
  if (err.type !== 'case-mismatch' && err.type !== 'whitespace-internal') return null;
  const tableHints = strings.widgets.variableTable.hints[cell] as
    | Record<string, readonly string[] | undefined>
    | undefined;
  const ladder = tableHints?.[err.type] ?? [];
  return ladder[0] ?? null;
}

/** Flash payload after a Tjek click. Cell keys (expectedIndex-addressed) map
 *  to the colour for their 1.5s flash. `nonce` re-mounts the wrapper so a
 *  repeat-Tjek re-triggers the CSS transition. `withTransition: false` honours
 *  `prefers-reduced-motion: reduce` — the colour still paints for 1.5s, the
 *  fade is suppressed. */
interface FlashPayload {
  keys: Record<string, 'correct' | 'wrong'>;
  nonce: number;
  withTransition: boolean;
}

/** Reason the Tjek button is dimmed (and clicking it is a no-op):
 *   - `'empty'`  — no values entered anywhere, so a Tjek would just report
 *                  uniformly empty cells.
 *   - `'clean'`  — every section's snapshot still matches the values, so a
 *                  re-Tjek would produce the same verdict as the prior click.
 *  `null` means the button is armed.  */
type TjekDimReason = 'empty' | 'clean' | null;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function VariableTable({
  id,
  requireUnits = false,
  expected,
  iv: ivConfig,
  dv: dvConfig,
  constants: constantsConfig,
  ivLabel,
  dvLabel,
  constantsLabel,
  nameHeader,
  symbolHeader,
  unitHeader,
  addConstantLabel,
  addIvLabel,
  addDvLabel,
  removeConstantAriaLabel,
  removeIvAriaLabel,
  removeDvAriaLabel,
  constantRowAriaLabel,
  ivRowAriaLabel,
  dvRowAriaLabel,
  constantMissingMessage,
  ivMissingMessage,
  dvMissingMessage,
  constantsEmptyMessage,
  ivEmptyMessage,
  dvEmptyMessage,
  checkLabel,
  checkInFooter = false,
  lockedTooltip,
  armedSpendableAriaDescription,
  checkedAriaStatusLabel,
  allowPaste,
}: Props) {
  const {
    state,
    setWidgetValue,
    spendAndRevealVtTier,
    setVariableTableLastChecked,
    lockVtCells,
    unlockVtCell,
    registerSpendableCount,
  } = useRunner();
  const { spendMode, exitSpendMode } = useHintSpend();

  const bounds = {
    iv: resolveBounds(ivConfig, DEFAULT_IV_BOUNDS),
    dv: resolveBounds(dvConfig, DEFAULT_DV_BOUNDS),
    constants: resolveBounds(constantsConfig, DEFAULT_CONSTANTS_BOUNDS),
  };
  const values = readValues(state.widgetValues[id], bounds);

  // Resolve + clamp expected arrays once per render.
  const ivExpectedArr = expected
    ? clampExpected(id, 'iv', asExpectedArray(expected.iv), bounds.iv)
    : [];
  const dvExpectedArr = expected
    ? clampExpected(id, 'dv', asExpectedArray(expected.dv), bounds.dv)
    : [];
  const constantsExpectedArr = expected?.constants
    ? clampExpected(id, 'constants', expected.constants, bounds.constants)
    : undefined;

  if (import.meta.env.DEV && expected) {
    warnMalformed(id, 'iv', ivExpectedArr);
    warnMalformed(id, 'dv', dvExpectedArr);
    if (constantsExpectedArr) warnMalformed(id, 'constants', constantsExpectedArr);
  }

  // Register as hint-eligible only when `expected` is set (no answer key →
  // no ladder → nothing to spend on).
  useRegisteredHintEligibility(id, expected !== undefined, 'vtCell');

  const ivFilled = sectionFilled(values.iv, bounds.iv, requireUnits);
  const dvFilled = sectionFilled(values.dv, bounds.dv, requireUnits);
  // PL11 carve-out: when the author did NOT pass a constants prop, the
  // constants section's filled contribution is unconditionally true (matches
  // today's behaviour where partial/blank constant rows don't block `filled`).
  const constantsFilled =
    constantsConfig === undefined ? true : sectionFilled(values.constants, bounds.constants, false);
  const filled = ivFilled && dvFilled && constantsFilled;

  const errors: CorrectnessReport | undefined = expected
    ? evaluateTable(values, {
        iv: ivExpectedArr,
        dv: dvExpectedArr,
        constants: constantsExpectedArr,
      })
    : undefined;

  // `lastChecked` snapshot still drives the free-diagnostic + paid-hint
  // reveal-vs-edit gating (`sectionClean` below). It no longer participates
  // in the `correct` definition — locks own correctness.
  const lastChecked = state.variableTableLastChecked[id];
  const sectionChecked = {
    iv: lastChecked !== undefined && valuesEqual(lastChecked.iv, values.iv),
    dv: lastChecked !== undefined && valuesEqual(lastChecked.dv, values.dv),
    constants: lastChecked !== undefined && valuesEqual(lastChecked.constants, values.constants),
  };

  const locks = state.variableTableLocks[id] ?? {};

  // A cell is *locked-and-currently-correct* iff a lock entry exists for its
  // expected-row key AND the current matcher report still pairs that expected
  // row to a student row whose value passes for that cell. This is the
  // single rule the `correct` aggregation + `sections` facet + per-row Field
  // lock branch all consume.
  function cellLockedAndCorrect(
    section: 'iv' | 'dv' | 'constants',
    expectedIndex: number,
    cell: Cell,
  ): boolean {
    const k = cellKey(section, expectedIndex, cell);
    if (locks[k] !== true) return false;
    const matches = errors?.[section];
    if (!matches) return false;
    const m = matches.find((x) => x.status !== 'missing' && x.expectedIndex === expectedIndex);
    if (!m || m.status === 'missing') return false;
    if (m.status === 'matched') return true;
    return m.errors[cell] === undefined;
  }

  // Row-render convenience: resolves studentIndex → expectedIndex via the
  // current matcher (same pairing rule paid hints use), then delegates. A
  // student row with no matcher pairing reports as unlocked.
  function cellLockedForStudent(
    section: 'iv' | 'dv' | 'constants',
    studentIndex: number,
    cell: Cell,
  ): boolean {
    const matches = errors?.[section];
    if (!matches) return false;
    const m = matches.find((x) => x.status !== 'missing' && x.studentIndex === studentIndex);
    if (!m || m.status === 'missing') return false;
    return cellLockedAndCorrect(section, m.expectedIndex, cell);
  }

  // Section-level lock coverage: every cell with `accepted` defined in the
  // section's expected entries is locked-and-currently-correct. Used by both
  // the `sections` facet and the published `correct`.
  function sectionFullyLockedCorrect(
    section: 'iv' | 'dv' | 'constants',
    sectionExpected: ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>,
  ): { covered: boolean; configured: number } {
    let configured = 0;
    let covered = true;
    for (let i = 0; i < sectionExpected.length; i++) {
      const exp = sectionExpected[i];
      if (!exp) continue;
      for (const cell of CELLS) {
        if (exp[cell] === undefined) continue;
        configured++;
        if (!cellLockedAndCorrect(section, i, cell)) covered = false;
      }
    }
    return { covered, configured };
  }

  const ivLock = expected ? sectionFullyLockedCorrect('iv', ivExpectedArr) : null;
  const dvLock = expected ? sectionFullyLockedCorrect('dv', dvExpectedArr) : null;
  const constantsLock =
    expected && constantsExpectedArr
      ? sectionFullyLockedCorrect('constants', constantsExpectedArr)
      : null;

  const expectedTotal =
    (ivLock?.configured ?? 0) + (dvLock?.configured ?? 0) + (constantsLock?.configured ?? 0);
  const allExpectedLocked =
    (ivLock?.covered ?? true) && (dvLock?.covered ?? true) && (constantsLock?.covered ?? true);
  const correct =
    expected !== undefined ? filled && expectedTotal > 0 && allExpectedLocked : undefined;

  // Per-section satisfaction facet for the instruction-box step tracker
  // (sibling-read; gate evaluators ignore it). With `expected.<section>`
  // present, the boolean reads "every configured cell in the section is
  // locked-and-currently-correct". Without it, falls back to presence.
  const sections = {
    iv: expected ? ivFilled && (ivLock?.covered ?? false) : ivFilled,
    dv: expected ? dvFilled && (dvLock?.covered ?? false) : dvFilled,
    constants:
      expected && constantsExpectedArr
        ? constantsFilled && (constantsLock?.covered ?? false)
        : constantsFilled,
  };

  // Conditional spread: when `expected` is absent, omit the `correct`/`errors`
  // keys entirely (not `undefined`) so back-compat consumers can rely on
  // `'correct' in state` semantics.
  const widgetState =
    expected !== undefined
      ? ({ kind: 'filled', filled, correct, errors, values, sections } as const)
      : ({ kind: 'filled', filled, values, sections } as const);

  useRegisteredWidgetState(id, widgetState, [
    filled,
    correct ?? null,
    sections.iv,
    sections.dv,
    sections.constants,
    // Explicit errors key: technically redundant since cell-value deps below
    // already cover freshness (errors is purely derived), but documents intent
    // and survives future refactors that might drop cell-value deps.
    JSON.stringify(errors ?? null),
    JSON.stringify(values),
    JSON.stringify(locks),
  ]);

  function updateRow(
    section: 'iv' | 'dv' | 'constants',
    idx: number,
    field: keyof VariableEntry,
    next: string,
  ) {
    const rows = values[section].map((r, i) => (i === idx ? { ...r, [field]: next } : r));
    setWidgetValue(id, { ...values, [section]: rows });
  }
  function addRow(section: 'iv' | 'dv' | 'constants') {
    setWidgetValue(id, { ...values, [section]: [...values[section], { ...EMPTY }] });
  }
  function removeRow(section: 'iv' | 'dv' | 'constants', idx: number) {
    setWidgetValue(id, {
      ...values,
      [section]: values[section].filter((_, i) => i !== idx),
    });
  }

  // Per-Tjek flash state — emerald-on-newly-locked + rose-on-still-wrong. The
  // nonce remounts the wrapper so a repeat-Tjek with identical keys still
  // restarts the fade animation. The fade itself is a CSS keyframe
  // (`animate-vt-flash-fade` in globals.css) that interpolates the cell's
  // background-color from the static class value to transparent over 1500ms.
  // Under reduced motion the keyframe is suppressed and the colour stays
  // solid for the window. Cleared entirely after 1500ms.
  const [flash, setFlash] = useState<FlashPayload | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashNonceRef = useRef(0);

  // Tjek-dim derivation. When `expected` is not set the Tjek button isn't
  // rendered at all, so the dim reason is moot — keep it `null` so any
  // downstream consumer sees an armed default.
  const valuesAllEmpty =
    values.iv.every(entryEmpty) &&
    values.dv.every(entryEmpty) &&
    values.constants.every(entryEmpty);
  const allSectionsClean =
    lastChecked !== undefined && sectionChecked.iv && sectionChecked.dv && sectionChecked.constants;
  const tjekDimReason: TjekDimReason =
    expected === undefined ? null : valuesAllEmpty ? 'empty' : allSectionsClean ? 'clean' : null;
  const tjekDimTooltip =
    tjekDimReason === 'empty'
      ? strings.widgets.variableTable.tjekDisabledEmpty
      : tjekDimReason === 'clean'
        ? strings.widgets.variableTable.tjekDisabledClean
        : undefined;

  // Clear any pending flash timer on unmount so a late tick can't call
  // setState on an unmounted widget (e.g. lab teardown mid-flash).
  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  function handleTjek() {
    if (!expected || !errors) return;
    // Dimmed Tjek is a no-op — the click hit a no-changes-or-empty state. Let
    // the dim affordance carry the signal; don't snapshot the values again.
    if (tjekDimReason !== null) return;
    setVariableTableLastChecked(id, values);

    const newlyLocked: string[] = [];
    const newlyUnlocked: string[] = [];
    const flashKeys: Record<string, 'correct' | 'wrong'> = {};

    const sectionData: Array<{
      section: 'iv' | 'dv' | 'constants';
      expectedArr: ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>;
      matches: RowMatch[] | undefined;
    }> = [
      { section: 'iv', expectedArr: ivExpectedArr, matches: errors.iv },
      { section: 'dv', expectedArr: dvExpectedArr, matches: errors.dv },
      {
        section: 'constants',
        expectedArr: constantsExpectedArr ?? [],
        matches: errors.constants,
      },
    ];

    for (const { section, expectedArr, matches } of sectionData) {
      if (!matches) continue;
      for (const m of matches) {
        if (m.status === 'missing') continue;
        const exp = expectedArr[m.expectedIndex];
        const studentRow = values[section][m.studentIndex];
        if (!exp || !studentRow) continue;
        for (const cell of CELLS) {
          if (exp[cell] === undefined) continue;
          const k = cellKey(section, m.expectedIndex, cell);
          const value = studentRow[cell].trim();
          const hadLock = locks[k] === true;
          const isCellCorrect =
            m.status === 'matched' ||
            (m.status === 'partial' && (m.errors as VariableRowErrors)[cell] === undefined);

          // Empty cells are always ignored for flash/wrong-state per the
          // task rule. Stale locks on a now-empty value are dropped silently.
          if (value === '') {
            if (hadLock) newlyUnlocked.push(k);
            continue;
          }
          if (hadLock && isCellCorrect) continue;
          if (hadLock && !isCellCorrect) {
            // Stale-lock cleanup: drop the lock + rose-flash the regression.
            newlyUnlocked.push(k);
            flashKeys[k] = 'wrong';
            continue;
          }
          if (isCellCorrect) {
            newlyLocked.push(k);
            flashKeys[k] = 'correct';
          } else {
            flashKeys[k] = 'wrong';
          }
        }
      }
    }

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

  // Footer-check opt-in: when `checkInFooter` is set (and `expected` exists,
  // and we're not in open mode), the in-widget Tjek button is suppressed and
  // the PhaseFooter drives `handleTjek` instead. The check object is stable;
  // we mutate it in place each render so the footer reads the latest closure.
  // VariableTable's check is synchronous (never pending), but it CAN be dimmed
  // — empty cells, or no-edits-since-last-Tjek — so disabled+disabledReason
  // flow through to the footer's Tooltip wrap. The button flash itself fires
  // from the footer (on gate-unlock transition), not from the widget.
  const footerActive = checkInFooter && expected !== undefined && state.mode !== 'open';
  const checkRef = useRef<WidgetCheck>({
    label: '',
    run: () => {},
    disabled: false,
    pending: false,
  });
  checkRef.current.label = checkLabel ?? strings.widgets.variableTable.checkLabel;
  checkRef.current.run = handleTjek;
  checkRef.current.disabled = tjekDimReason !== null;
  checkRef.current.disabledReason = tjekDimTooltip;
  // Re-fire the registration whenever the dim reason changes so the footer
  // re-reads the live `disabled`/`disabledReason` (most state changes already
  // re-render the footer via runner dispatch; this is the belt-and-braces).
  const checkRevision = tjekDimReason === 'empty' ? 1 : tjekDimReason === 'clean' ? 2 : 0;
  useRegisteredWidgetCheck(id, footerActive, checkRef, checkRevision);

  const tiers = state.variableTableHintTiers[id] ?? {};
  const reveals = state.variableTableHintReveals?.[id] ?? {};
  // Per-section "clean snapshot" gate — Tjek was run and values haven't been
  // edited since. Used for live diagnostics + spend-target gating (spending
  // mid-edit hides what the student is paying for). Revealed paid strings
  // ignore this gate — once spent, the hint is paid for and stays visible
  // through every subsequent edit, including clearing the cell to retry.
  const sectionClean = {
    iv: expected !== undefined && sectionChecked.iv,
    dv: expected !== undefined && sectionChecked.dv,
    constants: expected !== undefined && sectionChecked.constants,
  };

  function cellInfoFor(
    section: 'iv' | 'dv' | 'constants',
    sectionExpected: ReadonlyArray<{
      name?: CellSpec;
      symbol?: CellSpec;
      unit?: CellSpec;
    }>,
    matches: RowMatch[] | undefined,
    studentIndex: number,
    cell: Cell,
  ): CellHintInfo {
    if (expected === undefined) return EMPTY_CELL_INFO;
    // Try to pair the student row to its expected row via the current matcher.
    // If the cell has been cleared or the row dropped out of `partial`, cm is
    // undefined — we still want to surface previously-revealed paid strings.
    // Fall back to `expectedIndex = studentIndex` (correct for the single-row
    // sections that are the default; multi-row sections that reshuffle pairing
    // are a known limitation).
    const cm = matches?.find((m) => m.status === 'partial' && m.studentIndex === studentIndex);
    const expectedIndex = cm?.expectedIndex ?? studentIndex;
    const k = cellKey(section, expectedIndex, cell);
    const revealsForCell = reveals[k] ?? [];

    let cap = 0;
    let nextTier: number | null = null;
    let freeDiagnostic: string | null = null;
    const popupEntries: HintPopupEntry[] = [];

    if (cm && cm.status === 'partial') {
      const rowExp = sectionExpected[cm.expectedIndex];
      const err: CellError | undefined = rowExp
        ? (cm.errors as VariableRowErrors)[cell]
        : undefined;
      if (rowExp && err) {
        const cellSpec = rowExp[cell];
        cap = maxTierForCell(err, cellSpec, cell);
        const tier = tiers[k] ?? 0;
        // Spend target only armed on a clean section — spending mid-edit
        // would charge the student for a hint about an error type that may
        // shift on the next keystroke.
        nextTier = sectionClean[section] && cap > 0 && tier < cap ? tier + 1 : null;
        // Free diagnostic only surfaces on a clean section — it diagnoses
        // the live value, so showing it mid-edit would be noisy.
        if (sectionClean[section]) {
          freeDiagnostic = freeDiagnosticFor(err, cell);
          if (freeDiagnostic !== null) {
            popupEntries.push({
              key: `free-${section}-${cm.expectedIndex}-${cell}`,
              text: freeDiagnostic,
              tone: 'misconception',
            });
          }
        }
      }
    }

    // Paid revealed strings — always surfaced, regardless of dirty state and
    // even if the current error type / row pairing has shifted. They were
    // paid for at spend-time; the student keeps reading them.
    revealsForCell.forEach((text, i) => {
      popupEntries.push({
        key: `paid-${section}-${expectedIndex}-${cell}-${i + 1}`,
        text,
        tone: 'hint',
      });
    });

    return { cap, nextTier, freeDiagnostic, popupEntries };
  }

  // Live spendable-target count — number of failing cells with a remaining
  // ladder. HintBucket reads the phase-aggregate to disable when tokens > 0
  // but nothing is left to buy. cellInfoFor already gates `nextTier` on the
  // section being clean + the cell having an unspent tier, so locked /
  // matched / mid-edit cells naturally drop out.
  let spendableCount = 0;
  if (expected && errors) {
    for (const { section, expectedArr, matches } of [
      { section: 'iv' as const, expectedArr: ivExpectedArr, matches: errors.iv },
      { section: 'dv' as const, expectedArr: dvExpectedArr, matches: errors.dv },
      {
        section: 'constants' as const,
        expectedArr: constantsExpectedArr ?? [],
        matches: errors.constants,
      },
    ]) {
      if (!matches) continue;
      const studentRows = values[section];
      for (let s = 0; s < studentRows.length; s++) {
        for (const cell of CELLS) {
          if (cellInfoFor(section, expectedArr, matches, s, cell).nextTier !== null) {
            spendableCount++;
          }
        }
      }
    }
  }
  useEffect(() => {
    if (expected === undefined) return;
    registerSpendableCount(id, spendableCount);
    return () => registerSpendableCount(id, null);
  }, [id, expected, spendableCount, registerSpendableCount]);

  function missingMessagesFor(
    section: 'iv' | 'dv' | 'constants',
    sectionExpected:
      | ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>
      | undefined,
    matches: RowMatch[] | undefined,
    template: string,
  ): string[] {
    if (!sectionClean[section] || !matches || !sectionExpected) return [];
    const out: string[] = [];
    for (const m of matches) {
      if (m.status !== 'missing') continue;
      const exp = sectionExpected[m.expectedIndex];
      if (!exp) continue;
      out.push(
        format(template, {
          name: cellAcceptedValues(exp.name)?.[0] ?? '',
          symbol: cellAcceptedValues(exp.symbol)?.[0] ?? '',
          unit: cellAcceptedValues(exp.unit)?.[0] ?? '',
        }),
      );
      // Cap at one missing-message per section to avoid spam.
      if (out.length >= 1) break;
    }
    return out;
  }

  const nameH = nameHeader ?? strings.widgets.variableTable.nameHeader;
  const symbolH = symbolHeader ?? strings.widgets.variableTable.symbolHeader;
  const unitH = unitHeader ?? strings.widgets.variableTable.unitHeader;

  const showAriaStatus = correct === true;
  const ariaStatusLabel =
    checkedAriaStatusLabel ?? strings.widgets.variableTable.checkedAriaStatusLabel;
  const resolvedArmedAria =
    armedSpendableAriaDescription ?? strings.widgets.hints.armedSpendableAriaDescription;
  // Author override (`lockedTooltip` prop) renders verbatim as a string — the
  // override is opaque content the author committed to and should not be
  // split. The default path renders structured content: a ✓ glyph (visual)
  // paired with an sr-only "Korrekt." prefix (AT) — see strings.da.ts for the
  // split keys. CLAUDE.md note about the leading `Korrekt.` doubling as the
  // AT announcement still holds; the sr-only span carries it.
  const lockedTooltipContent: ReactNode =
    lockedTooltip !== undefined ? (
      lockedTooltip
    ) : (
      <>
        <span aria-hidden="true">✓</span>
        <span className="sr-only">
          {strings.widgets.variableTable.lockedTooltipScreenReaderPrefix}
        </span>{' '}
        {strings.widgets.variableTable.lockedTooltipRest}
      </>
    );

  const ivMissing = missingMessagesFor(
    'iv',
    ivExpectedArr,
    errors?.iv,
    ivMissingMessage ?? strings.widgets.variableTable.hints.ivMissing,
  );
  const dvMissing = missingMessagesFor(
    'dv',
    dvExpectedArr,
    errors?.dv,
    dvMissingMessage ?? strings.widgets.variableTable.hints.dvMissing,
  );
  const constantsMissing = missingMessagesFor(
    'constants',
    constantsExpectedArr,
    errors?.constants,
    constantMissingMessage ?? strings.widgets.variableTable.hints.constantMissing,
  );

  const armed =
    expected !== undefined &&
    spendMode.kind === 'active' &&
    spendMode.phaseId === state.currentPhaseId;

  const onSpendCell = (section: 'iv' | 'dv' | 'constants', studentIndex: number, cell: Cell) => {
    const expectedArr =
      section === 'iv' ? ivExpectedArr : section === 'dv' ? dvExpectedArr : constantsExpectedArr;
    if (!expectedArr) return;
    const matches =
      section === 'iv' ? errors?.iv : section === 'dv' ? errors?.dv : errors?.constants;
    if (!matches) return;
    const cm = matches.find((m) => m.status === 'partial' && m.studentIndex === studentIndex);
    if (!cm || cm.status !== 'partial') return;
    const rowExp = expectedArr[cm.expectedIndex];
    if (!rowExp) return;
    const err: CellError | undefined = (cm.errors as VariableRowErrors)[cell];
    if (!err) return;
    const cellSpec = rowExp[cell];
    const cap = maxTierForCell(err, cellSpec, cell);
    if (cap <= 0) return;
    // Compute the hint text at spend-time from the current (F7-sliced) ladder
    // and pass it to the reducer. The text is then stored in
    // `variableTableHintReveals` so subsequent edits — including clearing the
    // cell — don't drop the paid string.
    const k = cellKey(section, cm.expectedIndex, cell);
    const currentTier = tiers[k] ?? 0;
    if (currentTier >= cap) return;
    const ladder = resolveLadder(err, cellSpec, cell);
    const revealedText = ladder[currentTier];
    if (revealedText === undefined) return;
    spendAndRevealVtTier({
      widgetId: id,
      cellKey: k,
      revealedText,
      hintCap: cap,
    });
    // With HintLightbulb removed, the click-to-spend lives on the input
    // itself; spend mode must exit here instead of inside the lightbulb.
    exitSpendMode();
  };

  const onUnlock = (section: 'iv' | 'dv' | 'constants', studentIndex: number, cell: Cell) => {
    const matches = errors?.[section];
    const cm = matches?.find((m) => m.status !== 'missing' && m.studentIndex === studentIndex);
    if (!cm || cm.status === 'missing') return;
    unlockVtCell(id, cellKey(section, cm.expectedIndex, cell));
  };

  // Resolve the flash colour for a rendered cell. The flash is keyed by
  // expectedIndex, so map studentIndex → expectedIndex via the current matcher
  // (same pairing rule as `cellLockedForStudent`).
  function flashForStudent(
    section: 'iv' | 'dv' | 'constants',
    studentIndex: number,
    cell: Cell,
  ): 'correct' | 'wrong' | null {
    if (!flash) return null;
    const matches = errors?.[section];
    if (!matches) return null;
    const m = matches.find((x) => x.status !== 'missing' && x.studentIndex === studentIndex);
    if (!m || m.status === 'missing') return null;
    return flash.keys[cellKey(section, m.expectedIndex, cell)] ?? null;
  }

  return (
    <div className="my-4 w-fit max-w-full space-y-4">
      <div className="rounded-md border border-slate-200">
        {/* Single column-header band — desktop only; on mobile each input
            carries its own visible label (the stacked layout needs it). The
            slate-50 tint seats it as a header zone above the input sections.
            `rounded-t-md` clips the header band's slate-100 fill to match the
            wrapper's rounded corners — required because the wrapper drops
            `overflow-hidden` so HintPopup can escape downward. */}
        <div
          aria-hidden="true"
          className="hidden gap-3 rounded-t-md border-b border-slate-200 bg-slate-100 px-3 py-2 sm:grid sm:grid-cols-[minmax(10rem,16rem)_6rem_6rem_2rem]"
        >
          <div className="text-sm font-medium text-slate-600">{nameH}</div>
          <div className="text-sm font-medium text-slate-600">{symbolH}</div>
          <div className="text-sm font-medium text-slate-600">{unitH}</div>
        </div>
        <div className="divide-y divide-slate-100">
          <RowGroupSection
            sectionId="iv"
            idPrefix={`${id}-iv`}
            label={ivLabel ?? strings.widgets.variableTable.ivLabel}
            rows={values.iv}
            bounds={bounds.iv}
            nameHeader={nameH}
            symbolHeader={symbolH}
            unitHeader={unitH}
            addLabel={addIvLabel ?? strings.widgets.variableTable.addIvLabel}
            removeAriaLabel={removeIvAriaLabel ?? strings.widgets.variableTable.removeIvAriaLabel}
            rowAriaLabel={ivRowAriaLabel ?? strings.widgets.variableTable.ivRowAriaLabel}
            onChange={(idx, field, next) => updateRow('iv', idx, field, next)}
            onAdd={() => addRow('iv')}
            onRemove={(idx) => removeRow('iv', idx)}
            getInfo={(s, cell) => cellInfoFor('iv', ivExpectedArr, errors?.iv, s, cell)}
            getLocked={(s, cell) => cellLockedForStudent('iv', s, cell)}
            getFlash={(s, cell) => flashForStudent('iv', s, cell)}
            flashNonce={flash?.nonce ?? 0}
            flashWithTransition={flash?.withTransition ?? true}
            lockedTooltipContent={lockedTooltipContent}
            armedSpendableAriaDescription={resolvedArmedAria}
            missingMessages={ivMissing}
            emptyMessage={ivEmptyMessage}
            allowPaste={allowPaste}
            armed={armed}
            onSpend={(s, cell) => onSpendCell('iv', s, cell)}
            onUnlock={(s, cell) => onUnlock('iv', s, cell)}
          />
          <RowGroupSection
            sectionId="dv"
            idPrefix={`${id}-dv`}
            label={dvLabel ?? strings.widgets.variableTable.dvLabel}
            rows={values.dv}
            bounds={bounds.dv}
            nameHeader={nameH}
            symbolHeader={symbolH}
            unitHeader={unitH}
            addLabel={addDvLabel ?? strings.widgets.variableTable.addDvLabel}
            removeAriaLabel={removeDvAriaLabel ?? strings.widgets.variableTable.removeDvAriaLabel}
            rowAriaLabel={dvRowAriaLabel ?? strings.widgets.variableTable.dvRowAriaLabel}
            onChange={(idx, field, next) => updateRow('dv', idx, field, next)}
            onAdd={() => addRow('dv')}
            onRemove={(idx) => removeRow('dv', idx)}
            getInfo={(s, cell) => cellInfoFor('dv', dvExpectedArr, errors?.dv, s, cell)}
            getLocked={(s, cell) => cellLockedForStudent('dv', s, cell)}
            getFlash={(s, cell) => flashForStudent('dv', s, cell)}
            flashNonce={flash?.nonce ?? 0}
            flashWithTransition={flash?.withTransition ?? true}
            lockedTooltipContent={lockedTooltipContent}
            armedSpendableAriaDescription={resolvedArmedAria}
            missingMessages={dvMissing}
            emptyMessage={dvEmptyMessage}
            allowPaste={allowPaste}
            armed={armed}
            onSpend={(s, cell) => onSpendCell('dv', s, cell)}
            onUnlock={(s, cell) => onUnlock('dv', s, cell)}
          />
          <RowGroupSection
            sectionId="constants"
            idPrefix={`${id}-c`}
            label={constantsLabel ?? strings.widgets.variableTable.constantsLabel}
            rows={values.constants}
            bounds={bounds.constants}
            nameHeader={nameH}
            symbolHeader={symbolH}
            unitHeader={unitH}
            addLabel={addConstantLabel ?? strings.widgets.variableTable.addConstantLabel}
            removeAriaLabel={
              removeConstantAriaLabel ?? strings.widgets.variableTable.removeConstantAriaLabel
            }
            rowAriaLabel={
              constantRowAriaLabel ?? strings.widgets.variableTable.constantRowAriaLabel
            }
            onChange={(idx, field, next) => updateRow('constants', idx, field, next)}
            onAdd={() => addRow('constants')}
            onRemove={(idx) => removeRow('constants', idx)}
            getInfo={(s, cell) =>
              cellInfoFor('constants', constantsExpectedArr ?? [], errors?.constants, s, cell)
            }
            getLocked={(s, cell) => cellLockedForStudent('constants', s, cell)}
            getFlash={(s, cell) => flashForStudent('constants', s, cell)}
            flashNonce={flash?.nonce ?? 0}
            flashWithTransition={flash?.withTransition ?? true}
            lockedTooltipContent={lockedTooltipContent}
            armedSpendableAriaDescription={resolvedArmedAria}
            missingMessages={constantsMissing}
            emptyMessage={
              constantsEmptyMessage ?? strings.widgets.variableTable.constantsEmptyMessage
            }
            allowPaste={allowPaste}
            armed={armed}
            onSpend={(s, cell) => onSpendCell('constants', s, cell)}
            onUnlock={(s, cell) => onUnlock('constants', s, cell)}
          />
        </div>
      </div>
      {expected && (!footerActive || showAriaStatus) && (
        <div className="mt-2 flex items-center justify-end gap-3">
          {showAriaStatus && (
            <output className="sr-only" aria-live="polite">
              {ariaStatusLabel}
            </output>
          )}
          {!footerActive && (
            <>
              <HintBucket placement="inline" />
              <InWidgetTjekButton
                onClick={handleTjek}
                label={checkLabel ?? strings.widgets.variableTable.checkLabel}
                dimReason={tjekDimReason}
                dimTooltip={tjekDimTooltip}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface RowGroupProps {
  sectionId: 'iv' | 'dv' | 'constants';
  idPrefix: string;
  label: string;
  rows: VariableEntry[];
  bounds: Bounds;
  nameHeader: string;
  symbolHeader: string;
  unitHeader: string;
  addLabel: string;
  removeAriaLabel: string;
  rowAriaLabel: string;
  onChange: (idx: number, field: keyof VariableEntry, next: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  getInfo: (studentIndex: number, cell: Cell) => CellHintInfo;
  getLocked: (studentIndex: number, cell: Cell) => boolean;
  getFlash: (studentIndex: number, cell: Cell) => 'correct' | 'wrong' | null;
  flashNonce: number;
  flashWithTransition: boolean;
  lockedTooltipContent: ReactNode;
  armedSpendableAriaDescription: string;
  missingMessages: string[];
  /** Empty-state copy. When `rows.length === 0` and this is a non-empty
   *  string, the section renders heading → empty-state text → a button-chip
   *  styled add affordance. When undefined or `""`, the section falls back
   *  to today's bare add-link render. */
  emptyMessage?: string;
  allowPaste?: boolean;
  armed: boolean;
  onSpend: (studentIndex: number, cell: Cell) => void;
  onUnlock: (studentIndex: number, cell: Cell) => void;
}

function RowGroupSection({
  idPrefix,
  label,
  rows,
  bounds,
  nameHeader,
  symbolHeader,
  unitHeader,
  addLabel,
  removeAriaLabel,
  rowAriaLabel,
  onChange,
  onAdd,
  onRemove,
  getInfo,
  getLocked,
  getFlash,
  flashNonce,
  flashWithTransition,
  lockedTooltipContent,
  armedSpendableAriaDescription,
  missingMessages,
  emptyMessage,
  allowPaste,
  armed,
  onSpend,
  onUnlock,
}: RowGroupProps) {
  const canAdd = rows.length < bounds.max;
  const canRemove = rows.length > bounds.min;
  const showEmptyState = rows.length === 0 && !!emptyMessage;
  return (
    <div className="p-3">
      <div className="mb-2 text-sm font-semibold text-navy">{label}</div>
      {showEmptyState && <div className="mb-2 text-sm text-slate-500">{emptyMessage}</div>}
      {rows.map((row, i) => (
        <RepeatableRow
          // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity of a row in this section
          key={i}
          id={`${idPrefix}${i}`}
          rowIndex={i}
          entry={row}
          onChange={(field, next) => onChange(i, field, next)}
          onRemove={canRemove ? () => onRemove(i) : undefined}
          nameHeader={nameHeader}
          symbolHeader={symbolHeader}
          unitHeader={unitHeader}
          rowAriaLabel={rowAriaLabel}
          removeAriaLabel={removeAriaLabel}
          info={{
            name: getInfo(i, 'name'),
            symbol: getInfo(i, 'symbol'),
            unit: getInfo(i, 'unit'),
          }}
          locked={{
            name: getLocked(i, 'name'),
            symbol: getLocked(i, 'symbol'),
            unit: getLocked(i, 'unit'),
          }}
          flash={{
            name: getFlash(i, 'name'),
            symbol: getFlash(i, 'symbol'),
            unit: getFlash(i, 'unit'),
          }}
          flashNonce={flashNonce}
          flashWithTransition={flashWithTransition}
          lockedTooltipContent={lockedTooltipContent}
          armedSpendableAriaDescription={armedSpendableAriaDescription}
          allowPaste={allowPaste}
          armed={armed}
          onSpend={(cell) => onSpend(i, cell)}
          onUnlock={(cell) => onUnlock(i, cell)}
        />
      ))}
      {missingMessages.length > 0 && (
        <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
          {missingMessages.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={
            showEmptyState
              ? 'mt-2 inline-flex items-center rounded border border-accent/40 px-2 py-1 text-sm font-medium text-accent hover:border-accent hover:bg-accent/5'
              : 'mt-2 text-sm font-medium text-accent hover:underline'
          }
        >
          {addLabel}
        </button>
      )}
    </div>
  );
}

interface RepeatableRowProps {
  id: string;
  rowIndex: number;
  entry: VariableEntry;
  onChange: (field: keyof VariableEntry, next: string) => void;
  onRemove: (() => void) | undefined;
  nameHeader: string;
  symbolHeader: string;
  unitHeader: string;
  /** Template with {n} and {field} placeholders for repeated-row aria labels. */
  rowAriaLabel: string;
  removeAriaLabel: string;
  info: Record<Cell, CellHintInfo>;
  locked: Record<Cell, boolean>;
  flash: Record<Cell, 'correct' | 'wrong' | null>;
  flashNonce: number;
  flashWithTransition: boolean;
  lockedTooltipContent: ReactNode;
  /** Already-resolved sr-only description for an armed-spendable cell. */
  armedSpendableAriaDescription: string;
  allowPaste?: boolean;
  armed: boolean;
  onSpend: (cell: Cell) => void;
  onUnlock: (cell: Cell) => void;
}

function RepeatableRow({
  id,
  rowIndex,
  entry,
  onChange,
  onRemove,
  nameHeader,
  symbolHeader,
  unitHeader,
  rowAriaLabel,
  removeAriaLabel,
  info,
  locked,
  flash,
  flashNonce,
  flashWithTransition,
  lockedTooltipContent,
  armedSpendableAriaDescription,
  allowPaste,
  armed,
  onSpend,
  onUnlock,
}: RepeatableRowProps) {
  // Every input carries a section-aware programmatic label: the visible
  // per-input <label> is mobile-only, and the desktop header band is
  // aria-hidden, so without this the inputs would be anonymous to SR.
  const rowAria = (field: string) => format(rowAriaLabel, { n: rowIndex + 1, field });
  const hasRemove = onRemove !== undefined;
  // One grid template for every row in every section: name flexes (capped),
  // symbol/unit are narrow fixed tracks, and a fixed remove-button gutter is
  // always reserved (empty on non-removable rows) so every row lines up under
  // the single header band.
  return (
    <div className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(10rem,16rem)_6rem_6rem_2rem]">
      <Field
        id={`${id}-name`}
        label={nameHeader}
        ariaLabel={rowAria(nameHeader)}
        value={entry.name}
        onChange={(v) => onChange('name', v)}
        info={info.name}
        locked={locked.name}
        flash={flash.name}
        flashNonce={flashNonce}
        flashWithTransition={flashWithTransition}
        lockedTooltipContent={lockedTooltipContent}
        armedSpendableAriaDescription={armedSpendableAriaDescription}
        allowPaste={allowPaste}
        armed={armed}
        onSpend={() => onSpend('name')}
        onUnlock={() => onUnlock('name')}
      />
      <Field
        id={`${id}-symbol`}
        label={symbolHeader}
        ariaLabel={rowAria(symbolHeader)}
        value={entry.symbol}
        onChange={(v) => onChange('symbol', v)}
        info={info.symbol}
        locked={locked.symbol}
        flash={flash.symbol}
        flashNonce={flashNonce}
        flashWithTransition={flashWithTransition}
        lockedTooltipContent={lockedTooltipContent}
        armedSpendableAriaDescription={armedSpendableAriaDescription}
        allowPaste={allowPaste}
        armed={armed}
        onSpend={() => onSpend('symbol')}
        onUnlock={() => onUnlock('symbol')}
      />
      <Field
        id={`${id}-unit`}
        label={unitHeader}
        ariaLabel={rowAria(unitHeader)}
        value={entry.unit}
        onChange={(v) => onChange('unit', v)}
        info={info.unit}
        locked={locked.unit}
        flash={flash.unit}
        flashNonce={flashNonce}
        flashWithTransition={flashWithTransition}
        lockedTooltipContent={lockedTooltipContent}
        armedSpendableAriaDescription={armedSpendableAriaDescription}
        allowPaste={allowPaste}
        armed={armed}
        onSpend={() => onSpend('unit')}
        onUnlock={() => onUnlock('unit')}
      />
      {hasRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={format(removeAriaLabel, { n: rowIndex + 1 })}
          className="self-start rounded px-2 py-1.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600 focus-visible:bg-rose-50 focus-visible:text-rose-600"
        >
          ×
        </button>
      )}
    </div>
  );
}

interface FieldProps {
  id: string;
  /** Column label, rendered as a mobile-only `<label>` (the desktop column
   *  headers live in the table's single header band). */
  label: string;
  /** Programmatic label — always set so each input carries a section-aware
   *  accessible name on desktop, where the visible `<label>` is hidden. */
  ariaLabel: string;
  value: string;
  onChange: (next: string) => void;
  /** Hint resolution for this cell — popup entries (free + paid) + the
   *  remaining ladder length. */
  info: CellHintInfo;
  /** True iff a lock entry exists for this cell's expected-row key AND the
   *  current matcher report still shows the cell correct. Locked cells render
   *  as plain text spans (no input chrome, no hint chrome). */
  locked: boolean;
  /** Per-Tjek flash on this cell — emerald for newly-locked, rose for wrong
   *  or stale-lock cleanup. `null` between Tjeks. */
  flash: 'correct' | 'wrong' | null;
  /** Nonce that remounts the flash wrapper so a repeat-Tjek with identical
   *  flash keys still re-triggers the CSS transition. */
  flashNonce: number;
  /** False under `prefers-reduced-motion: reduce` — the colour still paints
   *  for the 1.5s window, but the fade transition is skipped. */
  flashWithTransition: boolean;
  /** Combined tooltip + sr-only prefix text for the locked branch. */
  lockedTooltipContent: ReactNode;
  /** Resolved sr-only description announced when the cell is armed-spendable. */
  armedSpendableAriaDescription: string;
  allowPaste?: boolean;
  armed: boolean;
  onSpend: () => void;
  onUnlock: () => void;
}

function Field({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  info,
  locked,
  flash,
  flashNonce,
  flashWithTransition,
  lockedTooltipContent,
  armedSpendableAriaDescription,
  allowPaste,
  armed,
  onSpend,
  onUnlock,
}: FieldProps) {
  const armedSpendable = !locked && armed && info.nextTier !== null;
  // Hint-count pips: editable + popup will open on focus. N tiny amber
  // vertical ticks at bottom-right communicate "this cell has N hints" — one
  // tick per popup bullet, so the count matches what the student will read
  // when the popup opens. Stays visible while armed (the armed border is a
  // separate "spend mode" cue, not a hint-count cue). Gated on popupEntries
  // (not cap directly) so the indicator stays hidden mid-edit when the
  // section is dirty and the popup will not open. Locked cells never carry
  // hint chrome (the lock IS the affordance).
  const showHintTicks = !locked && info.popupEntries.length > 0;

  const inputClass = armedSpendable
    ? 'w-full border-amber-400 ring-1 ring-amber-300 cursor-pointer'
    : 'w-full hover:bg-accent-50 focus:border-accent-400 focus:!ring-0';

  const armedDescId = `${id}-armed`;
  const ariaDescribedBy = armedSpendable ? armedDescId : undefined;

  // Spend + auto-focus the cell so the popup opens with fresh entries.
  // Browser order on click: mousedown → focus → click. We preventDefault on
  // mousedown to suppress the natural focus (the popup would open against
  // stale entries), dispatch the spend, then re-focus on the next macrotask —
  // by which point React has flushed the reveal into popupEntries and
  // HintPopup's freshly-cloned onFocus sees willOpen=true.
  const handleMouseDown = (e: MouseEvent<HTMLInputElement>) => {
    if (!armedSpendable) return;
    e.preventDefault();
    onSpend();
    setTimeout(() => document.getElementById(id)?.focus(), 0);
  };
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (armedSpendable && e.key === 'Enter') {
      e.preventDefault();
      onSpend();
      // Already focused — but HintPopup's onFocus only fires on focus
      // *transitions*. Force a blur+refocus so the popup re-opens against
      // fresh entries.
      setTimeout(() => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        el?.blur();
        el?.focus();
      }, 0);
    }
  };

  // Focus the freshly-rendered input on unlock so a keyboard student can
  // resume typing without re-Tab. The effect only fires on the locked → editable
  // transition (initial mount with locked=false is a no-op).
  const prevLockedRef = useRef(locked);
  useEffect(() => {
    if (prevLockedRef.current && !locked) {
      document.getElementById(id)?.focus();
    }
    prevLockedRef.current = locked;
  }, [locked, id]);

  // Long-press unlock for touch. Cleared on touchend/cancel/move so a swipe-
  // scroll doesn't accidentally unlock.
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pressTimerRef.current !== null) clearTimeout(pressTimerRef.current);
    },
    [],
  );
  const clearPressTimer = () => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  // Wrapper-level handlers: the locked branch wraps its span in `Tooltip`,
  // which clones the child and overwrites onKeyDown / onClick / onTouch*
  // (see Tooltip.tsx). Catching the events on the bubble parent lets the
  // Tooltip own its child cloning while we still receive the unlock signals.
  const handleWrapperDoubleClick = () => {
    if (locked) onUnlock();
  };
  const handleWrapperKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (!locked) return;
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      onUnlock();
    }
  };
  const handleWrapperTouchStart = (_e: TouchEvent<HTMLSpanElement>) => {
    if (!locked) return;
    clearPressTimer();
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      onUnlock();
    }, 500);
  };
  const handleWrapperTouchEnd = () => clearPressTimer();
  const handleWrapperTouchCancel = () => clearPressTimer();
  const handleWrapperTouchMove = () => clearPressTimer();

  // Flash wrapper class — shared by both branches so the column width is
  // identical input ↔ span. The static colour class (bg-emerald-100 /
  // bg-rose-100) paints immediately on mount; the keyframe utility
  // `animate-vt-flash-fade` (defined in globals.css) then fades the
  // background to transparent over 1500ms. Under reduced motion the
  // keyframe is omitted and the colour stays solid for the 1500ms window
  // (matching the prefers-reduced-motion contract — no animated motion,
  // but the visual signal still arrives). The `key={flashNonce}` remount
  // restarts the animation on repeat-Tjek with identical keys.
  const flashBg =
    flash === 'correct' ? 'bg-emerald-100' : flash === 'wrong' ? 'bg-rose-100' : 'bg-transparent';
  // Emerald fades to transparent (locked input is bg-transparent → page bg
  // shows through both during and after the fade). Rose fades to white
  // (editable input is forced transparent during flash, so the wrapper
  // bleeds through; the input regains its native bg-white when flash clears
  // — fading the wrapper to white makes that transition seamless).
  const flashAnim =
    flash !== null && flashWithTransition
      ? flash === 'wrong'
        ? ' animate-vt-flash-fade-to-white'
        : ' animate-vt-flash-fade'
      : '';
  const flashClass = `rounded ${flashBg}${flashAnim}`;
  // ProtectedInput hardcodes `bg-white`, which would cover the wrapper's
  // rose flash on the unlocked branch. Force the input transparent for the
  // flash window so the wrapper's animated rose bleeds through and fades
  // alongside the keyframe (a static `!bg-rose-100` on the input would
  // *defeat* the animation — `!important` beats the keyframe's intermediate
  // values, so the colour would snap on/off instead of fading). The locked
  // branch's input is already `bg-transparent`, so the emerald flash works
  // the same way; this just makes the editable branch behave identically.
  const inputFlashClass = flash === 'wrong' && !locked ? ' !bg-transparent' : '';

  return (
    <div className="min-w-0" data-locked={locked ? 'true' : undefined}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600 sm:hidden">
        {label}
      </label>
      <span
        className="group/cell relative inline-block w-full"
        onDoubleClick={handleWrapperDoubleClick}
        onKeyDown={handleWrapperKeyDown}
        onTouchStart={handleWrapperTouchStart}
        onTouchEnd={handleWrapperTouchEnd}
        onTouchCancel={handleWrapperTouchCancel}
        onTouchMove={handleWrapperTouchMove}
      >
        <span key={flashNonce} className={`block w-full ${flashClass}`}>
          {locked ? (
            <Tooltip content={lockedTooltipContent} openDelayMs={500} fullWidth>
              <input
                id={id}
                type="text"
                value={value}
                readOnly
                aria-label={ariaLabel}
                tabIndex={0}
                className="block w-full cursor-default rounded border border-slate-200 bg-transparent px-3 py-1.5 text-sm text-slate-800 read-only:focus:outline-none read-only:focus:ring-1 read-only:focus:ring-slate-300"
                style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                onChange={() => {}}
              />
            </Tooltip>
          ) : (
            <HintPopup entries={info.popupEntries}>
              <ProtectedInput
                id={id}
                type="text"
                value={value}
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedBy}
                allowPaste={allowPaste}
                onChange={(e) => onChange(e.target.value)}
                onMouseDown={handleMouseDown}
                onKeyDown={handleInputKeyDown}
                className={`${inputClass}${inputFlashClass}`}
              />
            </HintPopup>
          )}
        </span>
        {showHintTicks && (
          // On focus-within (= popup is open) the container slides DOWN by 8 px
          // (bottom-0.5 → -bottom-1.5) and each pip grows from 6 px to 14 px,
          // so the pip top stays put while the bottom reaches the popup's top
          // edge (the popup is `top-full mt-1.5` = 6 px below the input). Net
          // effect: the pips become a visual bridge from input to hint box.
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2 bottom-0.5 flex gap-0.5 transition-all duration-150 group-focus-within/cell:-bottom-1.5"
          >
            {info.popupEntries.map((entry) => (
              <span
                key={`${id}-tick-${entry.key}`}
                className="block h-1.5 w-0.5 rounded-sm bg-amber-400 transition-all duration-150 group-focus-within/cell:h-3.5"
              />
            ))}
          </span>
        )}
      </span>
      {armedSpendable && (
        <span id={armedDescId} className="sr-only">
          {armedSpendableAriaDescription}
        </span>
      )}
    </div>
  );
}

/** In-widget Tjek button — dims when there's nothing to check (empty cells
 *  or no edits since the last Tjek). Never flashes: per F1, the only
 *  emerald-flash signal lives on the footer button at the moment the phase
 *  gate transitions to satisfied. */
function InWidgetTjekButton({
  onClick,
  label,
  dimReason,
  dimTooltip,
}: {
  onClick: () => void;
  label: string;
  dimReason: TjekDimReason;
  dimTooltip: string | undefined;
}) {
  const dimmed = dimReason !== null;
  const baseClass = 'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors';
  const stateClass = dimmed
    ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
    : 'bg-white border-accent-400 text-slate-700 hover:bg-accent-50';

  const button = (
    <button
      type="button"
      onClick={() => {
        if (dimmed) return;
        onClick();
      }}
      disabled={dimmed && dimTooltip == null}
      aria-disabled={dimTooltip != null || undefined}
      className={`${baseClass} ${stateClass}`}
    >
      {label}
    </button>
  );

  if (dimmed && dimTooltip != null) {
    return (
      <Tooltip content={dimTooltip} align="right" openDelayMs={500}>
        {button}
      </Tooltip>
    );
  }
  return button;
}
