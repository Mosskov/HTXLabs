// Student-facing variable identification widget: three sections (IV, DV,
// constants) × three cells (name, symbol, unit). Reactive — registers a
// `filled` widget state whenever IV+DV name+symbol cells are non-empty
// (and unit cells too, when `requireUnits` is true). Constants are
// repeatable and never required.
//
// The `values` facet on the registration lets sibling widgets read the
// committed symbols (the template hypothesis section interpolates them
// into its rubric prompt). Gate evaluators ignore `values`.
import { useRunner } from '../RunnerContext';
import { strings } from '../strings.da';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import { ProtectedInput } from './ProtectedInput';

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
  /** Per-instance label overrides (SPEC §17). Defaults live in strings.da.ts. */
  ivLabel?: string;
  dvLabel?: string;
  constantsLabel?: string;
  nameHeader?: string;
  symbolHeader?: string;
  unitHeader?: string;
  addConstantLabel?: string;
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

export function VariableTable({
  id,
  requireUnits = false,
  ivLabel,
  dvLabel,
  constantsLabel,
  nameHeader,
  symbolHeader,
  unitHeader,
  addConstantLabel,
}: Props) {
  const { state, setWidgetValue } = useRunner();
  const values = readValues(state.widgetValues[id]);
  const filled = entryFilled(values.iv, requireUnits) && entryFilled(values.dv, requireUnits);

  useRegisteredWidgetState(id, { kind: 'filled', filled, values }, [
    filled,
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

  const nameH = nameHeader ?? strings.widgets.variableTable.nameHeader;
  const symbolH = symbolHeader ?? strings.widgets.variableTable.symbolHeader;
  const unitH = unitHeader ?? strings.widgets.variableTable.unitHeader;

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
      />
      <VariableSection
        id={`${id}-dv`}
        label={dvLabel ?? strings.widgets.variableTable.dvLabel}
        entry={values.dv}
        onChange={updateDv}
        nameHeader={nameH}
        symbolHeader={symbolH}
        unitHeader={unitH}
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
            entry={c}
            onChange={(field, next) => updateConstant(i, field, next)}
            onRemove={() => removeConstant(i)}
            nameHeader={nameH}
            symbolHeader={symbolH}
            unitHeader={unitH}
            showHeaders={i === 0}
          />
        ))}
        <button
          type="button"
          onClick={addConstant}
          className="mt-2 text-sm font-medium text-accent hover:underline"
        >
          {addConstantLabel ?? strings.widgets.variableTable.addConstantLabel}
        </button>
      </div>
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
}

function VariableSection({
  id,
  label,
  entry,
  onChange,
  nameHeader,
  symbolHeader,
  unitHeader,
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
        />
        <Field
          id={`${id}-symbol`}
          label={symbolHeader}
          value={entry.symbol}
          onChange={(v) => onChange('symbol', v)}
        />
        <Field
          id={`${id}-unit`}
          label={unitHeader}
          value={entry.unit}
          onChange={(v) => onChange('unit', v)}
        />
      </div>
    </div>
  );
}

interface ConstantRowProps {
  id: string;
  entry: VariableEntry;
  onChange: (field: keyof VariableEntry, next: string) => void;
  onRemove: () => void;
  nameHeader: string;
  symbolHeader: string;
  unitHeader: string;
  showHeaders: boolean;
}

function ConstantRow({
  id,
  entry,
  onChange,
  onRemove,
  nameHeader,
  symbolHeader,
  unitHeader,
  showHeaders,
}: ConstantRowProps) {
  return (
    <div className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <Field
        id={`${id}-name`}
        label={showHeaders ? nameHeader : undefined}
        value={entry.name}
        onChange={(v) => onChange('name', v)}
      />
      <Field
        id={`${id}-symbol`}
        label={showHeaders ? symbolHeader : undefined}
        value={entry.symbol}
        onChange={(v) => onChange('symbol', v)}
      />
      <Field
        id={`${id}-unit`}
        label={showHeaders ? unitHeader : undefined}
        value={entry.unit}
        onChange={(v) => onChange('unit', v)}
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
  value: string;
  onChange: (next: string) => void;
}

function Field({ id, label, value, onChange }: FieldProps) {
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
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
    </div>
  );
}
