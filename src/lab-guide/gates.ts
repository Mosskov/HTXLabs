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

/** Gate kinds whose evaluation depends on the simulation rather than a widget.
 * Authorable labs (non-`tags: ['test']`) are limited to widget-driven kinds —
 * see `AUTHORABLE_GATE_KINDS` in `src/lib/content.ts`. */
export const SIM_DRIVEN_GATE_KINDS = [
  'milestone',
  'data-points',
  'predicate',
] as const satisfies ReadonlyArray<Gate['type']>;

interface GateHandler<G extends Gate> {
  check: (
    gate: G,
    state: RunnerState,
    module: SimulationModule | undefined,
    ctx: GateCtx,
  ) => boolean;
  message: (gate: G) => string;
}

type GateHandlerMap = { [K in Gate['type']]: GateHandler<Extract<Gate, { type: K }>> };

/** Single source of truth for gate behaviour. Adding a 9th kind: add a Zod
 * literal in `src/lib/schema.ts`, then add one entry here. `isGateSatisfied`
 * and `gateMessage` dispatch through this table; `AUTHORABLE_GATE_KINDS`
 * (in `src/lib/content.ts`) is derived from its keys. */
const GATE_HANDLERS: GateHandlerMap = {
  always: {
    check: () => true,
    message: () => '',
  },
  milestone: {
    check: (gate, state) => state.firedMilestones.has(gate.requires),
    message: () => strings.gates.milestone,
  },
  // Single source of truth: the runner counter, fed by simulation
  // ProgressEvent('data-collected'). A data-table widget that wants to
  // contribute should also fire that event — the widget-state path is gone
  // because it disagreed with the counter when the widget was unmounted.
  'data-points': {
    check: (gate, state) => state.dataPointCount >= gate.min,
    message: (gate) => format(strings.gates.dataPoints, { min: gate.min }),
  },
  'all-correct': {
    check: (gate, _state, _module, ctx) =>
      gate.widgetIds.every((id) => {
        const w = ctx.widgets[id];
        return w?.kind === 'correct' && w.correct;
      }),
    message: () => strings.gates.allCorrect,
  },
  'all-checked': {
    check: (gate, _state, _module, ctx) =>
      gate.widgetIds.every((id) => {
        const w = ctx.widgets[id];
        return w?.kind === 'checked' && w.allChecked;
      }),
    message: () => strings.gates.allChecked,
  },
  'all-filled': {
    check: (gate, _state, _module, ctx) =>
      gate.widgetIds.every((id) => {
        const w = ctx.widgets[id];
        return w?.kind === 'filled' && w.filled;
      }),
    message: () => strings.gates.allFilled,
  },
  'keyword-count': {
    check: (gate, _state, _module, ctx) => {
      const w = ctx.widgets[gate.widgetId];
      if (w?.kind !== 'keywords') return false;
      return gate.min === 'all' ? w.foundCount === w.total : w.foundCount >= gate.min;
    },
    message: (gate) =>
      gate.min === 'all'
        ? strings.gates.keywordCountAll
        : format(strings.gates.keywordCount, { min: gate.min }),
  },
  predicate: {
    check: (gate, _state, module, ctx) =>
      module?.gates?.[gate.name]?.(ctx.simulationStateRef.current) ?? false,
    message: (gate) => gate.message ?? strings.gates.predicate,
  },
};

/** All gate kinds known to the engine — derived from the handler map so this
 * list stays in lock-step with `GATE_HANDLERS`. */
export const GATE_KINDS = Object.keys(GATE_HANDLERS) as Array<Gate['type']>;

export function isGateSatisfied(
  gate: Gate,
  state: RunnerState,
  module: SimulationModule | undefined,
  ctx: GateCtx,
): boolean {
  if (inquiryFreeAdvance(state.mode)) return true;
  // The handler narrows on `gate.type`; the cast carries that to the call site
  // since TS can't tie the lookup result to the specific gate without a switch.
  const handler = GATE_HANDLERS[gate.type] as GateHandler<Gate>;
  return handler.check(gate, state, module, ctx);
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
  const handler = GATE_HANDLERS[gate.type] as GateHandler<Gate>;
  return handler.message(gate);
}
