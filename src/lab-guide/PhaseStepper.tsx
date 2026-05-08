import type { Phase } from '@/lib/schema';
import { useRunner } from './RunnerContext';
import { canAdvanceTo, isGateSatisfied } from './gates';

export function PhaseStepper({ phases }: { phases: Phase[] }) {
  const { state, setCurrentPhase, gateCtx } = useRunner();

  return (
    <ol className="flex items-start justify-between gap-1 sm:gap-2 mb-6" aria-label="Faseoversigt">
      {phases.map((phase, idx) => {
        const isCurrent = phase.id === state.currentPhaseId;
        const isVisited = state.visitedPhaseIds.has(phase.id);
        // ✓ tracks the live gate, not just visit history: a phase whose gate
        // flipped back to false (e.g. student emptied the answer) loses its ✓.
        // The current phase shows ✓ too as soon as its gate passes. Visited
        // is still required so unvisited `always`-gate phases don't pre-tick.
        const isCompleted = isVisited && isGateSatisfied(phase.gate, state, undefined, gateCtx);
        const reachable = canAdvanceTo(phase.id, phases, state, undefined, gateCtx);
        const clickable = reachable;

        // Edge between phase k and k+1 is "crossed" iff phase k+1 has been
        // visited. Both halves of that edge use the same condition so the
        // connector is a single colour, not a slate/accent splice.
        const nextPhase = phases[idx + 1];
        const nextEdgeCrossed = !!nextPhase && state.visitedPhaseIds.has(nextPhase.id);
        const prevEdgeCrossed = isVisited;

        return (
          <li key={phase.id} className="flex-1 flex flex-col items-center text-center min-w-0">
            <div className="flex items-center w-full">
              {idx > 0 && (
                <div
                  className={`flex-1 h-px ${prevEdgeCrossed ? 'bg-accent' : 'bg-slate-300'}`}
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => clickable && setCurrentPhase(phase.id)}
                disabled={!clickable}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Fase ${idx + 1}: ${phase.title}${isCurrent ? ' (nuværende)' : ''}`}
                className={`
                  shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-medium
                  transition-colors
                  ${
                    isCurrent
                      ? 'bg-accent border-accent text-white'
                      : isCompleted
                        ? 'bg-accent border-accent text-white cursor-pointer hover:bg-accent-700'
                        : reachable
                          ? 'bg-white border-accent text-accent cursor-pointer hover:bg-accent-50'
                          : 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                {isCompleted ? '✓' : idx + 1}
              </button>
              {idx < phases.length - 1 && (
                <div
                  className={`flex-1 h-px ${nextEdgeCrossed ? 'bg-accent' : 'bg-slate-300'}`}
                  aria-hidden
                />
              )}
            </div>
            <span
              className={`mt-2 text-xs sm:text-sm truncate w-full ${
                isCurrent ? 'text-accent font-medium' : 'text-slate-500'
              }`}
            >
              {phase.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
