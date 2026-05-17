// Pure gate evaluation: GATE_HANDLERS map, isGateSatisfied, canAdvanceTo, gateMessage.
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
  /** `filled` is the `all-filled` gate's read facet (boolean satisfaction).
   *  `count` is an optional sibling facet — currently only the DataTable
   *  publishes it, and only the `data-points` gate consults it (when the
   *  gate spec carries a `widgetId`). `correct` is an optional facet for
   *  widgets that support author-supplied answer checks (currently only
   *  VariableTable when its `expected` prop is set); the `all-validated`
   *  gate reads it. Note: `widgetSatisfied` (used by `all-satisfied`) still
   *  projects `filled` regardless of `correct` — correctness gating is
   *  explicit via `all-validated`, never implicit. `errors` is the matching
   *  widget's opaque error payload (typed `unknown` here so gates.ts stays
   *  free of widget-specific types). `values` is an opaque payload for
   *  sibling widgets that want to read what was filled (read via
   *  `useWidgetState`); gate evaluators ignore it. Lets a single registration
   *  drive multiple gate kinds without double-keying the widget registry. */
  | {
      kind: 'filled';
      filled: boolean;
      count?: number;
      correct?: boolean;
      errors?: unknown;
      values?: unknown;
    }
  | { kind: 'keywords'; foundCount: number; total: number }
  /** `<RubricResponse>` registers this. `satisfied` is a single derived bit:
   *  most recent rubric result must be present, fresh (not edited since
   *  evaluation), not embedder-down, and have `requiredSatisfied: true`. The
   *  widget owns that derivation; the gate just reads the bit. */
  | { kind: 'rubric'; satisfied: boolean };

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
    phaseId: string,
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
  // Phase-scoped: only milestones fired *during the gated phase* satisfy this
  // gate. Free-play exploration on an earlier phase can't pre-tick it.
  milestone: {
    check: (gate, state, _module, _ctx, phaseId) =>
      state.firedMilestones[phaseId]?.has(gate.requires) ?? false,
    message: () => strings.gates.milestone,
  },
  // Two paths:
  //   - `widgetId` set → read the widget's `count` facet (DataTable in either
  //     sim or manual mode publishes one). Lets a teacher flip the widget's
  //     `source` prop without rewriting the gate.
  //   - No `widgetId` → phase-scoped sim counter, fed by ProgressEvent
  //     ('data-collected'). Each phase has its own bucket so free-play
  //     collection on an earlier phase can't pre-tick a later gate.
  'data-points': {
    check: (gate, state, _module, ctx, phaseId) => {
      if (gate.widgetId) {
        const w = ctx.widgets[gate.widgetId];
        const count = w?.kind === 'filled' ? (w.count ?? 0) : 0;
        return count >= gate.min;
      }
      return (state.dataPointCount[phaseId] ?? 0) >= gate.min;
    },
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
  'rubric-required': {
    check: (gate, _state, _module, ctx) =>
      gate.widgetIds.every((id) => {
        const w = ctx.widgets[id];
        return w?.kind === 'rubric' && w.satisfied;
      }),
    message: () => strings.gates.rubricRequired,
  },
  // Flat (non-recursive) AND across heterogeneous widget kinds. Projects each
  // widget to a single satisfaction bit; an absent registration counts as
  // unsatisfied. The lock message is intentionally generic — internal widget
  // ids are not student-facing copy.
  'all-satisfied': {
    check: (gate, _state, _module, ctx) =>
      gate.widgetIds.every((id) => widgetSatisfied(ctx.widgets[id])),
    message: () => strings.gates.allSatisfied,
  },
  // Widget-agnostic correctness gate — reads `correct: true` from any widget
  // registering `kind: 'filled'` (currently VariableTable with `expected`).
  // Strict on both `kind` and `correct === true`: a widget that only publishes
  // `filled` (no `expected`) keeps the gate locked. Decoupled from
  // `all-filled` so that adding `expected` to a widget never silently changes
  // a presence-only gate elsewhere.
  'all-validated': {
    check: (gate, _state, _module, ctx) =>
      gate.widgetIds.every((id) => {
        const w = ctx.widgets[id];
        return w?.kind === 'filled' && w.correct === true;
      }),
    message: () => strings.gates.allValidated,
  },
};

/** Kind-aware satisfaction projection used by `'all-satisfied'` and by
 *  `<RevealWhen>`. Exported so the projection lives in one place — both
 *  consumers must agree on what "satisfied" means per kind. An absent
 *  registration counts as unsatisfied. Keep this in lock-step with WidgetState.
 *
 *  Note: for `kind: 'filled'`, this projects `w.filled` regardless of `correct`.
 *  Correctness gating is opt-in via the `all-validated` gate kind — adding
 *  `expected` to a widget never silently re-locks an `all-satisfied` gate. */
export function widgetSatisfied(w: WidgetState | undefined): boolean {
  if (!w) return false;
  switch (w.kind) {
    case 'correct':
      return w.correct;
    case 'checked':
      return w.allChecked;
    case 'filled':
      return w.filled;
    case 'rubric':
      return w.satisfied;
    case 'keywords':
      return w.total > 0 && w.foundCount === w.total;
  }
}

/** All gate kinds known to the engine — derived from the handler map so this
 * list stays in lock-step with `GATE_HANDLERS`. */
export const GATE_KINDS = Object.keys(GATE_HANDLERS) as Array<Gate['type']>;

export function isGateSatisfied(
  gate: Gate,
  state: RunnerState,
  module: SimulationModule | undefined,
  ctx: GateCtx,
  phaseId: string,
): boolean {
  // Open-mode (`inquiryFreeAdvance`): gates are non-binding, advance is
  // unconditional. Guided / semi-guided run the real check below. SPEC §5.
  if (state.mode === 'open') return true;
  // The handler narrows on `gate.type`; the cast carries that to the call site
  // since TS can't tie the lookup result to the specific gate without a switch.
  const handler = GATE_HANDLERS[gate.type] as GateHandler<Gate>;
  return handler.check(gate, state, module, ctx, phaseId);
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
  // Each gate is evaluated against its own phase's bucket.
  for (const phase of phases.slice(currentIdx, targetIdx)) {
    if (!isGateSatisfied(phase.gate, state, module, ctx, phase.id)) return false;
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
