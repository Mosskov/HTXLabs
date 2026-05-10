import type { Phase } from '@/lib/schema';

export type Mode = 'guided' | 'semi-guided' | 'open';
export type LabMode = 'virtual' | 'real';

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
  firedMilestones: Set<string>;
  dataPointCount: number;
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
}

interface SerializedRunnerState {
  experimentId: string;
  experimentVersion: number;
  mode: Mode;
  labMode: LabMode;
  currentPhaseId: string;
  visitedPhaseIds: string[];
  firedMilestones: string[];
  dataPointCount: number;
  widgetValues: Record<string, unknown>;
  dataTables: Record<string, DataRow[]>;
  attemptCounts: Record<string, number>;
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
    firedMilestones: new Set(),
    dataPointCount: 0,
    widgetValues: {},
    dataTables: {},
    attemptCounts: {},
  };
}

function serialize(state: RunnerState): SerializedRunnerState {
  return {
    ...state,
    visitedPhaseIds: Array.from(state.visitedPhaseIds),
    firedMilestones: Array.from(state.firedMilestones),
  };
}

function deserialize(raw: SerializedRunnerState): RunnerState {
  return {
    ...raw,
    visitedPhaseIds: new Set(raw.visitedPhaseIds ?? []),
    firedMilestones: new Set(raw.firedMilestones ?? []),
    widgetValues: raw.widgetValues ?? {},
    dataTables: raw.dataTables ?? {},
    attemptCounts: raw.attemptCounts ?? {},
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
