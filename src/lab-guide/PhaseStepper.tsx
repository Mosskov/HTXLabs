import type { Phase } from '@/lib/schema';
import { canAdvanceTo } from './gates';
import { useRunner } from './RunnerContext';

export function PhaseStepper({ phases }: { phases: Phase[] }) {
  const { state, setCurrentPhase, gateCtx } = useRunner();

  return (
    <ol
      className="flex items-start justify-between gap-1 sm:gap-2 mb-6"
      aria-label="Faseoversigt"
    >
      {phases.map((phase, idx) => {
        const isCurrent = phase.id === state.currentPhaseId;
        const isCompleted =
          state.visitedPhaseIds.has(phase.id) &&
          !isCurrent &&
          phases.findIndex((p) => p.id === phase.id) <
            phases.findIndex((p) => p.id === state.currentPhaseId);
        const reachable = canAdvanceTo(phase.id, phases, state, undefined, gateCtx);
        const clickable = reachable;

        return (
          <li
            key={phase.id}
            className="flex-1 flex flex-col items-center text-center min-w-0"
          >
            <div className="flex items-center w-full">
              {idx > 0 && (
                <div
                  className={`flex-1 h-px ${
                    isCompleted || isCurrent ? 'bg-accent' : 'bg-slate-300'
                  }`}
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
                  className={`flex-1 h-px ${
                    isCompleted ? 'bg-accent' : 'bg-slate-300'
                  }`}
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
