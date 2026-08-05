// Pure matching helpers + error taxonomy for VariableTable correctness checking.
// Internal to the VariableTable widget — not exported via widgets/index.ts or
// mdx.ts. The gate engine sees only the `correct: boolean` projection; the
// structured error payload is opaque (`unknown`) to gates.ts.
//
// Matching contract:
// - Trim leading/trailing whitespace only — no internal-whitespace collapse
//   on the primary match (the `whitespace-internal` refinement opts in).
// - Names: case-insensitive (toLowerCase); plain Danish case-folding suffices.
// - Symbols/units: case-sensitive; case-only mismatch reported separately.
// - All three sections (IV, DV, constants) match order-independently via the
//   shared `evaluateRowGroup` helper. Five sub-passes per section: full match
//   > exact-key partial > case-insensitive-key partial > best-similarity
//   partial (any configured cell matches) > positional fallback. The
//   similarity pass handles the "name + unit right, symbol wrong" case
//   without falling through to positional and pinning unrelated rows
//   together. The positional fallback still runs for whatever stayed
//   unpaired after similarity — preserving the legacy single-row-IV/DV
//   per-cell-empty errors and the multi-row cross-section row-swap
//   refinement. Each student row is used at most once. Matching key is
//   `symbol` if set, else `name`. Malformed entries (neither set) are
//   silently dropped — never produce `missing`, so a misauthored lab
//   cannot permanently lock the gate. The widget warns in dev separately.
//
// Error precedence (each cell reports its first hit):
//   1. exact match            → undefined
//   2. case-mismatch          (symbol/unit only)
//   3. misplaced              sibling cell of same row matches
//   4. row-swapped            corresponding cell of OPPOSITE section matches (IV↔DV)
//   5. common-mistake         author-supplied wrong-answer list
//   6. whitespace-internal    match after collapsing internal whitespace
//   7. mismatch               fallthrough
//
// `evaluateCell` produces only kinds 1, 2, 7 (and `empty`). Refinement into
// kinds 3–6 happens at the row-group level via `refineCellError`, where the
// full row + opposite-section expected context is available. Cross-section
// row-swap detection (kind 4) considers every opposite-section expected
// entry's corresponding cell — for arrays-on-both-sides, any opposite match
// triggers the flag.
import { strings } from '../strings.da';
import type { VariableEntry } from './variableTableValues';

export type Cell = 'name' | 'symbol' | 'unit';

export interface CommonMistake {
  wrong: string | string[];
  kind: string;
  hint?: string;
}

export type CommonMistakes = Partial<Record<Cell, CommonMistake[]>>;

/** Per-cell answer-key form. String-shorthand and array-shorthand keep the
 *  existing accepted-value behavior; the object form lets the author attach
 *  per-cell tiered hints that extend the generic ladder (see `resolveLadder`).
 *  All forms normalize to `{ accepted, hints? }` at evaluation boundaries. */
export type CellSpec = string | string[] | { accepted: string | string[]; hints?: string[] };

export interface ExpectedVariable {
  name?: CellSpec;
  symbol?: CellSpec;
  unit?: CellSpec;
  commonMistakes?: CommonMistakes;
}

// Constants must have at least one matching key. TS-level enforcement; the
// runtime helper still defensively skips malformed entries as a safety net.
export type ExpectedConstant =
  | {
      symbol: CellSpec;
      name?: CellSpec;
      unit?: CellSpec;
      commonMistakes?: CommonMistakes;
    }
  | {
      name: CellSpec;
      symbol?: CellSpec;
      unit?: CellSpec;
      commonMistakes?: CommonMistakes;
    };

/** Author-side spec for one of the three sections. IV/DV accept a single-
 *  object shorthand or an array; constants is always an array. */
export interface ExpectedVariables {
  iv?: ExpectedVariable | ExpectedVariable[];
  dv?: ExpectedVariable | ExpectedVariable[];
  constants?: ExpectedConstant[];
}

export type CellError =
  | { type: 'empty' }
  | { type: 'mismatch' }
  | { type: 'case-mismatch' }
  | { type: 'misplaced'; from: Cell }
  | { type: 'row-swapped'; from: 'iv' | 'dv' }
  | { type: 'common-mistake'; kind: string; hint?: string }
  | { type: 'whitespace-internal' };

export interface VariableRowErrors {
  name?: CellError;
  symbol?: CellError;
  unit?: CellError;
}

/** One match result inside an `evaluateRowGroup` output array. Uniform across
 *  IV, DV, and constants sections. `ConstantMatch` is retained as an alias for
 *  external callers (the ErrorInspector consumes it). */
export type RowMatch =
  | { status: 'missing'; expectedIndex: number }
  | { status: 'matched'; expectedIndex: number; studentIndex: number }
  | {
      status: 'partial';
      expectedIndex: number;
      studentIndex: number;
      errors: VariableRowErrors;
    };

/** Back-compat alias — same shape as RowMatch. */
export type ConstantMatch = RowMatch;

export interface CorrectnessReport {
  iv: RowMatch[];
  dv: RowMatch[];
  constants?: RowMatch[];
}

const CELLS: readonly Cell[] = ['name', 'symbol', 'unit'];

export function asArray(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v];
}

/** Normalize an `iv` / `dv` / `constants` author-spec to an array. Returns
 *  `[]` for undefined, `[spec]` for a single object, or `spec` for an array. */
export function asExpectedArray<T>(spec: T | T[] | undefined): T[] {
  if (spec === undefined) return [];
  return Array.isArray(spec) ? spec : [spec];
}

/** Normalize a CellSpec to its accepted-value array. Handles all three
 *  shorthand forms (string, string[], { accepted, hints? }). */
export function cellAcceptedValues(spec: CellSpec | undefined): string[] | undefined {
  if (spec === undefined) return undefined;
  if (typeof spec === 'string') return [spec];
  if (Array.isArray(spec)) return spec;
  return asArray(spec.accepted);
}

/** Author-supplied per-cell hints from a CellSpec — empty array for the
 *  string / string[] shorthand forms. */
export function cellAuthorHints(spec: CellSpec | undefined): string[] {
  if (spec === undefined || typeof spec === 'string' || Array.isArray(spec)) return [];
  return spec.hints ?? [];
}

function isCaseSensitive(cell: Cell): boolean {
  return cell !== 'name';
}

function cellAccepted(exp: ExpectedVariable | ExpectedConstant, cell: Cell): string[] | undefined {
  return cellAcceptedValues(exp[cell]);
}

/** True iff `value` (trimmed) matches any accepted form using the given
 *  case rule. Each accepted form is also trimmed. */
function valueMatches(value: string, accepted: string[], caseSensitive: boolean): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (caseSensitive) return accepted.some((a) => a.trim() === trimmed);
  const lower = trimmed.toLowerCase();
  return accepted.some((a) => a.trim().toLowerCase() === lower);
}

/** True iff `value` matches any accepted form after collapsing internal
 *  whitespace on both sides. Used for the `whitespace-internal` refinement
 *  (e.g. student typed `m / s²` for `m/s²`). */
function valueMatchesAfterCollapse(
  value: string,
  accepted: string[],
  caseSensitive: boolean,
): boolean {
  const collapsed = value.trim().replace(/\s+/g, '');
  if (collapsed.length === 0) return false;
  if (caseSensitive) {
    return accepted.some((a) => a.trim().replace(/\s+/g, '') === collapsed);
  }
  const lower = collapsed.toLowerCase();
  return accepted.some((a) => a.trim().replace(/\s+/g, '').toLowerCase() === lower);
}

/** Returns undefined when the cell is not under check (accepted=undefined),
 *  or when the value matches one of the accepted forms. */
export function evaluateCell(
  value: string,
  accepted: string[] | undefined,
  caseSensitive: boolean,
): CellError | undefined {
  if (accepted === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return { type: 'empty' };

  if (caseSensitive) {
    if (accepted.some((a) => a.trim() === trimmed)) return undefined;
    const lower = trimmed.toLowerCase();
    if (accepted.some((a) => a.trim().toLowerCase() === lower)) {
      return { type: 'case-mismatch' };
    }
    return { type: 'mismatch' };
  }

  const lower = trimmed.toLowerCase();
  if (accepted.some((a) => a.trim().toLowerCase() === lower)) return undefined;
  return { type: 'mismatch' };
}

export interface RefineContext {
  cell: Cell;
  rowExpected: ExpectedVariable | ExpectedConstant;
  /** Opposite-section expected entries for cross-row swap detection. For IV
   *  refinement, these are the DV expected entries (and vice versa). Empty /
   *  undefined disables row-swap detection (constants case). */
  otherRowExpecteds?: ReadonlyArray<ExpectedVariable | ExpectedConstant>;
  /** Label of the opposite section, used in the `row-swapped` payload. */
  otherRowLabel?: 'iv' | 'dv';
  /** Pre-resolved common-mistakes list for this cell. */
  commonMistakes?: CommonMistake[];
}

/** Refine a raw `mismatch` into the most specific kind that fits. Returns the
 *  input unchanged when it is not `mismatch`. Pure. Precedence follows the
 *  module-header chain. */
export function refineCellError(
  current: CellError | undefined,
  value: string,
  ctx: RefineContext,
): CellError | undefined {
  if (current?.type !== 'mismatch') return current;

  // 3. misplaced — value matches a *sibling* cell of the same row.
  for (const sibling of CELLS) {
    if (sibling === ctx.cell) continue;
    const accepted = cellAccepted(ctx.rowExpected, sibling);
    if (accepted === undefined) continue;
    if (valueMatches(value, accepted, isCaseSensitive(sibling))) {
      return { type: 'misplaced', from: sibling };
    }
  }

  // 4. row-swapped — value matches the *corresponding* cell of any expected
  // entry in the opposite section. With arrays on both sides, any opposite
  // match triggers the flag.
  if (
    ctx.otherRowExpecteds !== undefined &&
    ctx.otherRowExpecteds.length > 0 &&
    ctx.otherRowLabel !== undefined
  ) {
    for (const otherExp of ctx.otherRowExpecteds) {
      const accepted = cellAccepted(otherExp, ctx.cell);
      if (accepted === undefined) continue;
      if (valueMatches(value, accepted, isCaseSensitive(ctx.cell))) {
        return { type: 'row-swapped', from: ctx.otherRowLabel };
      }
    }
  }

  // 5. common-mistake — author-supplied wrong-answer list.
  if (ctx.commonMistakes !== undefined) {
    for (const cm of ctx.commonMistakes) {
      const wrongs = asArray(cm.wrong);
      if (valueMatches(value, wrongs, isCaseSensitive(ctx.cell))) {
        return cm.hint !== undefined
          ? { type: 'common-mistake', kind: cm.kind, hint: cm.hint }
          : { type: 'common-mistake', kind: cm.kind };
      }
    }
  }

  // 6. whitespace-internal — match after collapsing internal whitespace.
  const ownAccepted = cellAccepted(ctx.rowExpected, ctx.cell);
  if (
    ownAccepted !== undefined &&
    valueMatchesAfterCollapse(value, ownAccepted, isCaseSensitive(ctx.cell))
  ) {
    return { type: 'whitespace-internal' };
  }

  // 7. fallthrough — keep original mismatch.
  return current;
}

/** Apply `refineCellError` to each cell of a row. Mutates `errors` in place
 *  and returns it for chaining. */
function refineRow(
  errors: VariableRowErrors,
  entry: VariableEntry,
  rowExpected: ExpectedVariable | ExpectedConstant,
  otherRowExpecteds: ReadonlyArray<ExpectedVariable | ExpectedConstant> | undefined,
  otherRowLabel: 'iv' | 'dv' | undefined,
): VariableRowErrors {
  const commonMistakes = rowExpected.commonMistakes;
  for (const cell of CELLS) {
    const refined = refineCellError(errors[cell], entry[cell], {
      cell,
      rowExpected,
      otherRowExpecteds,
      otherRowLabel,
      commonMistakes: commonMistakes?.[cell],
    });
    if (refined === undefined) {
      delete errors[cell];
    } else {
      errors[cell] = refined;
    }
  }
  return errors;
}

export function hasNoRowErrors(errors: VariableRowErrors): boolean {
  return errors.name === undefined && errors.symbol === undefined && errors.unit === undefined;
}

export function evaluateRow(entry: VariableEntry, expected: ExpectedVariable): VariableRowErrors {
  const errors: VariableRowErrors = {};
  const name = evaluateCell(entry.name, cellAcceptedValues(expected.name), false);
  if (name) errors.name = name;
  const symbol = evaluateCell(entry.symbol, cellAcceptedValues(expected.symbol), true);
  if (symbol) errors.symbol = symbol;
  const unit = evaluateCell(entry.unit, cellAcceptedValues(expected.unit), true);
  if (unit) errors.unit = unit;
  return errors;
}

/** Returns the matching-key accepted values for an expected entry — symbol
 *  if set, else name. Returns undefined when neither is set (malformed entry,
 *  filtered out by evaluateRowGroup). */
function matchingKey(expected: ExpectedVariable | ExpectedConstant): string[] | undefined {
  if (expected.symbol !== undefined) return cellAcceptedValues(expected.symbol);
  if (expected.name !== undefined) return cellAcceptedValues(expected.name);
  return undefined;
}

/** Returns the student entry's value for the matching key (symbol if expected
 *  has symbol set; else name). */
function studentKey(entry: VariableEntry, expected: ExpectedVariable | ExpectedConstant): string {
  return expected.symbol !== undefined ? entry.symbol : entry.name;
}

export interface RowGroupOpts {
  /** Opposite-section expected entries for cross-row swap detection in IV/DV
   *  refinement. Pass `undefined` for the constants section. */
  opposite?: ReadonlyArray<ExpectedVariable | ExpectedConstant>;
  oppositeLabel?: 'iv' | 'dv';
}

/** Count of configured cells of `exp` whose accepted-value list contains the
 *  student row's same cell (trimmed, with the cell's case rule). Used by the
 *  best-similarity pass: ≥1 means the rows share at least one real value and
 *  are very likely the same intended entry. */
function similarityScore(row: VariableEntry, exp: ExpectedVariable | ExpectedConstant): number {
  let score = 0;
  for (const cell of CELLS) {
    const accepted = cellAccepted(exp, cell);
    if (accepted === undefined) continue;
    if (valueMatches(row[cell], accepted, isCaseSensitive(cell))) score++;
  }
  return score;
}

/** Match a list of student rows against a list of expected entries. Five
 *  passes: full → exact-key → case-insensitive-key → best-similarity →
 *  positional fallback. With Pass 2c covering similarity-based pairing,
 *  any misfilled row that shares at least one cell with an expected entry
 *  is paired there; only rows with no shared cell at all fall through to
 *  position. The positional fallback preserves the legacy single-IV/DV
 *  per-cell empty-error rendering for unfilled student rows. */
export function evaluateRowGroup(
  student: VariableEntry[],
  expected: ReadonlyArray<ExpectedVariable | ExpectedConstant>,
  opts: RowGroupOpts = {},
): RowMatch[] {
  // Work list: entries with a matching key. Malformed entries (neither symbol
  // nor name) drop out — they never produce `missing` and never pair.
  const work: Array<{
    idx: number;
    exp: ExpectedVariable | ExpectedConstant;
    key: string[];
  }> = [];
  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i];
    if (exp === undefined) continue;
    const key = matchingKey(exp);
    if (key === undefined) continue;
    work.push({ idx: i, exp, key });
  }

  const used = new Set<number>();
  const remaining = new Set(work.map((w) => w.idx));
  const result: RowMatch[] = [];

  // Pass 1 — full match: student row evaluates with no errors.
  for (const { idx, exp } of work) {
    for (let s = 0; s < student.length; s++) {
      if (used.has(s)) continue;
      const row = student[s];
      if (row === undefined) continue;
      if (hasNoRowErrors(evaluateRow(row, exp as ExpectedVariable))) {
        result.push({ status: 'matched', expectedIndex: idx, studentIndex: s });
        used.add(s);
        remaining.delete(idx);
        break;
      }
    }
  }

  // Pass 2a — exact key match (trimmed, case-sensitive on key).
  for (const { idx, exp, key } of work) {
    if (!remaining.has(idx)) continue;
    for (let s = 0; s < student.length; s++) {
      if (used.has(s)) continue;
      const row = student[s];
      if (row === undefined) continue;
      const sk = studentKey(row, exp).trim();
      if (key.some((k) => k.trim() === sk)) {
        result.push({
          status: 'partial',
          expectedIndex: idx,
          studentIndex: s,
          errors: refineRow(
            evaluateRow(row, exp as ExpectedVariable),
            row,
            exp,
            opts.opposite,
            opts.oppositeLabel,
          ),
        });
        used.add(s);
        remaining.delete(idx);
        break;
      }
    }
  }

  // Pass 2b — case-insensitive key match.
  for (const { idx, exp, key } of work) {
    if (!remaining.has(idx)) continue;
    for (let s = 0; s < student.length; s++) {
      if (used.has(s)) continue;
      const row = student[s];
      if (row === undefined) continue;
      const sk = studentKey(row, exp).trim().toLowerCase();
      if (key.some((k) => k.trim().toLowerCase() === sk)) {
        result.push({
          status: 'partial',
          expectedIndex: idx,
          studentIndex: s,
          errors: refineRow(
            evaluateRow(row, exp as ExpectedVariable),
            row,
            exp,
            opts.opposite,
            opts.oppositeLabel,
          ),
        });
        used.add(s);
        remaining.delete(idx);
        break;
      }
    }
  }

  // Pass 2c — best-similarity match: for each remaining expected, find the
  // unpaired student row with the highest similarityScore against it. Pair
  // the globally-highest score ≥ 1, repeat greedily. Handles the "right
  // name + unit, wrong symbol" case where Pass 2a/2b miss because the
  // primary-key cell doesn't match. Unique per (expected, student) — each
  // side is used at most once.
  while (true) {
    let best:
      | { idx: number; exp: ExpectedVariable | ExpectedConstant; s: number; score: number }
      | undefined;
    for (const { idx, exp } of work) {
      if (!remaining.has(idx)) continue;
      for (let s = 0; s < student.length; s++) {
        if (used.has(s)) continue;
        const row = student[s];
        if (row === undefined) continue;
        const score = similarityScore(row, exp);
        if (score < 1) continue;
        if (best === undefined || score > best.score) {
          best = { idx, exp, s, score };
        }
      }
    }
    if (best === undefined) break;
    const row = student[best.s];
    if (row === undefined) break;
    result.push({
      status: 'partial',
      expectedIndex: best.idx,
      studentIndex: best.s,
      errors: refineRow(
        evaluateRow(row, best.exp as ExpectedVariable),
        row,
        best.exp,
        opts.opposite,
        opts.oppositeLabel,
      ),
    });
    used.add(best.s);
    remaining.delete(best.idx);
  }

  // Pass 3 — positional fallback: pair each remaining student row (in order)
  // with the next remaining expected entry (in order). Preserves the legacy
  // single-IV/DV per-cell-empty errors (an unfilled student row still surfaces
  // per-cell empty/mismatch errors instead of degrading to `missing`) and
  // keeps the multi-row cross-section row-swap refinement reachable
  // (`opts.opposite` is consulted via refineRow). With Pass 2c covering
  // similarity-based pairing, the misfilled rows that used to land here are
  // already paired correctly — only rows with no shared cell at all fall
  // through to position.
  for (let s = 0; s < student.length; s++) {
    if (used.has(s)) continue;
    const row = student[s];
    if (row === undefined) continue;
    let next: { idx: number; exp: ExpectedVariable | ExpectedConstant } | undefined;
    for (const w of work) {
      if (remaining.has(w.idx)) {
        next = { idx: w.idx, exp: w.exp };
        break;
      }
    }
    if (!next) break;
    result.push({
      status: 'partial',
      expectedIndex: next.idx,
      studentIndex: s,
      errors: refineRow(
        evaluateRow(row, next.exp as ExpectedVariable),
        row,
        next.exp,
        opts.opposite,
        opts.oppositeLabel,
      ),
    });
    used.add(s);
    remaining.delete(next.idx);
  }

  // Whatever's still in remaining → missing.
  for (const { idx } of work) {
    if (remaining.has(idx)) {
      result.push({ status: 'missing', expectedIndex: idx });
    }
  }

  // Sort by expectedIndex for stable output order.
  result.sort((a, b) => a.expectedIndex - b.expectedIndex);
  return result;
}

/** Back-compat alias for the constants section's matcher. */
export function evaluateConstants(
  student: VariableEntry[],
  expected: ExpectedConstant[],
): RowMatch[] {
  return evaluateRowGroup(student, expected);
}

export interface TableValues {
  iv: VariableEntry[];
  dv: VariableEntry[];
  constants: VariableEntry[];
}

export function evaluateTable(values: TableValues, expected: ExpectedVariables): CorrectnessReport {
  const ivExpected = asExpectedArray(expected.iv);
  const dvExpected = asExpectedArray(expected.dv);
  const report: CorrectnessReport = {
    iv: evaluateRowGroup(values.iv, ivExpected, {
      opposite: dvExpected,
      oppositeLabel: 'dv',
    }),
    dv: evaluateRowGroup(values.dv, dvExpected, {
      opposite: ivExpected,
      oppositeLabel: 'iv',
    }),
  };
  if (expected.constants !== undefined) {
    report.constants = evaluateRowGroup(values.constants, expected.constants);
  }
  return report;
}

export function isCorrect(report: CorrectnessReport): boolean {
  for (const m of report.iv) {
    if (m.status !== 'matched') return false;
  }
  for (const m of report.dv) {
    if (m.status !== 'matched') return false;
  }
  if (report.constants) {
    for (const c of report.constants) {
      if (c.status !== 'matched') return false;
    }
  }
  return true;
}

/** Build the **paid** hint ladder for a (cell-kind, error) pair. Order:
 *    1. Generic ladder from `strings.widgets.variableTable.hints[cellKind][errorType]`.
 *       For `common-mistake`, the generic source is the `'mismatch'` ladder.
 *    2. If error is a `common-mistake` and the matched mistake has a `hint`,
 *       that hint replaces the first generic entry (`[hint, ...generic.slice(1)]`).
 *    3. Author hints from the CellSpec are appended at the end — they
 *       extend the ladder, they do not replace generic entries. Skipped for
 *       `empty` errors: an empty cell needs "type something here", not three
 *       levels of nuance about which value to type.
 *    4. For `case-mismatch` / `whitespace-internal` errors the first generic
 *       entry is already surfaced for FREE in the popup (see
 *       `freeDiagnosticFor` in variableTableHints.ts) — drop it from the paid
 *       ladder so spending a token never re-shows the same string.
 *  An empty ladder is legal and means "no paid hint to surface for this cell". */
export function resolveLadder(
  error: CellError,
  cellSpec: CellSpec | undefined,
  cellKind: Cell,
): string[] {
  const tableHints = strings.widgets.variableTable.hints[cellKind] as
    | Record<string, readonly string[] | undefined>
    | undefined;
  const genericKey = error.type === 'common-mistake' ? 'mismatch' : error.type;
  const rawGeneric: readonly string[] = tableHints?.[genericKey] ?? [];
  const freeGenericDropped =
    (error.type === 'case-mismatch' || error.type === 'whitespace-internal') &&
    rawGeneric.length > 0;
  const generic: readonly string[] = freeGenericDropped ? rawGeneric.slice(1) : rawGeneric;
  const author = error.type === 'empty' ? [] : cellAuthorHints(cellSpec);

  let base: string[] = [...generic];
  if (error.type === 'common-mistake' && error.hint !== undefined) {
    base = base.length > 0 ? [error.hint, ...base.slice(1)] : [error.hint];
  }
  return [...base, ...author];
}

/** Return the hint at `tier` (1-indexed) on the (cell-kind, error) ladder.
 *  Tier 0 → null (no hint surfaced yet). Tier beyond the ladder clamps to
 *  the last entry. Empty ladder → null at any tier. */
export function resolveCellHint(
  error: CellError,
  tier: number,
  cellSpec: CellSpec | undefined,
  cellKind: Cell,
): string | null {
  if (tier <= 0) return null;
  const ladder = resolveLadder(error, cellSpec, cellKind);
  if (ladder.length === 0) return null;
  return ladder[Math.min(tier - 1, ladder.length - 1)] ?? null;
}

/** Length of the resolved ladder — i.e. the maximum useful tier for this
 *  cell+error pair. The Tjek-button increment caps the tier counter at this
 *  value so the reducer stays idempotent once the ladder is exhausted. */
export function maxTierForCell(
  error: CellError,
  cellSpec: CellSpec | undefined,
  cellKind: Cell,
): number {
  return resolveLadder(error, cellSpec, cellKind).length;
}
