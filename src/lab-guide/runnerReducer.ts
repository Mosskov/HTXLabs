// Pure state machine for the LabGuide runner. Side effects (persistence, refs,
// localStorage) live in RunnerContext.tsx; the reducer only produces state.

import type { DataRow, LabMode, Mode, RunnerState } from './runner';

export type RunnerAction =
  | { type: 'SET_CURRENT_PHASE'; id: string }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_LAB_MODE'; labMode: LabMode }
  | { type: 'SET_WIDGET_VALUE'; id: string; value: unknown }
  | { type: 'SET_DATA_TABLE'; id: string; rows: DataRow[] }
  | { type: 'BUMP_ATTEMPTS'; id: string }
  | { type: 'FIRE_MILESTONE'; id: string }
  | { type: 'INCREMENT_DATA_POINTS'; count: number }
  | { type: 'RESET'; nextState: RunnerState };

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case 'SET_CURRENT_PHASE': {
      const visited = new Set(state.visitedPhaseIds);
      visited.add(action.id);
      return { ...state, currentPhaseId: action.id, visitedPhaseIds: visited };
    }
    case 'SET_MODE':
      return { ...state, mode: action.mode };
    case 'SET_LAB_MODE':
      return { ...state, labMode: action.labMode };
    case 'SET_WIDGET_VALUE':
      return {
        ...state,
        widgetValues: { ...state.widgetValues, [action.id]: action.value },
      };
    case 'SET_DATA_TABLE':
      return {
        ...state,
        dataTables: { ...state.dataTables, [action.id]: action.rows },
      };
    case 'BUMP_ATTEMPTS':
      return {
        ...state,
        attemptCounts: {
          ...state.attemptCounts,
          [action.id]: (state.attemptCounts[action.id] ?? 0) + 1,
        },
      };
    case 'FIRE_MILESTONE': {
      // Phase-scoped: milestone is tagged with the active phase so a free-play
      // fire on phase 1 can't satisfy a milestone gate on phase 3. Idempotent
      // within a phase to avoid redundant localStorage writes.
      const phaseId = state.currentPhaseId;
      const existing = state.firedMilestones[phaseId];
      if (existing?.has(action.id)) return state;
      const next = new Set(existing ?? []);
      next.add(action.id);
      return {
        ...state,
        firedMilestones: { ...state.firedMilestones, [phaseId]: next },
      };
    }
    case 'INCREMENT_DATA_POINTS': {
      const phaseId = state.currentPhaseId;
      const prev = state.dataPointCount[phaseId] ?? 0;
      return {
        ...state,
        dataPointCount: { ...state.dataPointCount, [phaseId]: prev + action.count },
      };
    }
    case 'RESET':
      return action.nextState;
  }
}
