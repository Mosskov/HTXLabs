// Pure hint resolution for VariableTable: per-cell ladder cap and next spendable
// tier, popup entries (free diagnostics + already-paid reveals), the live
// spendable-target count, spend-payload resolution, and missing-row messages.
// Paid reveals ignore the clean-section gate; everything else respects it.
import { format, strings } from '../strings.da';
import type { HintPopupEntry } from './HintPopup';
import {
  type Cell,
  type CellError,
  type CorrectnessReport,
  type RowMatch,
  type VariableRowErrors,
  cellAcceptedValues,
  maxTierForCell,
  resolveLadder,
} from './variableTableCorrectness';
import type { SectionExpected } from './variableTableTjek';
import { CELLS, type Section, type VariableTableValues, cellKey } from './variableTableValues';

/** Compact per-cell info aggregated for the row renderer. `cap === 0` means
 *  no hint ladder for this cell (e.g. `empty` error with no author hints) —
 *  the cell is not a spend target / `nextTier` stays `null`. `freeDiagnostic`
 *  is the case-mismatch / whitespace-internal text (no token cost).
 *  `popupEntries` holds the revealed-tier paid hints for the focus popup. */
export interface CellHintInfo {
  cap: number;
  /** Next tier a spend click would unlock (1..cap). `null` when no advance is
   *  possible (cap reached or no error). */
  nextTier: number | null;
  freeDiagnostic: string | null;
  popupEntries: HintPopupEntry[];
}

export const EMPTY_CELL_INFO: CellHintInfo = {
  cap: 0,
  nextTier: null,
  freeDiagnostic: null,
  popupEntries: [],
};

export function freeDiagnosticFor(err: CellError | undefined, cell: Cell): string | null {
  if (!err) return null;
  if (err.type !== 'case-mismatch' && err.type !== 'whitespace-internal') return null;
  const tableHints = strings.widgets.variableTable.hints[cell] as
    | Record<string, readonly string[] | undefined>
    | undefined;
  const ladder = tableHints?.[err.type] ?? [];
  return ladder[0] ?? null;
}

/** Component state threaded into the pure hint helpers below, replacing the
 *  closed-over `expected` / `tiers` / `reveals` / `sectionClean` reads.
 *  `hasExpected` replaces an `expected === undefined` check — do not re-derive
 *  it from an expected array's length, since an author can legitimately
 *  configure `expected` with empty section arrays. */
export interface HintCtx {
  hasExpected: boolean;
  tiers: Record<string, number>;
  reveals: Record<string, string[]>;
  sectionClean: Record<Section, boolean>;
}

export function cellInfoFor(
  ctx: HintCtx,
  section: Section,
  sectionExpected: SectionExpected,
  matches: RowMatch[] | undefined,
  studentIndex: number,
  cell: Cell,
): CellHintInfo {
  if (!ctx.hasExpected) return EMPTY_CELL_INFO;
  // Try to pair the student row to its expected row via the current matcher.
  // If the cell has been cleared or the row dropped out of `partial`, cm is
  // undefined — we still want to surface previously-revealed paid strings.
  // Fall back to `expectedIndex = studentIndex` (correct for the single-row
  // sections that are the default; multi-row sections that reshuffle pairing
  // are a known limitation).
  const cm = matches?.find((m) => m.status === 'partial' && m.studentIndex === studentIndex);
  const expectedIndex = cm?.expectedIndex ?? studentIndex;
  const k = cellKey(section, expectedIndex, cell);
  const revealsForCell = ctx.reveals[k] ?? [];

  let cap = 0;
  let nextTier: number | null = null;
  let freeDiagnostic: string | null = null;
  const popupEntries: HintPopupEntry[] = [];

  if (cm && cm.status === 'partial') {
    const rowExp = sectionExpected[cm.expectedIndex];
    const err: CellError | undefined = rowExp ? (cm.errors as VariableRowErrors)[cell] : undefined;
    if (rowExp && err) {
      const cellSpec = rowExp[cell];
      cap = maxTierForCell(err, cellSpec, cell);
      const tier = ctx.tiers[k] ?? 0;
      // Spend target only armed on a clean section — spending mid-edit
      // would charge the student for a hint about an error type that may
      // shift on the next keystroke.
      nextTier = ctx.sectionClean[section] && cap > 0 && tier < cap ? tier + 1 : null;
      // Free diagnostic only surfaces on a clean section — it diagnoses
      // the live value, so showing it mid-edit would be noisy.
      if (ctx.sectionClean[section]) {
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

export function countSpendable(
  ctx: HintCtx,
  values: VariableTableValues,
  errors: CorrectnessReport,
  expected: Record<Section, SectionExpected>,
): number {
  let spendableCount = 0;
  for (const { section, expectedArr, matches } of [
    { section: 'iv' as const, expectedArr: expected.iv, matches: errors.iv },
    { section: 'dv' as const, expectedArr: expected.dv, matches: errors.dv },
    { section: 'constants' as const, expectedArr: expected.constants, matches: errors.constants },
  ]) {
    if (!matches) continue;
    const studentRows = values[section];
    for (let s = 0; s < studentRows.length; s++) {
      for (const cell of CELLS) {
        if (cellInfoFor(ctx, section, expectedArr, matches, s, cell).nextTier !== null) {
          spendableCount++;
        }
      }
    }
  }
  return spendableCount;
}

export function resolveSpend(
  ctx: HintCtx,
  section: Section,
  sectionExpected: SectionExpected | undefined,
  matches: RowMatch[] | undefined,
  studentIndex: number,
  cell: Cell,
): { cellKey: string; revealedText: string; hintCap: number } | null {
  if (!sectionExpected) return null;
  if (!matches) return null;
  const cm = matches.find((m) => m.status === 'partial' && m.studentIndex === studentIndex);
  if (!cm || cm.status !== 'partial') return null;
  const rowExp = sectionExpected[cm.expectedIndex];
  if (!rowExp) return null;
  const err: CellError | undefined = (cm.errors as VariableRowErrors)[cell];
  if (!err) return null;
  const cellSpec = rowExp[cell];
  const cap = maxTierForCell(err, cellSpec, cell);
  if (cap <= 0) return null;
  // Compute the hint text at spend-time from the current (F7-sliced) ladder
  // and pass it to the reducer. The text is then stored in
  // `variableTableHintReveals` so subsequent edits — including clearing the
  // cell — don't drop the paid string.
  const k = cellKey(section, cm.expectedIndex, cell);
  const currentTier = ctx.tiers[k] ?? 0;
  if (currentTier >= cap) return null;
  const ladder = resolveLadder(err, cellSpec, cell);
  const revealedText = ladder[currentTier];
  if (revealedText === undefined) return null;
  return { cellKey: k, revealedText, hintCap: cap };
}

export function missingMessagesFor(
  ctx: HintCtx,
  section: Section,
  sectionExpected: SectionExpected | undefined,
  matches: RowMatch[] | undefined,
  template: string,
): string[] {
  if (!ctx.sectionClean[section] || !matches || !sectionExpected) return [];
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
