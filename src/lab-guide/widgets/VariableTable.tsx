// Student-facing variable identification widget: three sections (IV, DV,
// constants) × three cells (name, symbol, unit). Reactive — registers a
// `filled` widget state whenever IV+DV name+symbol cells are non-empty
// (and unit cells too, when `requireUnits` is true). Constants are
// repeatable and never required.
//
// The `values` facet on the registration lets sibling widgets read the
// committed symbols (the template hypothesis section interpolates them
// into its rubric prompt). Gate evaluators ignore `values`.
//
// Optional `expected` prop opts in to correctness checking + the Tjek
// flow: the widget publishes a `correct: boolean` bit + opaque `errors`
// payload, both consumed by the `all-validated` gate. The published
// `correct` bit is snapshot-gated on the most recent Tjek click — typing
// correct values without clicking Tjek keeps `correct: false`, and
// editing any cell after a passing Tjek flips it back to `false`. The
// matching logic lives in `variableTableCorrectness.ts` so this file
// stays presentation-focused.
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
  type VariableRowErrors,
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
  iv: VariableEntry;
  dv: VariableEntry;
  constants: VariableEntry[];
}

interface Props {
  id: string;
  /** When true, the `unit` cell on IV and DV must be filled for the widget
   *  to report `filled: true`. Default `false` because not all lab theories
   *  teach specific units; the template lab leaves this off. */
  requireUnits?: boolean;
  /** Optional author-supplied answer key. When set, the widget computes a
   *  `correct: boolean` + structured `errors` payload (in addition to the
   *  default `filled` bit) so an `all-validated` gate can require correct
   *  answers. Each cell in each expected entry is independently optional —
   *  the author validates only what they care about. */
  expected?: ExpectedVariables;
  /** Per-instance label overrides (SPEC §17). Defaults live in strings.da.ts. */
  ivLabel?: string;
  dvLabel?: string;
  constantsLabel?: string;
  nameHeader?: string;
  symbolHeader?: string;
  unitHeader?: string;
  addConstantLabel?: string;
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

function readValues(raw: unknown): VariableTableValues {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<VariableTableValues>;
    return {
      iv: { ...EMPTY, ...(r.iv ?? {}) },
      dv: { ...EMPTY, ...(r.dv ?? {}) },
      constants: Array.isArray(r.constants) ? r.constants.map((c) => ({ ...EMPTY, ...c })) : [],
    };
  }
  return { iv: { ...EMPTY }, dv: { ...EMPTY }, constants: [] };
}

function entryFilled(e: VariableEntry, requireUnits: boolean): boolean {
  const nameOk = e.name.trim().length > 0;
  const symbolOk = e.symbol.trim().length > 0;
  const unitOk = !requireUnits || e.unit.trim().length > 0;
  return nameOk && symbolOk && unitOk;
}

function valuesEqual(a: VariableTableValues, b: VariableTableValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
  ivLabel,
  dvLabel,
  constantsLabel,
  nameHeader,
  symbolHeader,
  unitHeader,
  addConstantLabel,
  checkLabel,
  idleStatusLabel,
  checkedStatusLabel,
  checkedWithErrorsStatusLabel,
  dirtyStatusLabel,
  allowPaste,
}: Props) {
  const { state, setWidgetValue, incrementVariableTableTier, setVariableTableLastChecked } =
    useRunner();
  const values = readValues(state.widgetValues[id]);
  const filled = entryFilled(values.iv, requireUnits) && entryFilled(values.dv, requireUnits);

  const errors: CorrectnessReport | undefined = expected
    ? evaluateTable(values, expected)
    : undefined;

  // Snapshot-gated `correct` (PL8): `correct: true` requires the current
  // values to deep-equal the last-Tjek snapshot AND to evaluate to no errors.
  // Without `expected`, `correct` stays undefined (back-compat).
  const lastChecked = state.variableTableLastChecked[id];
  const tjekStatus: 'idle' | 'checked' | 'dirty' =
    lastChecked === undefined ? 'idle' : valuesEqual(lastChecked, values) ? 'checked' : 'dirty';
  const correct =
    errors !== undefined ? filled && isCorrect(errors) && tjekStatus === 'checked' : undefined;

  // Dev-only author guard: warn if a constant has neither symbol nor name —
  // such an entry is silently skipped by evaluateConstants (never produces
  // `missing`), so without this warning a misauthored lab would look fine.
  if (import.meta.env.DEV && expected?.constants) {
    for (const c of expected.constants) {
      if (c.symbol === undefined && c.name === undefined) {
        console.warn(
          `[VariableTable id=${id}] expected.constants entry has neither symbol nor name — it will never match any student row.`,
        );
      }
    }
  }

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
    values.iv.name,
    values.iv.symbol,
    values.iv.unit,
    values.dv.name,
    values.dv.symbol,
    values.dv.unit,
    values.constants.map((c) => `${c.name}|${c.symbol}|${c.unit}`).join('§'),
  ]);

  function updateIv(field: keyof VariableEntry, next: string) {
    setWidgetValue(id, { ...values, iv: { ...values.iv, [field]: next } });
  }
  function updateDv(field: keyof VariableEntry, next: string) {
    setWidgetValue(id, { ...values, dv: { ...values.dv, [field]: next } });
  }
  function updateConstant(idx: number, field: keyof VariableEntry, next: string) {
    const constants = values.constants.map((c, i) => (i === idx ? { ...c, [field]: next } : c));
    setWidgetValue(id, { ...values, constants });
  }
  function addConstant() {
    setWidgetValue(id, { ...values, constants: [...values.constants, { ...EMPTY }] });
  }
  function removeConstant(idx: number) {
    setWidgetValue(id, { ...values, constants: values.constants.filter((_, i) => i !== idx) });
  }

  function handleTjek() {
    if (!expected || !errors) return;
    setVariableTableLastChecked(id, values);
    const cells: Cell[] = ['name', 'symbol', 'unit'];
    const bumpRow = (
      rowErrors: VariableRowErrors,
      rowExpected: { name?: CellSpec; symbol?: CellSpec; unit?: CellSpec },
      keyPrefix: string,
    ) => {
      for (const c of cells) {
        const err = rowErrors[c];
        if (!err) continue;
        const cap = maxTierForCell(err, rowExpected[c], c);
        if (cap <= 0) continue;
        incrementVariableTableTier(id, `${keyPrefix}.${c}`, cap);
      }
    };
    bumpRow(errors.iv, expected.iv, 'iv');
    bumpRow(errors.dv, expected.dv, 'dv');
    if (errors.constants && expected.constants) {
      for (const cm of errors.constants) {
        if (cm.status !== 'partial') continue;
        const rowExpected = expected.constants[cm.expectedIndex];
        if (!rowExpected) continue;
        bumpRow(cm.errors, rowExpected, `constants.${cm.expectedIndex}`);
      }
    }
  }

  // Hint resolution per cell — only when `expected` is set and the live
  // values match the most recent Tjek snapshot (tjekStatus === 'checked').
  // In `dirty` state, errors are recomputed from live values on every render,
  // so showing hints would leak answer guidance as the student types between
  // Tjek clicks. The tier counter survives reload so previously-revealed
  // hints keep showing after a refresh.
  const ivTiers = state.variableTableHintTiers[id] ?? {};
  const showHints = expected !== undefined && tjekStatus === 'checked';
  const ivHints = showHints
    ? rowHints(errors?.iv, expected.iv, (c) => ivTiers[`iv.${c}`] ?? 0)
    : { name: null, symbol: null, unit: null };
  const dvHints = showHints
    ? rowHints(errors?.dv, expected.dv, (c) => ivTiers[`dv.${c}`] ?? 0)
    : { name: null, symbol: null, unit: null };
  function constantRowHints(studentIndex: number): Record<Cell, string | null> {
    if (!showHints || !errors?.constants || !expected?.constants) {
      return { name: null, symbol: null, unit: null };
    }
    // Constants are order-independent: a ConstantMatch's expectedIndex and
    // studentIndex can differ. Hints render on the actual student row, so
    // look up by studentIndex, then resolve rowExp + tier key from the
    // match's expectedIndex (the persistent key used by handleTjek).
    const cm = errors.constants.find(
      (m) => m.status === 'partial' && m.studentIndex === studentIndex,
    );
    if (!cm || cm.status !== 'partial') return { name: null, symbol: null, unit: null };
    const rowExp = expected.constants[cm.expectedIndex];
    if (!rowExp) return { name: null, symbol: null, unit: null };
    return rowHints(cm.errors, rowExp, (c) => ivTiers[`constants.${cm.expectedIndex}.${c}`] ?? 0);
  }

  // Missing-constants list: one line per expected constant the student has
  // not added. Only surfaced after a Tjek click (tjekStatus === 'checked')
  // so the message doesn't appear before the student has asked for feedback.
  const missingConstantMessages: string[] = [];
  if (showHints && errors?.constants && expected?.constants) {
    for (const cm of errors.constants) {
      if (cm.status !== 'missing') continue;
      const exp = expected.constants[cm.expectedIndex];
      if (!exp) continue;
      missingConstantMessages.push(
        format(strings.widgets.variableTable.hints.constantMissing, {
          name: cellAcceptedValues(exp.name)?.[0] ?? '',
          symbol: cellAcceptedValues(exp.symbol)?.[0] ?? '',
          unit: cellAcceptedValues(exp.unit)?.[0] ?? '',
        }),
      );
    }
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

  return (
    <div className="my-4 space-y-4">
      <VariableSection
        id={`${id}-iv`}
        label={ivLabel ?? strings.widgets.variableTable.ivLabel}
        entry={values.iv}
        onChange={updateIv}
        nameHeader={nameH}
        symbolHeader={symbolH}
        unitHeader={unitH}
        hints={ivHints}
        allowPaste={allowPaste}
      />
      <VariableSection
        id={`${id}-dv`}
        label={dvLabel ?? strings.widgets.variableTable.dvLabel}
        entry={values.dv}
        onChange={updateDv}
        nameHeader={nameH}
        symbolHeader={symbolH}
        unitHeader={unitH}
        hints={dvHints}
        allowPaste={allowPaste}
      />
      <div className="rounded-md border border-slate-200 p-3">
        <div className="mb-2 text-sm font-medium text-slate-800">
          {constantsLabel ?? strings.widgets.variableTable.constantsLabel}
        </div>
        {values.constants.map((c, i) => (
          <ConstantRow
            // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity of a constants row
            key={i}
            id={`${id}-c${i}`}
            rowIndex={i}
            entry={c}
            onChange={(field, next) => updateConstant(i, field, next)}
            onRemove={() => removeConstant(i)}
            nameHeader={nameH}
            symbolHeader={symbolH}
            unitHeader={unitH}
            showHeaders={i === 0}
            hints={constantRowHints(i)}
            allowPaste={allowPaste}
          />
        ))}
        {missingConstantMessages.length > 0 && (
          <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {missingConstantMessages.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={addConstant}
          className="mt-2 text-sm font-medium text-accent hover:underline"
        >
          {addConstantLabel ?? strings.widgets.variableTable.addConstantLabel}
        </button>
      </div>
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

interface SectionProps {
  id: string;
  label: string;
  entry: VariableEntry;
  onChange: (field: keyof VariableEntry, next: string) => void;
  nameHeader: string;
  symbolHeader: string;
  unitHeader: string;
  hints: Record<Cell, string | null>;
  allowPaste?: boolean;
}

function VariableSection({
  id,
  label,
  entry,
  onChange,
  nameHeader,
  symbolHeader,
  unitHeader,
  hints,
  allowPaste,
}: SectionProps) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          id={`${id}-name`}
          label={nameHeader}
          value={entry.name}
          onChange={(v) => onChange('name', v)}
          hint={hints.name}
          allowPaste={allowPaste}
        />
        <Field
          id={`${id}-symbol`}
          label={symbolHeader}
          value={entry.symbol}
          onChange={(v) => onChange('symbol', v)}
          hint={hints.symbol}
          allowPaste={allowPaste}
        />
        <Field
          id={`${id}-unit`}
          label={unitHeader}
          value={entry.unit}
          onChange={(v) => onChange('unit', v)}
          hint={hints.unit}
          allowPaste={allowPaste}
        />
      </div>
    </div>
  );
}

interface ConstantRowProps {
  id: string;
  rowIndex: number;
  entry: VariableEntry;
  onChange: (field: keyof VariableEntry, next: string) => void;
  onRemove: () => void;
  nameHeader: string;
  symbolHeader: string;
  unitHeader: string;
  showHeaders: boolean;
  hints: Record<Cell, string | null>;
  allowPaste?: boolean;
}

function ConstantRow({
  id,
  rowIndex,
  entry,
  onChange,
  onRemove,
  nameHeader,
  symbolHeader,
  unitHeader,
  showHeaders,
  hints,
  allowPaste,
}: ConstantRowProps) {
  // When headers are hidden (rows 2+), each input still needs a programmatic
  // label so screen readers don't announce three anonymous text fields.
  const rowAria = (header: string) => `Konstant ${rowIndex + 1}, ${header}`;
  return (
    <div className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
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
      <button
        type="button"
        onClick={onRemove}
        aria-label={strings.widgets.variableTable.removeConstantAriaLabel}
        className={`${showHeaders ? 'mt-5' : ''} self-start rounded px-2 py-1 text-sm text-slate-500 hover:text-red-600`}
      >
        ×
      </button>
    </div>
  );
}

interface FieldProps {
  id: string;
  label?: string;
  /** Programmatic label used when no visual `label` is rendered (repeated
   *  constant rows). Either `label` or `ariaLabel` should be set so the input
   *  is never anonymous to assistive tech. */
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
