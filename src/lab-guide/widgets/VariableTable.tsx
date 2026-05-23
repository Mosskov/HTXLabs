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
// Optional `expected` prop opts in to correctness checking + the Tjek flow:
// the widget publishes a `correct: boolean` + opaque `errors` payload, both
// consumed by the `all-validated` gate. `expected.iv` / `expected.dv` accept
// either a single shorthand object (back-compat) OR an array; both normalise
// to an array internally and feed the same order-independent matcher used
// for constants. The published `correct` bit is snapshot-gated on the most
// recent Tjek click — typing correct values without clicking Tjek keeps
// `correct: false`, and editing any cell after a passing Tjek flips it back
// to `false`. The matching logic lives in `variableTableCorrectness.ts`.
//
// Hint system: when `expected` is set, the widget participates in the
// request-driven hint system. Auto-bump on Tjek is gone — students arm spend
// mode via the bucket and click a lightbulb on a failing cell to unlock its
// next tier. Free diagnostics (case-mismatch + whitespace-internal) appear in
// the focus popup without a token cost, gated on the same checked-and-not-
// dirty rule as paid hints.
import { useRef } from 'react';
import { useHintSpend } from '../HintSpendContext';
import { useRunner } from '../RunnerContext';
import { format, strings } from '../strings.da';
import { useRegisteredHintEligibility } from '../useRegisteredHintEligibility';
import { useRegisteredWidgetCheck } from '../useRegisteredWidgetCheck';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import type { WidgetCheck } from '../widgetCheck';
import { HintBucket } from './HintBucket';
import { HintLightbulb } from './HintLightbulb';
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
  isCorrect,
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
  /** Tjek button label override (SPEC §17). Only rendered when `expected`
   *  is provided. */
  checkLabel?: string;
  /** Opt in to driving the Tjek from the shared PhaseFooter button instead of
   *  the in-widget button. Meaningful only when `expected` is set; ignored in
   *  open mode (the in-widget button stays so free-advance keeps self-check).
   *  Default `false`. */
  checkInFooter?: boolean;
  /** SR-only aria label for a per-cell correctness confirmation announced on
   *  input focus after a passing Tjek. Vars: {field} = nameHeader / symbolHeader /
   *  unitHeader. */
  cellCorrectAriaLabel?: string;
  /** SR-only live-region announcement on full-success Tjek. Reuses existing
   *  Danish copy verbatim; exists only as the SPEC §17 override knob. */
  checkedAriaStatusLabel?: string;
  /** SEN accommodation — propagated to cell inputs to bypass paste-block. */
  allowPaste?: boolean;
}

const EMPTY: VariableEntry = { name: '', symbol: '', unit: '' };

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

function sectionFilled(rows: VariableEntry[], bounds: Bounds, requireUnits: boolean): boolean {
  if (rows.length < bounds.min) return false;
  if (Number.isFinite(bounds.max) && rows.length > bounds.max) return false;
  return rows.every((r) => entryFilled(r, requireUnits));
}

/** Deep-equality via JSON. Used for snapshot/dirty comparison — on the whole
 *  table and on individual section slices, so editing one section does not
 *  dirty its siblings. */
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

/** Per-cell correctness projection. A cell is `correct` iff:
 *   - the paired expected entry has that cell's `accepted` defined, AND
 *   - the row match is either `matched` (no errors at all) OR
 *     `partial` with no error on that specific cell.
 *  Cells without an expected `accepted` spec, and cells in `missing` matches
 *  or unmatched student rows, stay `false`. The Tjek-snapshot gating
 *  (`tjekStatus === 'checked'`) is applied at the caller site. */
function rowCorrect(
  match: RowMatch | undefined,
  rowExpected: { name?: CellSpec; symbol?: CellSpec; unit?: CellSpec } | undefined,
): Record<Cell, boolean> {
  const result: Record<Cell, boolean> = { name: false, symbol: false, unit: false };
  if (!match || !rowExpected) return result;
  if (match.status === 'missing') return result;
  const cells: Cell[] = ['name', 'symbol', 'unit'];
  for (const c of cells) {
    if (rowExpected[c] === undefined) continue;
    if (match.status === 'matched') {
      result[c] = true;
    } else if (match.errors[c] === undefined) {
      result[c] = true;
    }
  }
  return result;
}

/** Compact per-cell info aggregated for the row renderer. `cap === 0` means
 *  no hint ladder for this cell (e.g. `empty` error with no author hints) —
 *  no lightbulb is rendered. `freeDiagnostic` is the case-mismatch /
 *  whitespace-internal text (no token cost). `popupEntries` holds the
 *  revealed-tier paid hints for the focus popup. */
interface CellHintInfo {
  cap: number;
  /** Next tier the lightbulb would unlock (1..cap). `null` when no advance is
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
  checkLabel,
  checkInFooter = false,
  cellCorrectAriaLabel,
  checkedAriaStatusLabel,
  allowPaste,
}: Props) {
  const { state, setWidgetValue, spendAndRevealVtTier, setVariableTableLastChecked } = useRunner();
  const { spendMode } = useHintSpend();

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

  // Snapshot-gated correctness. The Tjek snapshot is the whole table, but
  // dirty-detection is PER SECTION: editing one section must not un-check a
  // sibling section that was validated earlier and is unchanged since. The
  // whole-table `correct` requires every section to still be checked (which
  // equals whole-table snapshot equality). Without `expected`, `correct`
  // stays undefined (back-compat).
  const lastChecked = state.variableTableLastChecked[id];
  const sectionChecked = {
    iv: lastChecked !== undefined && valuesEqual(lastChecked.iv, values.iv),
    dv: lastChecked !== undefined && valuesEqual(lastChecked.dv, values.dv),
    constants: lastChecked !== undefined && valuesEqual(lastChecked.constants, values.constants),
  };
  const allChecked = sectionChecked.iv && sectionChecked.dv && sectionChecked.constants;
  const correct = errors !== undefined ? filled && isCorrect(errors) && allChecked : undefined;

  // Per-section satisfaction facet for the instruction-box step tracker
  // (sibling-read; gate evaluators ignore it). With `expected`, a section
  // counts as satisfied only when it is filled, every row matched, and
  // unchanged since the last Tjek. Without `expected` it falls back to
  // presence (`filled`).
  const sectionMatched = (m: RowMatch[] | undefined): boolean =>
    m !== undefined && m.length > 0 && m.every((x) => x.status === 'matched');
  const sections = {
    iv: expected ? ivFilled && sectionMatched(errors?.iv) && sectionChecked.iv : ivFilled,
    dv: expected ? dvFilled && sectionMatched(errors?.dv) && sectionChecked.dv : dvFilled,
    constants:
      expected && constantsExpectedArr
        ? constantsFilled && sectionMatched(errors?.constants) && sectionChecked.constants
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

  // Tjek is now snapshot-only — no auto-tier-bump. Students must arm spend
  // mode and click a lightbulb to advance a cell's ladder.
  function handleTjek() {
    if (!expected || !errors) return;
    setVariableTableLastChecked(id, values);
  }

  // Footer-check opt-in: when `checkInFooter` is set (and `expected` exists,
  // and we're not in open mode), the in-widget Tjek button is suppressed and
  // the PhaseFooter drives `handleTjek` instead. The check object is stable;
  // we mutate it in place each render so the footer reads the latest closure.
  // VariableTable's check is synchronous — never disabled, never pending — so
  // the registration `revision` is a constant `0`.
  const footerActive = checkInFooter && expected !== undefined && state.mode !== 'open';
  const checkRef = useRef<WidgetCheck>({
    label: '',
    run: () => {},
    disabled: false,
    pending: false,
  });
  checkRef.current.label = checkLabel ?? strings.widgets.variableTable.checkLabel;
  checkRef.current.run = handleTjek;
  useRegisteredWidgetCheck(id, footerActive, checkRef, 0);

  const tiers = state.variableTableHintTiers[id] ?? {};
  const reveals = state.variableTableHintReveals?.[id] ?? {};
  // Per-section "clean snapshot" gate — Tjek was run and values haven't been
  // edited since. Used for live diagnostics + lightbulb (spending mid-edit
  // hides what the student is paying for). Revealed paid strings ignore this
  // gate — once spent, the hint is paid for and stays visible through every
  // subsequent edit, including clearing the cell to retry.
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
    const cellKey = `${section}.${expectedIndex}.${cell}`;
    const revealsForCell = reveals[cellKey] ?? [];

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
        const tier = tiers[cellKey] ?? 0;
        // Lightbulb only available on a clean section — spending mid-edit
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

  // Per-cell green is gated on the same per-section condition as hints:
  // `expected` set and the section unchanged since its last Tjek. Editing a
  // section flips its own cells back to `false`; sibling sections are
  // unaffected.
  function rowCorrectFor(
    section: 'iv' | 'dv' | 'constants',
    sectionExpected: ReadonlyArray<{
      name?: CellSpec;
      symbol?: CellSpec;
      unit?: CellSpec;
    }>,
    matches: RowMatch[] | undefined,
    studentIndex: number,
  ): Record<Cell, boolean> {
    if (!sectionClean[section] || !matches) return { name: false, symbol: false, unit: false };
    const cm = matches.find((m) => m.status !== 'missing' && m.studentIndex === studentIndex);
    if (!cm || cm.status === 'missing') return { name: false, symbol: false, unit: false };
    return rowCorrect(cm, sectionExpected[cm.expectedIndex]);
  }

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

  const allCorrect = errors !== undefined && filled && isCorrect(errors);
  const showAriaStatus = expected !== undefined && allChecked && allCorrect;
  const ariaStatusLabel =
    checkedAriaStatusLabel ?? strings.widgets.variableTable.checkedAriaStatusLabel;
  const resolvedCellCorrectAria =
    cellCorrectAriaLabel ?? strings.widgets.variableTable.cellCorrectAriaLabel;

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
    const cellKey = `${section}.${cm.expectedIndex}.${cell}`;
    const currentTier = tiers[cellKey] ?? 0;
    if (currentTier >= cap) return;
    const ladder = resolveLadder(err, cellSpec, cell);
    const revealedText = ladder[currentTier];
    if (revealedText === undefined) return;
    spendAndRevealVtTier({
      widgetId: id,
      cellKey,
      revealedText,
      hintCap: cap,
    });
  };

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
            getCorrect={(s) => rowCorrectFor('iv', ivExpectedArr, errors?.iv, s)}
            cellCorrectAriaLabel={resolvedCellCorrectAria}
            missingMessages={ivMissing}
            allowPaste={allowPaste}
            armed={armed}
            onSpend={(s, cell) => onSpendCell('iv', s, cell)}
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
            getCorrect={(s) => rowCorrectFor('dv', dvExpectedArr, errors?.dv, s)}
            cellCorrectAriaLabel={resolvedCellCorrectAria}
            missingMessages={dvMissing}
            allowPaste={allowPaste}
            armed={armed}
            onSpend={(s, cell) => onSpendCell('dv', s, cell)}
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
            getCorrect={(s) =>
              rowCorrectFor('constants', constantsExpectedArr ?? [], errors?.constants, s)
            }
            cellCorrectAriaLabel={resolvedCellCorrectAria}
            missingMessages={constantsMissing}
            allowPaste={allowPaste}
            armed={armed}
            onSpend={(s, cell) => onSpendCell('constants', s, cell)}
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
              <button
                type="button"
                onClick={handleTjek}
                className="rounded border border-accent bg-white px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/5"
              >
                {checkLabel ?? strings.widgets.variableTable.checkLabel}
              </button>
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
  getCorrect: (studentIndex: number) => Record<Cell, boolean>;
  cellCorrectAriaLabel: string;
  missingMessages: string[];
  allowPaste?: boolean;
  armed: boolean;
  onSpend: (studentIndex: number, cell: Cell) => void;
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
  getCorrect,
  cellCorrectAriaLabel,
  missingMessages,
  allowPaste,
  armed,
  onSpend,
}: RowGroupProps) {
  const canAdd = rows.length < bounds.max;
  const canRemove = rows.length > bounds.min;
  return (
    <div className="p-3">
      <div className="mb-2 text-sm font-semibold text-navy">{label}</div>
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
          correct={getCorrect(i)}
          cellCorrectAriaLabel={cellCorrectAriaLabel}
          allowPaste={allowPaste}
          armed={armed}
          onSpend={(cell) => onSpend(i, cell)}
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
          className="mt-2 text-sm font-medium text-accent hover:underline"
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
  correct: Record<Cell, boolean>;
  /** Template with {field} placeholder for the sr-only correctness aria label. */
  cellCorrectAriaLabel: string;
  allowPaste?: boolean;
  armed: boolean;
  onSpend: (cell: Cell) => void;
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
  correct,
  cellCorrectAriaLabel,
  allowPaste,
  armed,
  onSpend,
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
        correct={correct.name}
        correctAriaLabel={format(cellCorrectAriaLabel, { field: nameHeader })}
        allowPaste={allowPaste}
        armed={armed}
        onSpend={() => onSpend('name')}
      />
      <Field
        id={`${id}-symbol`}
        label={symbolHeader}
        ariaLabel={rowAria(symbolHeader)}
        value={entry.symbol}
        onChange={(v) => onChange('symbol', v)}
        info={info.symbol}
        correct={correct.symbol}
        correctAriaLabel={format(cellCorrectAriaLabel, { field: symbolHeader })}
        allowPaste={allowPaste}
        armed={armed}
        onSpend={() => onSpend('symbol')}
      />
      <Field
        id={`${id}-unit`}
        label={unitHeader}
        ariaLabel={rowAria(unitHeader)}
        value={entry.unit}
        onChange={(v) => onChange('unit', v)}
        info={info.unit}
        correct={correct.unit}
        correctAriaLabel={format(cellCorrectAriaLabel, { field: unitHeader })}
        allowPaste={allowPaste}
        armed={armed}
        onSpend={() => onSpend('unit')}
      />
      {hasRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={format(removeAriaLabel, { n: rowIndex + 1 })}
          className="self-start rounded px-2 py-1 text-sm text-slate-500 hover:text-red-600"
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
  /** True iff this cell was confirmed correct on the most recent Tjek (and
   *  the live value still matches the snapshot). Renders a subtle emerald
   *  ring on the input. */
  correct: boolean;
  /** Resolved sr-only label announced on focus when `correct === true`. */
  correctAriaLabel: string;
  allowPaste?: boolean;
  armed: boolean;
  onSpend: () => void;
}

function Field({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  info,
  correct,
  correctAriaLabel,
  allowPaste,
  armed,
  onSpend,
}: FieldProps) {
  const hasHint = info.popupEntries.length > 0 || info.freeDiagnostic !== null;
  const showGreen = correct && !hasHint;
  const inputClass = showGreen ? 'w-full ring-1 ring-emerald-300' : 'w-full';
  const ariaDescribedBy = showGreen ? `${id}-correct` : undefined;
  const showLightbulb = armed && info.nextTier !== null;
  return (
    <div className="min-w-0" data-correct={showGreen ? 'true' : undefined}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600 sm:hidden">
        {label}
      </label>
      <HintPopup entries={info.popupEntries}>
        <ProtectedInput
          id={id}
          type="text"
          value={value}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          allowPaste={allowPaste}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      </HintPopup>
      {showGreen && (
        <span id={`${id}-correct`} className="sr-only">
          {correctAriaLabel}
        </span>
      )}
      {showLightbulb && info.nextTier !== null && (
        <div className="mt-1">
          <HintLightbulb nextTier={info.nextTier} cap={info.cap} onSpend={onSpend} />
        </div>
      )}
    </div>
  );
}
