// Pure lock-model resolution for VariableTable: whether a cell is
// locked-and-still-correct, studentIndex -> expectedIndex mapping for the
// render path, and per-section lock coverage. A lock alone is never enough —
// the current matcher report must still agree, so a stale lock cannot
// resurrect a satisfied gate.
import type { Cell, CellSpec, CorrectnessReport } from './variableTableCorrectness';
import { CELLS, type Section, cellKey } from './variableTableValues';

export type Locks = Record<string, boolean>;

// A cell is *locked-and-currently-correct* iff a lock entry exists for its
// expected-row key AND the current matcher report still pairs that expected
// row to a student row whose value passes for that cell. This is the
// single rule the `correct` aggregation + `sections` facet + per-row Field
// lock branch all consume.
export function cellLockedAndCorrect(
  locks: Locks,
  errors: CorrectnessReport | undefined,
  section: Section,
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
export function cellLockedForStudent(
  locks: Locks,
  errors: CorrectnessReport | undefined,
  section: Section,
  studentIndex: number,
  cell: Cell,
): boolean {
  const matches = errors?.[section];
  if (!matches) return false;
  const m = matches.find((x) => x.status !== 'missing' && x.studentIndex === studentIndex);
  if (!m || m.status === 'missing') return false;
  return cellLockedAndCorrect(locks, errors, section, m.expectedIndex, cell);
}

// Render-time resolution of a locked cell's store lock key. Returned to
// `Field` so it can snapshot the key at edit-session start — before any
// value change can shift the matcher pairing and re-resolve the studentIndex
// → expectedIndex link to a different expected row. Multi-row tables: the
// unlock-on-blur path would otherwise clear the wrong entry. Null when the
// cell isn't currently locked.
export function lockKeyForStudent(
  locks: Locks,
  errors: CorrectnessReport | undefined,
  section: Section,
  studentIndex: number,
  cell: Cell,
): string | null {
  const matches = errors?.[section];
  if (!matches) return null;
  const m = matches.find((x) => x.status !== 'missing' && x.studentIndex === studentIndex);
  if (!m || m.status === 'missing') return null;
  if (!cellLockedAndCorrect(locks, errors, section, m.expectedIndex, cell)) return null;
  return cellKey(section, m.expectedIndex, cell);
}

// Section-level lock coverage: every cell with `accepted` defined in the
// section's expected entries is locked-and-currently-correct. Used by both
// the `sections` facet and the published `correct`.
export function sectionFullyLockedCorrect(
  locks: Locks,
  errors: CorrectnessReport | undefined,
  section: Section,
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
      if (!cellLockedAndCorrect(locks, errors, section, i, cell)) covered = false;
    }
  }
  return { covered, configured };
}
