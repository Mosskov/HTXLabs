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
import { useRunner } from '../RunnerContext';
import { format, strings } from '../strings.da';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import { ProtectedInput } from './ProtectedInput';
import { TieredHintList } from './TieredHintList';
import {
  type Cell,
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
  resolveCellHint,
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
  /** Per-status pill copy overrides (SPEC §17). Only rendered when
   *  `expected` is provided. */
  idleStatusLabel?: string;
  checkedStatusLabel?: string;
  checkedWithErrorsStatusLabel?: string;
  dirtyStatusLabel?: string;
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

function valuesEqual(a: VariableTableValues, b: VariableTableValues): boolean {
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

/** Project a row's resolved hint per cell. Returns `null` for any cell
 *  with no error or no resolvable hint at the current tier. */
function rowHints(
  errors: VariableRowErrors | undefined,
  rowExpected: { name?: CellSpec; symbol?: CellSpec; unit?: CellSpec } | undefined,
  tierFor: (cellKind: Cell) => number,
): Record<Cell, string | null> {
  const result: Record<Cell, string | null> = { name: null, symbol: null, unit: null };
  if (!errors || !rowExpected) return result;
  const cells: Cell[] = ['name', 'symbol', 'unit'];
  for (const c of cells) {
    const err = errors[c];
    if (!err) continue;
    const tier = tierFor(c);
    if (tier <= 0) continue;
    result[c] = resolveCellHint(err, tier, rowExpected[c], c);
  }
  return result;
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
  idleStatusLabel,
  checkedStatusLabel,
  checkedWithErrorsStatusLabel,
  dirtyStatusLabel,
  allowPaste,
}: Props) {
  const { state, setWidgetValue, incrementVariableTableTier, setVariableTableLastChecked } =
    useRunner();

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

  // Snapshot-gated `correct`: requires the current values to deep-equal the
  // last-Tjek snapshot AND to evaluate to no errors. Without `expected`,
  // `correct` stays undefined (back-compat).
  const lastChecked = state.variableTableLastChecked[id];
  const tjekStatus: 'idle' | 'checked' | 'dirty' =
    lastChecked === undefined ? 'idle' : valuesEqual(lastChecked, values) ? 'checked' : 'dirty';
  const correct =
    errors !== undefined ? filled && isCorrect(errors) && tjekStatus === 'checked' : undefined;

  // Conditional spread: when `expected` is absent, omit the `correct`/`errors`
  // keys entirely (not `undefined`) so back-compat consumers can rely on
  // `'correct' in state` semantics.
  const widgetState =
    expected !== undefined
      ? ({ kind: 'filled', filled, correct, errors, values } as const)
      : ({ kind: 'filled', filled, values } as const);

  useRegisteredWidgetState(id, widgetState, [
    filled,
    correct ?? null,
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

  function handleTjek() {
    if (!expected || !errors) return;
    setVariableTableLastChecked(id, values);
    const cells: Cell[] = ['name', 'symbol', 'unit'];
    const bumpPartial = (
      cm: RowMatch,
      sectionPrefix: 'iv' | 'dv' | 'constants',
      sectionExpected: ReadonlyArray<{
        name?: CellSpec;
        symbol?: CellSpec;
        unit?: CellSpec;
      }>,
    ) => {
      if (cm.status !== 'partial') return;
      const rowExpected = sectionExpected[cm.expectedIndex];
      if (!rowExpected) return;
      for (const c of cells) {
        const err = cm.errors[c];
        if (!err) continue;
        const cap = maxTierForCell(err, rowExpected[c], c);
        if (cap <= 0) continue;
        incrementVariableTableTier(id, `${sectionPrefix}.${cm.expectedIndex}.${c}`, cap);
      }
    };
    for (const m of errors.iv) bumpPartial(m, 'iv', ivExpectedArr);
    for (const m of errors.dv) bumpPartial(m, 'dv', dvExpectedArr);
    if (errors.constants && constantsExpectedArr) {
      for (const m of errors.constants) bumpPartial(m, 'constants', constantsExpectedArr);
    }
  }

  // Hint resolution per cell — only when `expected` is set and the live
  // values match the most recent Tjek snapshot (tjekStatus === 'checked').
  // In `dirty` state, errors are recomputed from live values on every render,
  // so showing hints would leak answer guidance as the student types between
  // Tjek clicks. The tier counter survives reload so previously-revealed
  // hints keep showing after a refresh.
  const tiers = state.variableTableHintTiers[id] ?? {};
  const showHints = expected !== undefined && tjekStatus === 'checked';

  function rowHintsFor(
    section: 'iv' | 'dv' | 'constants',
    sectionExpected: ReadonlyArray<{
      name?: CellSpec;
      symbol?: CellSpec;
      unit?: CellSpec;
    }>,
    matches: RowMatch[] | undefined,
    studentIndex: number,
  ): Record<Cell, string | null> {
    if (!showHints || !matches) return { name: null, symbol: null, unit: null };
    const cm = matches.find((m) => m.status === 'partial' && m.studentIndex === studentIndex);
    if (!cm || cm.status !== 'partial') return { name: null, symbol: null, unit: null };
    const rowExp = sectionExpected[cm.expectedIndex];
    if (!rowExp) return { name: null, symbol: null, unit: null };
    return rowHints(cm.errors, rowExp, (c) => tiers[`${section}.${cm.expectedIndex}.${c}`] ?? 0);
  }

  function missingMessagesFor(
    sectionExpected:
      | ReadonlyArray<{ name?: CellSpec; symbol?: CellSpec; unit?: CellSpec }>
      | undefined,
    matches: RowMatch[] | undefined,
    template: string,
  ): string[] {
    if (!showHints || !matches || !sectionExpected) return [];
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

  const pill = expected
    ? renderPill({
        status: tjekStatus,
        allCorrect: errors !== undefined && filled && isCorrect(errors),
        labels: {
          idle: idleStatusLabel ?? strings.widgets.variableTable.status.idle,
          checked: checkedStatusLabel ?? strings.widgets.variableTable.status.checked,
          checkedWithErrors:
            checkedWithErrorsStatusLabel ?? strings.widgets.variableTable.status.checkedWithErrors,
          dirty: dirtyStatusLabel ?? strings.widgets.variableTable.status.dirty,
        },
      })
    : null;

  const ivMissing = missingMessagesFor(
    ivExpectedArr,
    errors?.iv,
    ivMissingMessage ?? strings.widgets.variableTable.hints.ivMissing,
  );
  const dvMissing = missingMessagesFor(
    dvExpectedArr,
    errors?.dv,
    dvMissingMessage ?? strings.widgets.variableTable.hints.dvMissing,
  );
  const constantsMissing = missingMessagesFor(
    constantsExpectedArr,
    errors?.constants,
    constantMissingMessage ?? strings.widgets.variableTable.hints.constantMissing,
  );

  return (
    <div className="my-4 space-y-4">
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
        getHints={(s) => rowHintsFor('iv', ivExpectedArr, errors?.iv, s)}
        missingMessages={ivMissing}
        allowPaste={allowPaste}
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
        getHints={(s) => rowHintsFor('dv', dvExpectedArr, errors?.dv, s)}
        missingMessages={dvMissing}
        allowPaste={allowPaste}
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
        rowAriaLabel={constantRowAriaLabel ?? strings.widgets.variableTable.constantRowAriaLabel}
        onChange={(idx, field, next) => updateRow('constants', idx, field, next)}
        onAdd={() => addRow('constants')}
        onRemove={(idx) => removeRow('constants', idx)}
        getHints={(s) => rowHintsFor('constants', constantsExpectedArr ?? [], errors?.constants, s)}
        missingMessages={constantsMissing}
        allowPaste={allowPaste}
      />
      {expected && (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleTjek}
            className="rounded bg-accent px-4 py-1.5 text-sm font-semibold text-white"
          >
            {checkLabel ?? strings.widgets.variableTable.checkLabel}
          </button>
          {pill && <span className={pill.className}>{pill.label}</span>}
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
  getHints: (studentIndex: number) => Record<Cell, string | null>;
  missingMessages: string[];
  allowPaste?: boolean;
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
  getHints,
  missingMessages,
  allowPaste,
}: RowGroupProps) {
  const canAdd = rows.length < bounds.max;
  const canRemove = rows.length > bounds.min;
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
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
          showHeaders={i === 0}
          removeAriaLabel={removeAriaLabel}
          hints={getHints(i)}
          allowPaste={allowPaste}
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
  showHeaders: boolean;
  removeAriaLabel: string;
  hints: Record<Cell, string | null>;
  allowPaste?: boolean;
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
  showHeaders,
  removeAriaLabel,
  hints,
  allowPaste,
}: RepeatableRowProps) {
  // When headers are hidden (rows 2+), each input still needs a programmatic
  // label so screen readers don't announce three anonymous text fields.
  const rowAria = (field: string) => format(rowAriaLabel, { n: rowIndex + 1, field });
  const hasRemove = onRemove !== undefined;
  const gridClass = hasRemove
    ? 'mb-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]'
    : 'mb-2 grid grid-cols-1 gap-3 sm:grid-cols-3';
  return (
    <div className={gridClass}>
      <Field
        id={`${id}-name`}
        label={showHeaders ? nameHeader : undefined}
        ariaLabel={showHeaders ? undefined : rowAria(nameHeader)}
        value={entry.name}
        onChange={(v) => onChange('name', v)}
        hint={hints.name}
        allowPaste={allowPaste}
      />
      <Field
        id={`${id}-symbol`}
        label={showHeaders ? symbolHeader : undefined}
        ariaLabel={showHeaders ? undefined : rowAria(symbolHeader)}
        value={entry.symbol}
        onChange={(v) => onChange('symbol', v)}
        hint={hints.symbol}
        allowPaste={allowPaste}
      />
      <Field
        id={`${id}-unit`}
        label={showHeaders ? unitHeader : undefined}
        ariaLabel={showHeaders ? undefined : rowAria(unitHeader)}
        value={entry.unit}
        onChange={(v) => onChange('unit', v)}
        hint={hints.unit}
        allowPaste={allowPaste}
      />
      {hasRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={format(removeAriaLabel, { n: rowIndex + 1 })}
          className={`${showHeaders ? 'mt-5' : ''} self-start rounded px-2 py-1 text-sm text-slate-500 hover:text-red-600`}
        >
          ×
        </button>
      )}
    </div>
  );
}

interface FieldProps {
  id: string;
  label?: string;
  /** Programmatic label used when no visual `label` is rendered (repeated
   *  rows). Either `label` or `ariaLabel` should be set so the input is never
   *  anonymous to assistive tech. */
  ariaLabel?: string;
  value: string;
  onChange: (next: string) => void;
  /** Resolved hint text shown directly below the input. `null` = no hint. */
  hint: string | null;
  allowPaste?: boolean;
}

function Field({ id, label, ariaLabel, value, onChange, hint, allowPaste }: FieldProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1">
          {label}
        </label>
      )}
      <ProtectedInput
        id={id}
        type="text"
        value={value}
        aria-label={ariaLabel}
        allowPaste={allowPaste}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
      {hint && (
        <TieredHintList variant="inline" failedHints={[{ key: `${id}-hint`, text: hint }]} />
      )}
    </div>
  );
}

interface PillArgs {
  status: 'idle' | 'checked' | 'dirty';
  allCorrect: boolean;
  labels: { idle: string; checked: string; checkedWithErrors: string; dirty: string };
}

function renderPill(args: PillArgs): { label: string; className: string } {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  if (args.status === 'idle') {
    return { label: args.labels.idle, className: `${base} bg-slate-100 text-slate-600` };
  }
  if (args.status === 'dirty') {
    return { label: args.labels.dirty, className: `${base} bg-amber-100 text-amber-900` };
  }
  // 'checked' — green when all correct, amber otherwise.
  if (args.allCorrect) {
    return { label: args.labels.checked, className: `${base} bg-green-100 text-green-800` };
  }
  return { label: args.labels.checkedWithErrors, className: `${base} bg-amber-100 text-amber-900` };
}
