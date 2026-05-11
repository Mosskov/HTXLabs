// Author-callable measurement table: N columns (label/symbol/unit), numeric-only
// cells, "Add row" button, per-row clear. Registers {kind:'filled'} once at
// least `minRows` rows have every column parsed as a valid Danish number.
import { parseDK } from '@/lib/numbers';
import { type KeyboardEvent, useId } from 'react';
import { useRunner } from '../RunnerContext';
import type { DataRow } from '../runner';
import { strings } from '../strings.da';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import { ProtectedInput } from './ProtectedInput';

export interface DataTableColumn {
  /** Display label, e.g. "masse". */
  label: string;
  /** Optional symbol, rendered italic, e.g. "m". */
  symbol?: string;
  /** Optional unit, rendered in parens after the symbol, e.g. "kg". */
  unit?: string;
  /** Storage key; defaults to a slug of `label`. Must be unique per table. */
  key?: string;
}

interface Props {
  id: string;
  columns: DataTableColumn[];
  /** Initial visible row count. Default 6. The table never shrinks below this. */
  rows?: number;
  /** Minimum number of fully-filled rows for the gate to satisfy. */
  minRows: number;
  /** Caption rendered above the table. */
  caption?: string;
  /** Label on the "Add row" button. */
  addRowLabel?: string;
  /** ARIA label on the per-row delete (×) button. */
  deleteRowAriaLabel?: string;
  /** SEN accommodation — propagated to cell inputs to bypass paste-block. */
  allowPaste?: boolean;
}

// TODO: refine allowed-input formatting. Current filter accepts digits, comma,
// period, minus, plus Ctrl/Cmd shortcuts and navigation keys. Open questions:
// - Scientific notation (e/E + exponent)?
// - Reject multiple decimal separators / multiple minus signs at the source
//   instead of letting parseDK return NaN?
// - Per-column constraints (e.g. positive-only, integer-only) via column prop?
// - Auto-normalise '.' → ',' on blur to enforce Danish convention?

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

function resolveKeys(columns: DataTableColumn[]): string[] {
  return columns.map((c) => c.key ?? defaultKey(c.label));
}

/** Pad/truncate persisted rows to the visible row count for stable indexing. */
function materialize(persisted: DataRow[], visibleRowCount: number): DataRow[] {
  if (persisted.length === visibleRowCount) return persisted;
  const out: DataRow[] = [];
  for (let i = 0; i < visibleRowCount; i++) out.push(persisted[i] ?? {});
  return out;
}

function isRowFilled(row: DataRow, keys: string[]): boolean {
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

export function DataTable({
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

  const keys = resolveKeys(columns);
  const persisted = (state.dataTables[id] ?? []) as DataRow[];
  const visibleRowCount = Math.max(initialRows, persisted.length);
  const visibleRows = materialize(persisted, visibleRowCount);

  const filledRowCount = visibleRows.reduce((n, r) => (isRowFilled(r, keys) ? n + 1 : n), 0);
  const satisfied = filledRowCount >= minRows;

  useRegisteredWidgetState(id, { kind: 'filled', filled: satisfied }, [satisfied]);

  function commit(next: DataRow[]) {
    setDataTable(id, next);
  }

  function onCellChange(rowIndex: number, key: string, value: string) {
    const next = materialize(visibleRows, visibleRowCount).map((r) => ({ ...r }));
    next[rowIndex] = { ...next[rowIndex], [key]: value };
    commit(next);
  }

  function onAddRow() {
    commit([...materialize(visibleRows, visibleRowCount), {}]);
  }

  // Removes the row entirely. Locked when the table is at the initial-rows
  // floor so the visible row count can't dip below `initialRows`.
  function onDeleteRow(rowIndex: number) {
    if (visibleRowCount <= initialRows) return;
    const next = materialize(visibleRows, visibleRowCount).filter((_, i) => i !== rowIndex);
    commit(next);
  }

  const canDelete = visibleRowCount > initialRows;

  return (
    <figure className="my-4" aria-labelledby={captionId}>
      <figcaption id={captionId} className="text-sm font-medium text-slate-800 mb-2">
        {caption ?? strings.widgets.dataTable.caption}
      </figcaption>
      <table className="w-full border border-slate-300 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col, ci) => (
              <th
                key={keys[ci]}
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
        <tbody>
          {visibleRows.map((row, ri) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: row identity is positional — there is no stable id, and rows never reorder
            <tr key={ri} className="border-b border-slate-200 last:border-b-0">
              {columns.map((col, ci) => {
                const key = keys[ci];
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
