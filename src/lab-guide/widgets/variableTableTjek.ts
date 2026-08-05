// Pure Tjek derivations for VariableTable: the per-cell lock/unlock/flash diff
// a Tjek click produces, and the reason the Tjek button is dimmed. No DOM and
// no store access — the component owns both.
import type {
  CellSpec,
  CorrectnessReport,
  RowMatch,
  VariableRowErrors,
} from './variableTableCorrectness';
import {
  CELLS,
  type Section,
  type VariableTableValues,
  cellKey,
  entryEmpty,
} from './variableTableValues';

/** Flash payload after a Tjek click. Cell keys (expectedIndex-addressed) map
 *  to the colour for their 1.5s flash. `nonce` re-mounts the wrapper so a
 *  repeat-Tjek re-triggers the CSS transition. `withTransition: false` honours
 *  `prefers-reduced-motion: reduce` — the colour still paints for 1.5s, the
 *  fade is suppressed. */
export interface FlashPayload {
  keys: Record<string, 'correct' | 'wrong'>;
  nonce: number;
  withTransition: boolean;
}

/** Reason the Tjek button is dimmed (and clicking it is a no-op):
 *   - `'empty'`  — no values entered anywhere, so a Tjek would just report
 *                  uniformly empty cells.
 *   - `'clean'`  — every section's snapshot still matches the values, so a
 *                  re-Tjek would produce the same verdict as the prior click.
 *  `null` means the button is armed.  */
export type TjekDimReason = 'empty' | 'clean' | null;

export type SectionExpected = ReadonlyArray<{
  name?: CellSpec;
  symbol?: CellSpec;
  unit?: CellSpec;
}>;

export function computeTjekOutcome(input: {
  values: VariableTableValues;
  errors: CorrectnessReport;
  expected: Record<Section, SectionExpected>;
  locks: Record<string, boolean>;
}): {
  newlyLocked: string[];
  newlyUnlocked: string[];
  flashKeys: Record<string, 'correct' | 'wrong'>;
} {
  const { values, errors, expected, locks } = input;

  const newlyLocked: string[] = [];
  const newlyUnlocked: string[] = [];
  const flashKeys: Record<string, 'correct' | 'wrong'> = {};

  const sectionData: Array<{
    section: Section;
    expectedArr: SectionExpected;
    matches: RowMatch[] | undefined;
  }> = [
    { section: 'iv', expectedArr: expected.iv, matches: errors.iv },
    { section: 'dv', expectedArr: expected.dv, matches: errors.dv },
    {
      section: 'constants',
      expectedArr: expected.constants,
      matches: errors.constants,
    },
  ];

  for (const { section, expectedArr, matches } of sectionData) {
    if (!matches) continue;
    for (const m of matches) {
      if (m.status === 'missing') continue;
      const exp = expectedArr[m.expectedIndex];
      const studentRow = values[section][m.studentIndex];
      if (!exp || !studentRow) continue;
      for (const cell of CELLS) {
        if (exp[cell] === undefined) continue;
        const k = cellKey(section, m.expectedIndex, cell);
        const value = studentRow[cell].trim();
        const hadLock = locks[k] === true;
        const isCellCorrect =
          m.status === 'matched' ||
          (m.status === 'partial' && (m.errors as VariableRowErrors)[cell] === undefined);

        // Empty cells are always ignored for flash/wrong-state per the
        // task rule. Stale locks on a now-empty value are dropped silently.
        if (value === '') {
          if (hadLock) newlyUnlocked.push(k);
          continue;
        }
        if (hadLock && isCellCorrect) continue;
        if (hadLock && !isCellCorrect) {
          // Stale-lock cleanup: drop the lock + rose-flash the regression.
          newlyUnlocked.push(k);
          flashKeys[k] = 'wrong';
          continue;
        }
        if (isCellCorrect) {
          newlyLocked.push(k);
          flashKeys[k] = 'correct';
        } else {
          flashKeys[k] = 'wrong';
        }
      }
    }
  }

  return { newlyLocked, newlyUnlocked, flashKeys };
}

// Tjek-dim derivation. When `expected` is not set the Tjek button isn't
// rendered at all, so the dim reason is moot — keep it `null` so any
// downstream consumer sees an armed default.
export function deriveTjekDimReason(
  values: VariableTableValues,
  sectionChecked: Record<Section, boolean>,
  lastCheckedExists: boolean,
  hasExpected: boolean,
): TjekDimReason {
  const valuesAllEmpty =
    values.iv.every(entryEmpty) &&
    values.dv.every(entryEmpty) &&
    values.constants.every(entryEmpty);
  const allSectionsClean =
    lastCheckedExists && sectionChecked.iv && sectionChecked.dv && sectionChecked.constants;
  return !hasExpected ? null : valuesAllEmpty ? 'empty' : allSectionsClean ? 'clean' : null;
}
