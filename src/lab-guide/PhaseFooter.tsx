// Bottom-of-phase footer: previous/next buttons + gate-block tooltip.
import type { Phase } from '@/lib/schema';
import { type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useRunner } from './RunnerContext';
import { gateMessage, isGateSatisfied } from './gates';
import { strings } from './strings.da';
import { ToastContext } from './widgets/ToastContext';

interface Props {
  phases: Phase[];
  /** Slot for phase-specific batch-check buttons (Tjek variable, Tjek hypotese, Vis facit). */
  middleActions?: ReactNode;
  onSwitchInquiryForm?: () => void;
}

export function PhaseFooter({ phases, middleActions, onSwitchInquiryForm }: Props) {
  const { state, setCurrentPhase, gateCtx, simulation, resetLab } = useRunner();
  const { push: pushToast } = useContext(ToastContext);
  const currentIdx = phases.findIndex((p) => p.id === state.currentPhaseId);
  const currentPhase = phases[currentIdx];
  const prevPhase = currentIdx > 0 ? phases[currentIdx - 1] : undefined;
  const nextPhase = currentIdx < phases.length - 1 ? phases[currentIdx + 1] : undefined;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === phases.length - 1;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Native <dialog> is opened imperatively via showModal() so it gets the
  // browser's free Esc handling, focus management, and backdrop.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (confirmOpen && !d.open) d.showModal();
    if (!confirmOpen && d.open) d.close();
  }, [confirmOpen]);

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
              if (!gateOk) return;
              if (isLast) {
                pushToast(strings.guide.guideFinished);
                return;
              }
              if (nextPhase) setCurrentPhase(nextPhase.id);
            }}
            disabled={!gateOk}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${
                gateOk
                  ? 'bg-accent text-white hover:bg-accent-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {isLast ? strings.guide.finishGuide : strings.guide.nextPhase}
          </button>
        </div>
      </div>
      <div className="mt-8 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
        >
          {strings.guide.resetWork}
        </button>
      </div>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is mouse-only by
          design; keyboard users close via Esc (handled by onCancel) or the Annuller button. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="reset-confirm-title"
        onCancel={() => setConfirmOpen(false)}
        onClose={() => setConfirmOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setConfirmOpen(false);
        }}
        className="rounded-lg shadow-xl max-w-md w-full p-6 backdrop:bg-slate-900/40"
      >
        <h2 id="reset-confirm-title" className="text-lg font-semibold text-navy mb-2">
          {strings.guide.resetWorkConfirmTitle}
        </h2>
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-line">
          {strings.guide.resetWorkConfirmBody}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="text-sm text-slate-700 hover:underline px-2 py-1"
          >
            {strings.guide.resetWorkConfirmCancel}
          </button>
          <button
            type="button"
            onClick={() => {
              resetLab();
              setConfirmOpen(false);
            }}
            className="px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600"
          >
            {strings.guide.resetWorkConfirmAction}
          </button>
        </div>
      </dialog>
    </div>
  );
}
