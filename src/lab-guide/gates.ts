import type { Gate, Phase } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
import type { RunnerState } from './runner';
import { format, strings } from './strings.da';

export interface GateCtx {
  /** Live snapshot of widget state — keyed by widget id. */
  widgets: Record<string, WidgetState>;
  simulationStateRef: { current: unknown };
}

export type WidgetState =
  | { kind: 'correct'; correct: boolean }
  | { kind: 'checked'; allChecked: boolean }
  | { kind: 'filled'; filled: boolean }
  | { kind: 'keywords'; foundCount: number; total: number };

const inquiryFreeAdvance = (mode: RunnerState['mode']) => mode === 'open';

export function isGateSatisfied(
  gate: Gate,
  state: RunnerState,
  module: SimulationModule | undefined,
  ctx: GateCtx,
): boolean {
  if (inquiryFreeAdvance(state.mode)) return true;

  switch (gate.type) {
    case 'always':
      return true;
    case 'milestone':
      return state.firedMilestones.has(gate.requires);
    case 'data-points':
      // Single source of truth: the runner counter, fed by simulation
      // ProgressEvent('data-collected'). A data-table widget that wants to
      // contribute should also fire that event — the widget-state path is gone
      // because it disagreed with the counter when the widget was unmounted.
      return state.dataPointCount >= gate.min;
    case 'all-correct':
      return gate.widgetIds.every((id) => {
        const w = ctx.widgets[id];
        return w?.kind === 'correct' && w.correct;
      });
    case 'all-checked':
      return gate.widgetIds.every((id) => {
        const w = ctx.widgets[id];
        return w?.kind === 'checked' && w.allChecked;
      });
    case 'all-filled':
      return gate.widgetIds.every((id) => {
        const w = ctx.widgets[id];
        return w?.kind === 'filled' && w.filled;
      });
    case 'keyword-count': {
      const w = ctx.widgets[gate.widgetId];
      if (w?.kind !== 'keywords') return false;
      return gate.min === 'all' ? w.foundCount === w.total : w.foundCount >= gate.min;
    }
    case 'predicate':
      return module?.gates?.[gate.name]?.(ctx.simulationStateRef.current) ?? false;
  }
}

export function canAdvanceTo(
  targetPhaseId: string,
  phases: Phase[],
  state: RunnerState,
  module: SimulationModule | undefined,
  ctx: GateCtx,
): boolean {
  const targetIdx = phases.findIndex((p) => p.id === targetPhaseId);
  if (targetIdx < 0) return false;
  const currentIdx = phases.findIndex((p) => p.id === state.currentPhaseId);
  const currentPhase = currentIdx >= 0 ? phases[currentIdx] : undefined;
  if (!currentPhase) return false;

  // Backward / current: always reachable.
  if (targetIdx <= currentIdx) return true;

  // Any forward move re-checks every gate from current up to (but not
  // including) target. Breaking an intermediate gate after the fact must
  // re-lock leaps over it, even if the target phase was visited before.
  for (const phase of phases.slice(currentIdx, targetIdx)) {
    if (!isGateSatisfied(phase.gate, state, module, ctx)) return false;
  }

  // Visited future phase → free leap (the work is preserved). Unvisited → only
  // the immediate next phase, no leap-frogging past intermediate steps.
  if (state.visitedPhaseIds.has(targetPhaseId)) return true;
  return targetIdx === currentIdx + 1;
}

/** Default lock-message map used when a phase's gate isn't satisfied. Strings
 * live in `strings.da.ts`; this function only handles the param substitution. */
export function gateMessage(gate: Gate): string {
  switch (gate.type) {
    case 'always':
      return '';
    case 'milestone':
      return strings.gates.milestone;
    case 'data-points':
      return format(strings.gates.dataPoints, { min: gate.min });
    case 'all-correct':
      return strings.gates.allCorrect;
    case 'all-checked':
      return strings.gates.allChecked;
    case 'all-filled':
      return strings.gates.allFilled;
    case 'keyword-count':
      return gate.min === 'all'
        ? strings.gates.keywordCountAll
        : format(strings.gates.keywordCount, { min: gate.min });
    case 'predicate':
      return gate.message ?? strings.gates.predicate;
  }
}
