// Bottom-of-phase footer: previous/next buttons + gate-block tooltip.
import type { Phase } from '@/lib/schema';
import { type ReactNode, useContext } from 'react';
import { ResetWorkButton } from './ResetWorkButton';
import { useRunner } from './RunnerContext';
import { gateMessage, isGateSatisfied } from './gates';
import { strings } from './strings.da';
import { ToastContext } from './widgets/ToastContext';

interface Props {
  phases: Phase[];
  /** Slot for phase-specific batch-check buttons (Tjek variable, Tjek hypotese, Vis facit). */
  middleActions?: ReactNode;
  onSwitchInquiryForm?: () => void;
  /** Route-level view reset (drop ?mode= + collapse disclosures) invoked
   *  after `resetLab()` so the post-reset landing reads as a fresh visit. */
  onResetView?: () => void;
}

export function PhaseFooter({ phases, middleActions, onSwitchInquiryForm, onResetView }: Props) {
  const { state, setCurrentPhase, gateCtx, simulation, resetLab } = useRunner();
  const { push: pushToast } = useContext(ToastContext);
  const currentIdx = phases.findIndex((p) => p.id === state.currentPhaseId);
  const currentPhase = phases[currentIdx];
  const prevPhase = currentIdx > 0 ? phases[currentIdx - 1] : undefined;
  const nextPhase = currentIdx < phases.length - 1 ? phases[currentIdx + 1] : undefined;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === phases.length - 1;

  if (!currentPhase) return null;

  // Footer cares only about advancing out of the current phase. canAdvanceTo
  // for the next phase reduces to "current phase's gate passes" (see gates.ts),
  // so we evaluate the gate once and reuse the result for both the inline
  // message and the button's enabled/disabled state.
  const gateOk = isGateSatisfied(currentPhase.gate, state, simulation, gateCtx, currentPhase.id);

  return (
    <div className="mt-8 no-print">
      {!gateOk && (
        <output className="mb-3 block text-sm text-slate-600">
          {gateMessage(currentPhase.gate)}
        </output>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          {isFirst ? (
            onSwitchInquiryForm && (
              <button
                type="button"
                onClick={onSwitchInquiryForm}
                className="text-sm text-slate-600 hover:underline"
              >
                {strings.guide.switchInquiryForm}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => prevPhase && setCurrentPhase(prevPhase.id)}
              className="text-sm text-slate-600 hover:underline"
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
              if (!gateOk) return;
              if (isLast) {
                pushToast(strings.guide.guideFinished);
                return;
              }
              if (nextPhase) setCurrentPhase(nextPhase.id);
            }}
            disabled={!gateOk}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium border-2 transition-colors
              ${
                gateOk
                  ? 'bg-white border-accent-400 text-slate-700 hover:bg-accent-50'
                  : 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {isLast ? strings.guide.finishGuide : strings.guide.nextPhase}
          </button>
        </div>
      </div>
      <ResetWorkButton
        onConfirm={() => {
          resetLab();
          onResetView?.();
        }}
      />
    </div>
  );
}
