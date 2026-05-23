// Pure state machine for the LabGuide runner. Side effects (persistence, refs,
// localStorage) live in RunnerContext.tsx; the reducer only produces state.

import type { DataRow, LabMode, Mode, RunnerState } from './runner';
import type { VariableTableValues } from './widgets/VariableTable';

/** Discriminated payload for the atomic rubric spend+reveal. `tier` advances
 *  the per-criterion ladder by one (cost 1); `reveal` jumps from `hintCap` to
 *  `hintCap + 1` for the cost carried in the payload (typically 2). */
export type RubricSpendOp = { kind: 'tier' } | { kind: 'reveal'; cost: number };

export type RunnerAction =
  | { type: 'SET_CURRENT_PHASE'; id: string }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_LAB_MODE'; labMode: LabMode }
  | { type: 'SET_WIDGET_VALUE'; id: string; value: unknown }
  | { type: 'SET_DATA_TABLE'; id: string; rows: DataRow[] }
  | { type: 'BUMP_ATTEMPTS'; id: string }
  | { type: 'FIRE_MILESTONE'; id: string }
  | { type: 'INCREMENT_DATA_POINTS'; count: number }
  | { type: 'SET_SIMULATION_STATE'; state: unknown }
  | {
      type: 'SPEND_AND_REVEAL_RUBRIC_TIER';
      phaseId: string;
      widgetId: string;
      criterionId: string;
      op: RubricSpendOp;
      hintCap: number;
      poolCap: number;
      now: number;
    }
  | {
      type: 'SPEND_AND_REVEAL_VT_TIER';
      phaseId: string;
      widgetId: string;
      cellKey: string;
      /** The hint text being revealed by this spend. Pushed into
       *  `variableTableHintReveals[widgetId][cellKey]` so subsequent edits
       *  (including clearing the cell) don't drop the paid string. */
      revealedText: string;
      hintCap: number;
      poolCap: number;
      now: number;
    }
  | {
      type: 'LAZY_REPLENISH';
      phaseId: string;
      fromLastReplenishAt: number | null;
      newLastReplenishAt: number;
      grants: number;
      poolCap: number;
    }
  | { type: 'ANCHOR_HINT_TIMER'; phaseId: string; now: number; poolCap: number }
  | { type: 'SET_VARIABLE_TABLE_LAST_CHECKED'; widgetId: string; values: VariableTableValues }
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
    case 'SET_SIMULATION_STATE':
      // Idempotent: skip the dispatch round-trip when nothing changed (the
      // debounced trailing edge can fire with the same payload as the last
      // commit on a quiet sim).
      if (state.simulationState === action.state) return state;
      return { ...state, simulationState: action.state };
    case 'SPEND_AND_REVEAL_RUBRIC_TIER': {
      // Atomic spend + reveal. Re-validates token sufficiency AND tier ceiling
      // at action time using the latest state — eliminates the stale-handler
      // race on rapid double-clicks. `poolCap`, `hintCap`, and `now` arrive in
      // the payload so the reducer stays pure.
      const { phaseId, widgetId, criterionId, op, hintCap, poolCap, now } = action;
      const effectiveTokens = state.hintTokens[phaseId] ?? poolCap;
      const widgetBucket = state.rubricHintTiers[widgetId] ?? {};
      const prevTier = widgetBucket[criterionId] ?? 0;
      let nextTier: number;
      let cost: number;
      if (op.kind === 'tier') {
        if (effectiveTokens < 1 || prevTier >= hintCap) return state;
        nextTier = prevTier + 1;
        cost = 1;
      } else {
        if (effectiveTokens < op.cost || prevTier !== hintCap) return state;
        nextTier = hintCap + 1;
        cost = op.cost;
      }
      const targetKey = `${widgetId}::${criterionId}`;
      return {
        ...state,
        rubricHintTiers: {
          ...state.rubricHintTiers,
          [widgetId]: { ...widgetBucket, [criterionId]: nextTier },
        },
        hintTokens: { ...state.hintTokens, [phaseId]: effectiveTokens - cost },
        hintLastReplenishAt: { ...state.hintLastReplenishAt, [phaseId]: now },
        hintUsageTotal: state.hintUsageTotal + cost,
        hintUsageByPhase: {
          ...state.hintUsageByPhase,
          [phaseId]: (state.hintUsageByPhase[phaseId] ?? 0) + cost,
        },
        hintUsageByTarget: {
          ...state.hintUsageByTarget,
          [targetKey]: (state.hintUsageByTarget[targetKey] ?? 0) + cost,
        },
      };
    }
    case 'SPEND_AND_REVEAL_VT_TIER': {
      const { phaseId, widgetId, cellKey, revealedText, hintCap, poolCap, now } = action;
      const effectiveTokens = state.hintTokens[phaseId] ?? poolCap;
      const widgetBucket = state.variableTableHintTiers[widgetId] ?? {};
      const prevTier = widgetBucket[cellKey] ?? 0;
      if (effectiveTokens < 1 || prevTier >= hintCap) return state;
      const nextTier = prevTier + 1;
      const cost = 1;
      const targetKey = `${widgetId}::${cellKey}`;
      const widgetReveals = state.variableTableHintReveals[widgetId] ?? {};
      const cellReveals = widgetReveals[cellKey] ?? [];
      return {
        ...state,
        variableTableHintTiers: {
          ...state.variableTableHintTiers,
          [widgetId]: { ...widgetBucket, [cellKey]: nextTier },
        },
        variableTableHintReveals: {
          ...state.variableTableHintReveals,
          [widgetId]: { ...widgetReveals, [cellKey]: [...cellReveals, revealedText] },
        },
        hintTokens: { ...state.hintTokens, [phaseId]: effectiveTokens - cost },
        hintLastReplenishAt: { ...state.hintLastReplenishAt, [phaseId]: now },
        hintUsageTotal: state.hintUsageTotal + cost,
        hintUsageByPhase: {
          ...state.hintUsageByPhase,
          [phaseId]: (state.hintUsageByPhase[phaseId] ?? 0) + cost,
        },
        hintUsageByTarget: {
          ...state.hintUsageByTarget,
          [targetKey]: (state.hintUsageByTarget[targetKey] ?? 0) + cost,
        },
      };
    }
    case 'LAZY_REPLENISH': {
      // Idempotency guard. If the anchor moved since the dispatcher read it,
      // another dispatch already granted — drop this one. Combined with the
      // single-owner effect in RunnerContext, double-grant is impossible.
      const { phaseId, fromLastReplenishAt, newLastReplenishAt, grants, poolCap } = action;
      const currentAnchor = state.hintLastReplenishAt[phaseId] ?? null;
      if (currentAnchor !== fromLastReplenishAt) return state;
      if (grants <= 0) return state;
      const effectiveTokens = state.hintTokens[phaseId] ?? poolCap;
      const nextTokens = Math.min(effectiveTokens + grants, poolCap);
      if (nextTokens === effectiveTokens) {
        return {
          ...state,
          hintLastReplenishAt: {
            ...state.hintLastReplenishAt,
            [phaseId]: newLastReplenishAt,
          },
        };
      }
      return {
        ...state,
        hintTokens: { ...state.hintTokens, [phaseId]: nextTokens },
        hintLastReplenishAt: {
          ...state.hintLastReplenishAt,
          [phaseId]: newLastReplenishAt,
        },
      };
    }
    case 'ANCHOR_HINT_TIMER': {
      // Re-anchor on phase entry so off-phase wall-clock time is discarded.
      // No-op for fresh phases (tokens absent === full bucket, no running
      // timer) and for already-full buckets. The spend actions handle the
      // partial-bucket-without-prior-spend → anchor case via their own `now`.
      const { phaseId, now, poolCap } = action;
      const tokens = state.hintTokens[phaseId];
      if (tokens === undefined) return state;
      if (tokens >= poolCap) return state;
      return {
        ...state,
        hintLastReplenishAt: { ...state.hintLastReplenishAt, [phaseId]: now },
      };
    }
    case 'SET_VARIABLE_TABLE_LAST_CHECKED':
      return {
        ...state,
        variableTableLastChecked: {
          ...state.variableTableLastChecked,
          [action.widgetId]: action.values,
        },
      };
    case 'RESET':
      return action.nextState;
  }
}
