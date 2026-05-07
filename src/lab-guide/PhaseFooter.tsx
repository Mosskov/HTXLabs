import type { ReactNode } from 'react';
import type { Phase } from '@/lib/schema';
import { canAdvanceTo, gateMessage, isGateSatisfied } from './gates';
import { useRunner } from './RunnerContext';
import { strings } from './strings.da';

interface Props {
  phases: Phase[];
  /** Slot for phase-specific batch-check buttons (Tjek variable, Tjek hypotese, Vis facit). */
  middleActions?: ReactNode;
  onSwitchInquiryForm?: () => void;
}

export function PhaseFooter({ phases, middleActions, onSwitchInquiryForm }: Props) {
  const { state, setCurrentPhase, gateCtx } = useRunner();
  const currentIdx = phases.findIndex((p) => p.id === state.currentPhaseId);
  const currentPhase = phases[currentIdx];
  const prevPhase = currentIdx > 0 ? phases[currentIdx - 1] : undefined;
  const nextPhase = currentIdx < phases.length - 1 ? phases[currentIdx + 1] : undefined;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === phases.length - 1;

  if (!currentPhase) return null;

  const gateOk = isGateSatisfied(currentPhase.gate, state, undefined, gateCtx);
  const nextReachable =
    nextPhase && canAdvanceTo(nextPhase.id, phases, state, undefined, gateCtx);
  const message = gateOk ? '' : gateMessage(currentPhase.gate);

  return (
    <div className="mt-8 border-t border-slate-200 pt-4 no-print">
      {message && (
        <p className="mb-3 text-sm text-amber-700" role="status">
          {message}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          {isFirst ? (
            onSwitchInquiryForm && (
              <button
                type="button"
                onClick={onSwitchInquiryForm}
                className="text-sm text-accent hover:underline"
              >
                {strings.guide.switchInquiryForm}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => prevPhase && setCurrentPhase(prevPhase.id)}
              className="text-sm text-accent hover:underline"
            >
              {strings.guide.previousPhase}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">{middleActions}</div>
        <div className="flex-1 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (isLast) {
                // "Afslut guide" — jump to a "done" state by advancing to the rapporter phase if not already.
                return;
              }
              if (nextPhase && nextReachable) setCurrentPhase(nextPhase.id);
            }}
            disabled={isLast ? false : !nextReachable}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${
                isLast || nextReachable
                  ? 'bg-accent text-white hover:bg-accent-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {isLast ? strings.guide.finishGuide : strings.guide.nextPhase}
          </button>
        </div>
      </div>
    </div>
  );
}
