import type { Gate, Phase } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
import type { RunnerState } from './runner';

export interface GateCtx {
  /** Live snapshot of widget state — keyed by widget id. */
  widgets: Record<string, WidgetState>;
  simulationStateRef: { current: unknown };
}

export type WidgetState =
  | { kind: 'correct'; correct: boolean }
  | { kind: 'checked'; allChecked: boolean }
  | { kind: 'filled'; filled: boolean }
  | { kind: 'keywords'; foundCount: number }
  | { kind: 'data-points'; valid: number; total: number };

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
    case 'data-points': {
      // Try widget-state first (live data table), fall back to runner counter.
      const widgetEntries = Object.values(ctx.widgets).filter(
        (w): w is Extract<WidgetState, { kind: 'data-points' }> => w.kind === 'data-points',
      );
      if (widgetEntries.length > 0) {
        const total = widgetEntries.reduce(
          (sum, w) => sum + (gate.validOnly ? w.valid : w.total),
          0,
        );
        return total >= gate.min;
      }
      return state.dataPointCount >= gate.min;
    }
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
      return w?.kind === 'keywords' && w.foundCount >= gate.min;
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
  if (targetIdx === 0) return true;
  return phases.slice(0, targetIdx).every((p) => isGateSatisfied(p.gate, state, module, ctx));
}

/** Default lock-message map used when a phase's gate isn't satisfied. */
export function gateMessage(gate: Gate): string {
  switch (gate.type) {
    case 'always':
      return '';
    case 'milestone':
      return 'Du skal gennemføre forsøget mindst én gang for at fortsætte.';
    case 'data-points':
      return `Indsamle mindst ${gate.min} gyldige målinger før næste fase.`;
    case 'all-correct':
      return "Klik 'Tjek' og opnå alle korrekte svar.";
    case 'all-checked':
      return 'Sæt flueben ved alle punkter på tjeklisten.';
    case 'all-filled':
      return 'Besvar alle spørgsmål for at fortsætte.';
    case 'keyword-count':
      return `Find mindst ${gate.min} nøgleord.`;
    case 'predicate':
      return 'Forsøget skal opfylde et bestemt kriterium for at fortsætte.';
  }
}
