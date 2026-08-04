// Shared VariableTable types plus pure value plumbing: bounds resolution,
// rehydration of persisted widget values, filled/empty predicates, and
// expected-array clamping with dev-only authoring warnings.
import type { Cell } from './variableTableCorrectness';

export type Section = 'iv' | 'dv' | 'constants';

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

export interface Bounds {
  min: number;
  max: number;
}

export const EMPTY: VariableEntry = { name: '', symbol: '', unit: '' };

export const CELLS: readonly Cell[] = ['name', 'symbol', 'unit'];

export function cellKey(section: Section, expectedIndex: number, cell: Cell): string {
  return `${section}.${expectedIndex}.${cell}`;
}

export function resolveBounds(config: SectionConfig | undefined, fallback: Bounds): Bounds {
  if (config === undefined) return fallback;
  if ('count' in config) return { min: config.count, max: config.count };
  return { min: config.min, max: config.max };
}

export const DEFAULT_IV_BOUNDS: Bounds = { min: 1, max: 1 };
export const DEFAULT_DV_BOUNDS: Bounds = { min: 1, max: 1 };
export const DEFAULT_CONSTANTS_BOUNDS: Bounds = { min: 0, max: Number.POSITIVE_INFINITY };

export function emptyRows(n: number): VariableEntry[] {
  const finite = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return Array.from({ length: finite }, () => ({ ...EMPTY }));
}

export function readRows(raw: unknown, min: number): VariableEntry[] {
  if (Array.isArray(raw)) {
    const rows = raw.map((c) => ({ ...EMPTY, ...(c as Partial<VariableEntry>) }));
    while (rows.length < min) rows.push({ ...EMPTY });
    return rows;
  }
  return emptyRows(min);
}

export function readValues(
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

export function entryFilled(e: VariableEntry, requireUnits: boolean): boolean {
  const nameOk = e.name.trim().length > 0;
  const symbolOk = e.symbol.trim().length > 0;
  const unitOk = !requireUnits || e.unit.trim().length > 0;
  return nameOk && symbolOk && unitOk;
}

export function entryEmpty(e: VariableEntry): boolean {
  return e.name.trim() === '' && e.symbol.trim() === '' && e.unit.trim() === '';
}

export function sectionFilled(
  rows: VariableEntry[],
  bounds: Bounds,
  requireUnits: boolean,
): boolean {
  if (rows.length < bounds.min) return false;
  if (Number.isFinite(bounds.max) && rows.length > bounds.max) return false;
  return rows.every((r) => entryFilled(r, requireUnits));
}

/** Deep-equality via JSON. Used to detect per-section dirty state for paid-hint
 *  reveal-vs-edit gating + the free-diagnostic gate. `correct` no longer
 *  depends on this — locks own the correctness contract. */
export function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Truncate an expected array to `max` entries, warning in dev when the
 *  author oversupplied (a permanent-lock authoring failure — the student
 *  physically cannot render enough rows). */
export function clampExpected<T>(
  widgetId: string,
  section: Section,
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
export function warnMalformed(
  widgetId: string,
  section: Section,
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
