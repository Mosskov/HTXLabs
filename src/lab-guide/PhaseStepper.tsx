// Top-of-guide stepper showing phase circles, completion state, and click-to-jump.
import type { Phase } from '@/lib/schema';
import { Fragment } from 'react';
import { useRunner } from './RunnerContext';
import { canAdvanceTo, isGateSatisfied } from './gates';
import { format, strings } from './strings.da';

export function PhaseStepper({ phases }: { phases: Phase[] }) {
  const { state, setCurrentPhase, gateCtx, simulation } = useRunner();

  return (
    <ol className="flex items-start justify-center gap-1 sm:gap-2 mb-6" aria-label="Faseoversigt">
      {phases.map((phase, idx) => {
        const isCurrent = phase.id === state.currentPhaseId;
        const isVisited = state.visitedPhaseIds.has(phase.id);
        // ✓ tracks the live gate, not just visit history: a phase whose gate
        // flipped back to false (e.g. student emptied the answer) loses its ✓.
        // The current phase shows ✓ too as soon as its gate passes. Visited
        // is still required so unvisited `always`-gate phases don't pre-tick.
        const isCompleted =
          isVisited && isGateSatisfied(phase.gate, state, simulation, gateCtx, phase.id);
        const reachable = canAdvanceTo(phase.id, phases, state, simulation, gateCtx);
        const clickable = reachable;

        // Connector to the NEXT phase: fills when THIS phase is completed AND
        // the next phase is either completed (chain of done) or currently
        // reachable (live forward edge). A locked + uncompleted right side
        // keeps the rail grey so it doesn't suggest a jump that isn't there.
        const nextPhase = phases[idx + 1];
        const nextCompleted =
          !!nextPhase &&
          state.visitedPhaseIds.has(nextPhase.id) &&
          isGateSatisfied(nextPhase.gate, state, simulation, gateCtx, nextPhase.id);
        const nextReachable =
          !!nextPhase && canAdvanceTo(nextPhase.id, phases, state, simulation, gateCtx);
        const railFilled = isCompleted && (nextCompleted || nextReachable);

        // Fill = "done"; ring = "you are here". Current+uncompleted is hollow
        // with just the ring so it doesn't look identical to current+completed.
        const ringClasses = isCurrent
          ? 'ring-2 ring-accent/25 ring-offset-2 ring-offset-slate-50'
          : '';
        const fillClasses = isCompleted
          ? 'bg-accent-100 border-accent-400 text-accent cursor-pointer hover:bg-accent-200'
          : reachable
            ? 'bg-white border-accent-400 text-accent cursor-pointer hover:bg-accent-50'
            : 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed';
        const circleClasses = `${fillClasses} ${ringClasses}`;

        // Two independent axes: color = done-ness, weight = you-are-here.
        const labelColor = isCompleted
          ? 'text-slate-700'
          : reachable
            ? 'text-slate-500'
            : 'text-slate-400';
        const labelWeight = isCurrent ? 'font-semibold' : isCompleted ? 'font-medium' : '';
        const labelClasses = `${labelColor} ${labelWeight}`.trim();

        return (
          <Fragment key={phase.id}>
            <li className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => clickable && setCurrentPhase(phase.id)}
                disabled={!clickable}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={format(strings.phaseStepper.phaseAriaLabel, {
                  n: idx + 1,
                  title: phase.title,
                  current: isCurrent ? strings.phaseStepper.currentSuffix : '',
                })}
                className={`
                  shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-medium
                  transition-colors
                  ${circleClasses}
                `}
              >
                {isCompleted ? '✓' : idx + 1}
              </button>
              <span className={`mt-2 text-xs ${labelClasses}`}>{phase.title}</span>
            </li>
            {idx < phases.length - 1 && (
              <div className="w-10 flex items-center h-7" aria-hidden>
                <div className={`w-full h-0.5 ${railFilled ? 'bg-accent-400' : 'bg-slate-200'}`} />
              </div>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
