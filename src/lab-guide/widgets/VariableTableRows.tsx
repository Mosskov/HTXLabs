// One VariableTable section (heading, rows, empty state, missing-row messages,
// add affordance) and one repeatable row (three Fields plus the remove button
// on a shared grid template, so every row lines up under the single header
// band).
import type { ReactNode } from 'react';
import { format } from '../strings.da';
import { Field } from './VariableTableField';
import type { Cell } from './variableTableCorrectness';
import type { CellHintInfo } from './variableTableHints';
import type { Bounds, VariableEntry } from './variableTableValues';

export interface RowGroupProps {
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
  /** Render-time resolution of a locked cell's store lock key (or null if
   *  the cell isn't currently locked). Field snapshots this at edit-session
   *  start to avoid re-resolution drift on blur. */
  getLockKey: (studentIndex: number, cell: Cell) => string | null;
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
  onUnlock: (lockKey: string) => void;
}

export function RowGroupSection({
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
  getLockKey,
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
          lockKey={{
            name: getLockKey(i, 'name'),
            symbol: getLockKey(i, 'symbol'),
            unit: getLockKey(i, 'unit'),
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
          onUnlock={onUnlock}
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

export interface RepeatableRowProps {
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
  /** Store lock key per cell — string when locked, null otherwise. Field
   *  snapshots it at edit-session start; see `lockKeyForStudent`. */
  lockKey: Record<Cell, string | null>;
  flash: Record<Cell, 'correct' | 'wrong' | null>;
  flashNonce: number;
  flashWithTransition: boolean;
  lockedTooltipContent: ReactNode;
  /** Already-resolved sr-only description for an armed-spendable cell. */
  armedSpendableAriaDescription: string;
  allowPaste?: boolean;
  armed: boolean;
  onSpend: (cell: Cell) => void;
  onUnlock: (lockKey: string) => void;
}

export function RepeatableRow({
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
  lockKey,
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
        lockKey={lockKey.name}
        flash={flash.name}
        flashNonce={flashNonce}
        flashWithTransition={flashWithTransition}
        lockedTooltipContent={lockedTooltipContent}
        armedSpendableAriaDescription={armedSpendableAriaDescription}
        allowPaste={allowPaste}
        armed={armed}
        onSpend={() => onSpend('name')}
        onUnlock={onUnlock}
      />
      <Field
        id={`${id}-symbol`}
        label={symbolHeader}
        ariaLabel={rowAria(symbolHeader)}
        value={entry.symbol}
        onChange={(v) => onChange('symbol', v)}
        info={info.symbol}
        locked={locked.symbol}
        lockKey={lockKey.symbol}
        flash={flash.symbol}
        flashNonce={flashNonce}
        flashWithTransition={flashWithTransition}
        lockedTooltipContent={lockedTooltipContent}
        armedSpendableAriaDescription={armedSpendableAriaDescription}
        allowPaste={allowPaste}
        armed={armed}
        onSpend={() => onSpend('symbol')}
        onUnlock={onUnlock}
      />
      <Field
        id={`${id}-unit`}
        label={unitHeader}
        ariaLabel={rowAria(unitHeader)}
        value={entry.unit}
        onChange={(v) => onChange('unit', v)}
        info={info.unit}
        locked={locked.unit}
        lockKey={lockKey.unit}
        flash={flash.unit}
        flashNonce={flashNonce}
        flashWithTransition={flashWithTransition}
        lockedTooltipContent={lockedTooltipContent}
        armedSpendableAriaDescription={armedSpendableAriaDescription}
        allowPaste={allowPaste}
        armed={armed}
        onSpend={() => onSpend('unit')}
        onUnlock={onUnlock}
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
