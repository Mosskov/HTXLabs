// Author-callable measurement table. Two modes selected via the `source` prop:
//   - 'manual' (default): N numeric cells per row + Add/Delete; registers
//     {kind:'filled'} once `minRows` rows have every column parsed as a valid
//     Danish number, so an `all-filled` gate can fire.
//   - 'sim': read-only mirror of an array published by the active simulation
//     via `onState`. Path into sim state is given by `simDataPath`. No gate
//     registration — sim-mode tables pair with a phase-level `data-points`
//     (or `predicate`) gate, not `all-filled`.
import { formatDK, parseDK } from '@/lib/numbers';
import { type KeyboardEvent, useId } from 'react';
import { useRunner } from '../RunnerContext';
import type { DataRow } from '../runner';
import { format, strings } from '../strings.da';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import { ProtectedInput } from './ProtectedInput';

export interface DataTableColumn {
  /** Display label, e.g. "masse". */
  label: string;
  /** Optional symbol, rendered italic, e.g. "m". */
  symbol?: string;
  /** Optional unit, rendered in parens after the symbol, e.g. "kg". */
  unit?: string;
  /** Storage key; defaults to a slug of `label`. Must be unique per table.
   *  In sim mode this is the field name on each measurement object the sim
   *  publishes (e.g. `'x'` and `'y'`). */
  key?: string;
}

interface Props {
  id: string;
  columns: DataTableColumn[];
  /** Initial visible row count. Default 6. In manual mode the table never
   *  shrinks below this. In sim mode it's the placeholder row count shown
   *  before the sim has any measurements. */
  rows?: number;
  /** Manual mode only — minimum number of fully-filled rows for the gate to
   *  satisfy. Required when `source === 'manual'`. */
  minRows?: number;
  /** Caption rendered above the table. */
  caption?: string;
  /** Label on the "Add row" button (manual mode only). */
  addRowLabel?: string;
  /** ARIA label on the per-row delete (×) button (manual mode only). */
  deleteRowAriaLabel?: string;
  /** SEN accommodation — propagated to cell inputs to bypass paste-block. */
  allowPaste?: boolean;
  /** Recording source. Defaults to `'manual'`. */
  source?: 'manual' | 'sim';
  /** Sim mode only — dotted path into the sim's published state (via
   *  `onState`) that holds the measurement array. Each element is an object
   *  whose keys line up with the column keys. Required when `source === 'sim'`. */
  simDataPath?: string;
}

// Keys allowed even though they aren't numeric input — navigation, editing,
// IME, and Ctrl/Cmd shortcuts (so Ctrl+A / Ctrl+C / Ctrl+Z still work).
const ALLOWED_CONTROL_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Enter',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

function isNumericKey(e: KeyboardEvent<HTMLInputElement>): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (ALLOWED_CONTROL_KEYS.has(e.key)) return true;
  // Single printable character — only digits and number-shape punctuation.
  if (e.key.length === 1) return /[0-9.,\-]/.test(e.key);
  return true;
}

function defaultKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '-');
}

interface ResolvedColumn {
  col: DataTableColumn;
  key: string;
}

function resolveColumns(columns: DataTableColumn[]): ResolvedColumn[] {
  return columns.map((col) => ({ col, key: col.key ?? defaultKey(col.label) }));
}

/** Pad/truncate persisted rows to the visible row count for stable indexing. */
function materialize(persisted: DataRow[], visibleRowCount: number): DataRow[] {
  if (persisted.length === visibleRowCount) return persisted;
  const out: DataRow[] = [];
  for (let i = 0; i < visibleRowCount; i++) out.push(persisted[i] ?? {});
  return out;
}

function isRowFilled(row: DataRow, keys: ReadonlyArray<string>): boolean {
  return keys.every((k) => {
    const raw = row[k];
    if (typeof raw !== 'string' || raw.trim() === '') return false;
    return Number.isFinite(parseDK(raw));
  });
}

function isCellInvalid(value: string): boolean {
  if (value.trim() === '') return false;
  return !Number.isFinite(parseDK(value));
}

function ColumnHeaders({ columns }: { columns: ReadonlyArray<ResolvedColumn> }) {
  return (
    <thead className="bg-slate-50">
      <tr>
        {columns.map(({ col, key }) => (
          <th
            key={key}
            scope="col"
            className="px-3 py-2 text-center font-normal border-b border-slate-300"
          >
            <div className="text-slate-700">{col.label}</div>
            {(col.symbol || col.unit) && (
              <div className="text-slate-600 text-xs">
                {col.symbol && <em className="text-navy">{col.symbol}</em>}
                {col.symbol && col.unit && ' '}
                {col.unit && <span>({col.unit})</span>}
              </div>
            )}
          </th>
        ))}
        <th aria-hidden="true" className="w-8 border-b border-slate-300" />
      </tr>
    </thead>
  );
}

export function DataTable(props: Props) {
  const source = props.source ?? 'manual';
  return source === 'sim' ? <SimTable {...props} /> : <ManualTable {...props} />;
}

function ManualTable({
  id,
  columns,
  rows: initialRows = 6,
  minRows,
  caption,
  addRowLabel,
  deleteRowAriaLabel,
  allowPaste,
}: Props) {
  const { state, setDataTable } = useRunner();
  const captionId = useId();

  if (typeof minRows !== 'number') {
    throw new Error(`DataTable id="${id}" in manual mode requires a numeric \`minRows\` prop.`);
  }

  const resolvedColumns = resolveColumns(columns);
  const keys = resolvedColumns.map((c) => c.key);
  const persisted = state.dataTables[id] ?? [];
  const visibleRowCount = Math.max(initialRows, persisted.length);
  const visibleRows = materialize(persisted, visibleRowCount);

  const filledRowCount = visibleRows.reduce((n, r) => (isRowFilled(r, keys) ? n + 1 : n), 0);
  const satisfied = filledRowCount >= minRows;

  useRegisteredWidgetState(id, { kind: 'filled', filled: satisfied }, [satisfied]);

  function commit(next: DataRow[]) {
    setDataTable(id, next);
  }

  function onCellChange(rowIndex: number, key: string, value: string) {
    const next = visibleRows.map((r) => ({ ...r }));
    next[rowIndex] = { ...next[rowIndex], [key]: value };
    commit(next);
  }

  function onAddRow() {
    commit([...visibleRows, {}]);
  }

  // Removes the row entirely. Locked when the table is at the initial-rows
  // floor so the visible row count can't dip below `initialRows`.
  function onDeleteRow(rowIndex: number) {
    if (visibleRowCount <= initialRows) return;
    const next = visibleRows.filter((_, i) => i !== rowIndex);
    commit(next);
  }

  const canDelete = visibleRowCount > initialRows;

  return (
    <figure className="my-4" aria-labelledby={captionId}>
      <figcaption id={captionId} className="text-sm font-medium text-slate-800 mb-2">
        {caption ?? strings.widgets.dataTable.caption}
      </figcaption>
      <table className="w-full border border-slate-300 text-sm">
        <ColumnHeaders columns={resolvedColumns} />
        <tbody>
          {visibleRows.map((row, ri) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: row identity is positional — append-only growth and end-trim on delete, so positional keying is safe
            <tr key={ri} className="border-b border-slate-200 last:border-b-0">
              {resolvedColumns.map(({ col, key }) => {
                const value = row[key] ?? '';
                const invalid = isCellInvalid(value);
                return (
                  <td key={key} className="px-2 py-1">
                    <ProtectedInput
                      type="text"
                      inputMode="decimal"
                      value={value}
                      aria-label={`${col.label} række ${ri + 1}`}
                      aria-invalid={invalid || undefined}
                      allowPaste={allowPaste}
                      onKeyDown={(e) => {
                        if (!isNumericKey(e)) e.preventDefault();
                      }}
                      onChange={(e) => onCellChange(ri, key, e.target.value)}
                      className={`w-full text-center border-slate-200 ${invalid ? 'border-red-500 focus:ring-red-400' : ''}`}
                    />
                  </td>
                );
              })}
              <td className="px-1 py-1 text-center">
                <button
                  type="button"
                  onClick={() => onDeleteRow(ri)}
                  disabled={!canDelete}
                  aria-label={deleteRowAriaLabel ?? strings.widgets.dataTable.deleteRowAriaLabel}
                  className="text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed px-1"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={onAddRow}
        className="mt-2 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm"
      >
        {addRowLabel ?? strings.widgets.dataTable.addRow}
      </button>
    </figure>
  );
}

function SimTable({ id, columns, rows: initialRows = 6, caption, simDataPath }: Props) {
  const { simulationStateRef } = useRunner();
  const captionId = useId();

  if (!simDataPath) {
    throw new Error(`DataTable id="${id}" in sim mode requires a \`simDataPath\` prop.`);
  }

  const resolvedColumns = resolveColumns(columns);
  const simState = simulationStateRef.current as Record<string, unknown> | null;
  const rawRows = (simState?.[simDataPath] as Array<Record<string, unknown>> | undefined) ?? [];
  const visibleRowCount = Math.max(initialRows, rawRows.length);

  function renderCell(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) return formatDK(value, 2);
    if (typeof value === 'string') return value;
    return '';
  }

  return (
    <figure className="my-4" aria-labelledby={captionId}>
      <figcaption id={captionId} className="text-sm font-medium text-slate-800 mb-2">
        {caption ?? strings.widgets.dataTable.caption}
      </figcaption>
      <table
        className="w-full border border-slate-300 text-sm"
        aria-describedby={`${captionId}-count`}
      >
        <ColumnHeaders columns={resolvedColumns} />
        <tbody>
          {Array.from({ length: visibleRowCount }).map((_, ri) => {
            const row = rawRows[ri];
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: row identity is positional — append-only growth and end-trim on delete, so positional keying is safe
              <tr key={ri} className="border-b border-slate-200 last:border-b-0">
                {resolvedColumns.map(({ col, key }) => {
                  const text = row ? renderCell(row[key]) : '';
                  return (
                    <td
                      key={key}
                      className="px-3 py-2 text-center text-slate-800 tabular-nums"
                      aria-label={`${col.label} række ${ri + 1}`}
                    >
                      {text || <span className="text-slate-300">—</span>}
                    </td>
                  );
                })}
                <td aria-hidden="true" className="w-8" />
              </tr>
            );
          })}
        </tbody>
      </table>
      <p id={`${captionId}-count`} className="mt-2 text-xs text-slate-600">
        {rawRows.length === 0
          ? strings.widgets.dataTable.simEmpty
          : format(strings.widgets.dataTable.simModeCaption, { n: rawRows.length })}
      </p>
    </figure>
  );
}
