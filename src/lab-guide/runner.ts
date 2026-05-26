// Persistent runner state: shape, defaults, localStorage save/load, version compatibility.
import type { LabMode, Mode, Phase } from '@/lib/schema';
import type { VariableTableValues } from './widgets/VariableTable';

export type { LabMode, Mode };

/** Framework default for the per-phase request-driven hint pool. Author
 *  override is `phase.hintPoolSize`. */
export const DEFAULT_HINT_POOL_SIZE = 3;
/** Framework default for the active-phase hint replenish cadence (minutes).
 *  Author override is `phase.hintReplenishMinutes`; `0` disables. */
export const DEFAULT_HINT_REPLENISH_MINUTES = 2;

export interface DataRow {
  [columnKey: string]: string;
}

export interface RunnerState {
  experimentId: string;
  experimentVersion: number;
  mode: Mode;
  labMode: LabMode;
  currentPhaseId: string;
  visitedPhaseIds: Set<string>;
  /** Milestones fired during a given phase — keyed by phaseId. Sim-driven gates
   *  evaluate against the *current phase's* bucket so free-play exploration on
   *  phase 1 can't pre-satisfy gates for later phases. Predicate gates remain
   *  global because they read instantaneous sim state, not history. */
  firedMilestones: Record<string, Set<string>>;
  /** Data points collected during a given phase — keyed by phaseId. Same
   *  phase-scoping rationale as firedMilestones. */
  dataPointCount: Record<string, number>;
  /** Per-widget freeform value bag — text inputs, reflections, etc.
   *  Widgets MAY use `${id}:<suffix>` sibling keys for persisted ephemeral
   *  state that isn't the primary value (e.g. Quiz stores its last-checked
   *  option id under `${id}:checked`). This keeps registration pure-derived
   *  from persisted state so gates survive reload + remount. */
  widgetValues: Record<string, unknown>;
  /** Live data tables keyed by table id. */
  dataTables: Record<string, DataRow[]>;
  /** Attempt counts for widgets that limit retries. */
  attemptCounts: Record<string, number>;
  /** Last snapshot the active sim published via `onState`. Replayed back to
   *  the sim on remount as `initialState` so sim-owned UI (sim-mode DataTable
   *  mirror, "already done X" buttons) survives reload. `null` when no sim
   *  has published yet. */
  simulationState: unknown;
  /** Tier reached per RubricResponse widget per criterion. 0 = no hints
   *  surfaced yet; widget reveals hints[0..tier]. Incremented post-resolve
   *  in the widget for criteria still failing in the latest result. */
  rubricHintTiers: Record<string, Record<string, number>>;
  /** Per-RubricResponse one-way bit: `true` once the student has spent the
   *  2-token verdict reveal. Drives the ✓/✗ checklist section above the Tips
   *  panel. Never cleared by widget code — re-verdicts re-derive ✓/✗ from a
   *  fresh `result`, but the row set is frozen at spend time. */
  rubricVerdictsRevealed: Record<string, boolean>;
  /** Frozen snapshot of criterion ids covered by the verdict checklist for a
   *  given RubricResponse widget, captured at the moment of the reveal spend.
   *  This is the source of truth for which rows appear in the checklist —
   *  later edits that shift `failingCriteria` cannot add/remove rows once the
   *  reveal has been paid for. ✓/✗ for each row is derived live from the
   *  latest `result.criteria[id].satisfied`. */
  rubricVerdictRowIds: Record<string, string[]>;
  /** Tier reached per VariableTable widget per cell (dot-path key like
   *  `iv.<expectedIndex>.<cell>` — e.g. `iv.0.symbol`, `dv.1.unit`,
   *  `constants.0.name`). Mirrors `rubricHintTiers`. Incremented on Tjek
   *  click for cells that still have an error in the just-snapshotted values. */
  variableTableHintTiers: Record<string, Record<string, number>>;
  /** Per-VariableTable widget per-cell list of revealed paid hint *strings*.
   *  The reducer pushes the text surfaced at each spend (computed by the
   *  widget from the cell's ladder at spend-time), so later edits — including
   *  clearing the cell to retry — don't drop hints the student has paid for.
   *  `length` mirrors `variableTableHintTiers`'s counter for the same cellKey. */
  variableTableHintReveals: Record<string, Record<string, string[]>>;
  /** Snapshot of the values committed at the most recent Tjek per
   *  VariableTable widget. Absence means the widget has never been Tjek'd;
   *  the widget derives both `tjekStatus` and the published `correct` bit
   *  from this snapshot so reload preserves the checked state. */
  variableTableLastChecked: Record<string, VariableTableValues>;
  /** Per-VariableTable per-cell lock state. Set when Tjek confirms a cell as
   *  correct + filled; cleared on explicit student unlock (double-click /
   *  Enter/F2 / long-press). Keyed by `${section}.${expectedIndex}.${cell}`
   *  so locks track expected-row identity, not the student's render order.
   *  The widget's published `correct` bit and `sections` facet both derive
   *  from this slice. Empty per-widget maps are dropped on unlock to keep
   *  persisted state compact. */
  variableTableLocks: Record<string, Record<string, true>>;
  /** Per-phase current token count for the request-driven hint system.
   *  Absent = "never entered or never spent in this phase"; bucketView
   *  treats absence as `cap` (full) so first paint is correct without a
   *  seeding dispatch. Driven by `SPEND_AND_REVEAL_*` and `LAZY_REPLENISH`. */
  hintTokens: Record<string, number>;
  /** Per-phase ms-epoch anchor for replenishment math. `null`/absent means the
   *  timer is not running for that phase. `ANCHOR_HINT_TIMER` re-anchors on
   *  phase entry; spend actions re-anchor on the spend timestamp. */
  hintLastReplenishAt: Record<string, number | null>;
  /** Total hints spent in this lab so far — for a future "you used N hints"
   *  display widget. Reveal costs count as 2. */
  hintUsageTotal: number;
  /** Per-phase hint usage counter. Same accounting as `hintUsageTotal`. */
  hintUsageByPhase: Record<string, number>;
  /** Per-target hint usage counter — key is `${widgetId}::${criterionId|cellKey}`. */
  hintUsageByTarget: Record<string, number>;
}

interface SerializedRunnerState {
  experimentId: string;
  experimentVersion: number;
  mode: Mode;
  labMode: LabMode;
  currentPhaseId: string;
  visitedPhaseIds: string[];
  firedMilestones: Record<string, string[]>;
  dataPointCount: Record<string, number>;
  widgetValues: Record<string, unknown>;
  dataTables: Record<string, DataRow[]>;
  attemptCounts: Record<string, number>;
  simulationState: unknown;
  rubricHintTiers: Record<string, Record<string, number>>;
  rubricVerdictsRevealed?: Record<string, boolean>;
  rubricVerdictRowIds?: Record<string, string[]>;
  variableTableHintTiers: Record<string, Record<string, number>>;
  variableTableHintReveals?: Record<string, Record<string, string[]>>;
  variableTableLastChecked: Record<string, VariableTableValues>;
  variableTableLocks?: Record<string, Record<string, true>>;
  hintTokens?: Record<string, number>;
  hintLastReplenishAt?: Record<string, number | null>;
  hintUsageTotal?: number;
  hintUsageByPhase?: Record<string, number>;
  hintUsageByTarget?: Record<string, number>;
}

const storageKey = (experimentId: string) => `htxlabs:state:${experimentId}`;

export function emptyState(
  experimentId: string,
  experimentVersion: number,
  phases: Phase[],
  mode: Mode = 'guided',
  labMode: LabMode = 'virtual',
): RunnerState {
  const firstPhase = phases[0];
  return {
    experimentId,
    experimentVersion,
    mode,
    labMode,
    currentPhaseId: firstPhase ? firstPhase.id : '',
    visitedPhaseIds: firstPhase ? new Set([firstPhase.id]) : new Set(),
    firedMilestones: {},
    dataPointCount: {},
    widgetValues: {},
    dataTables: {},
    attemptCounts: {},
    simulationState: null,
    rubricHintTiers: {},
    rubricVerdictsRevealed: {},
    rubricVerdictRowIds: {},
    variableTableHintTiers: {},
    variableTableHintReveals: {},
    variableTableLastChecked: {},
    variableTableLocks: {},
    hintTokens: {},
    hintLastReplenishAt: {},
    hintUsageTotal: 0,
    hintUsageByPhase: {},
    hintUsageByTarget: {},
  };
}

function serialize(state: RunnerState): SerializedRunnerState {
  const firedMilestones: Record<string, string[]> = {};
  for (const [phaseId, set] of Object.entries(state.firedMilestones)) {
    firedMilestones[phaseId] = Array.from(set);
  }
  return {
    ...state,
    visitedPhaseIds: Array.from(state.visitedPhaseIds),
    firedMilestones,
  };
}

function deserialize(raw: SerializedRunnerState): RunnerState {
  const firedMilestones: Record<string, Set<string>> = {};
  for (const [phaseId, ids] of Object.entries(raw.firedMilestones ?? {})) {
    firedMilestones[phaseId] = new Set(ids);
  }
  return {
    ...raw,
    visitedPhaseIds: new Set(raw.visitedPhaseIds ?? []),
    firedMilestones,
    dataPointCount: raw.dataPointCount ?? {},
    widgetValues: raw.widgetValues ?? {},
    dataTables: raw.dataTables ?? {},
    attemptCounts: raw.attemptCounts ?? {},
    simulationState: raw.simulationState ?? null,
    rubricHintTiers: raw.rubricHintTiers ?? {},
    rubricVerdictsRevealed: raw.rubricVerdictsRevealed ?? {},
    rubricVerdictRowIds: raw.rubricVerdictRowIds ?? {},
    variableTableHintTiers: raw.variableTableHintTiers ?? {},
    variableTableHintReveals: raw.variableTableHintReveals ?? {},
    variableTableLastChecked: raw.variableTableLastChecked ?? {},
    variableTableLocks: raw.variableTableLocks ?? {},
    hintTokens: raw.hintTokens ?? {},
    hintLastReplenishAt: raw.hintLastReplenishAt ?? {},
    hintUsageTotal: raw.hintUsageTotal ?? 0,
    hintUsageByPhase: raw.hintUsageByPhase ?? {},
    hintUsageByTarget: raw.hintUsageByTarget ?? {},
  };
}

export function save(state: RunnerState): void {
  try {
    localStorage.setItem(storageKey(state.experimentId), JSON.stringify(serialize(state)));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — non-fatal.
  }
}

export function load(experimentId: string): RunnerState | null {
  try {
    const raw = localStorage.getItem(storageKey(experimentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializedRunnerState;
    return deserialize(parsed);
  } catch {
    return null;
  }
}

export function wipe(experimentId: string): void {
  try {
    localStorage.removeItem(storageKey(experimentId));
  } catch {
    // ignore
  }
}

/**
 * Validate a loaded state against the current frontmatter. Per spec §14, on any
 * mismatch we silently restart that lab's progress (auto-detect-and-restart).
 */
export function isStateCompatible(
  state: RunnerState,
  experimentVersion: number,
  phases: Phase[],
): boolean {
  if (state.experimentVersion !== experimentVersion) return false;
  if (!phases.some((p) => p.id === state.currentPhaseId)) return false;
  return true;
}
