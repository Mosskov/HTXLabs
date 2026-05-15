// Persistent runner state: shape, defaults, localStorage save/load, version compatibility.
import type { LabMode, Mode, Phase } from '@/lib/schema';

export type { LabMode, Mode };

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
