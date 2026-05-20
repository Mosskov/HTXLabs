// Bottom-of-phase footer: previous/next buttons + gate-block tooltip.
import type { Phase } from '@/lib/schema';
import { type ReactNode, useContext } from 'react';
import { ResetWorkButton } from './ResetWorkButton';
import { useRunner } from './RunnerContext';
import { Tooltip } from './Tooltip';
import { gateMessage, isGateSatisfied, widgetSatisfied } from './gates';
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
  const { state, setCurrentPhase, gateCtx, simulation, resetLab, widgetChecks } = useRunner();
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

  // Merged check button: a widget-driven gate may have widgets that opted in
  // (`checkInFooter`) to driving their Tjek from this footer button. Walk the
  // gate's `widgetIds` in order and pick the first unsatisfied widget that
  // registered a check — that's the active step. A gate without `widgetIds`
  // (milestone / data-points / predicate / always / keyword-count) yields no
  // active check, so this is a no-op for every non-opted-in phase. Open mode
  // bypasses the gate entirely, so no check is surfaced there either.
  const gateWidgetIds = 'widgetIds' in currentPhase.gate ? currentPhase.gate.widgetIds : [];
  // Per-widget satisfaction must match the gate's own semantics. `widgetSatisfied`
  // with the gate's `strict` flag covers all-correct / all-checked / all-filled /
  // rubric-required / all-satisfied. `all-validated` carries no `strict` field but
  // is correctness-gated by definition — project it strictly too, else a
  // filled-but-incorrect widget reads satisfied here, its footer Tjek button
  // vanishes, and the phase is stuck (gate locked, no way to run the check).
  const strictProjection =
    currentPhase.gate.type === 'all-validated' ||
    ('strict' in currentPhase.gate && currentPhase.gate.strict === true);
  const activeCheckId =
    state.mode === 'open'
      ? undefined
      : gateWidgetIds.find(
          (wid) =>
            !widgetSatisfied(gateCtx.widgets[wid], strictProjection) && widgetChecks[wid] != null,
        );
  const activeCheck = activeCheckId !== undefined ? widgetChecks[activeCheckId] : undefined;

  // When a check is active the footer button runs that check; otherwise it
  // advances the phase (unchanged behaviour). The button is disabled per the
  // check's own `disabled` while a check is active, or per the gate otherwise.
  const buttonDisabled = activeCheck ? activeCheck.disabled : !gateOk;
  const buttonLabel = activeCheck
    ? activeCheck.label
    : isLast
      ? strings.guide.finishGuide
      : strings.guide.nextPhase;

  // A disabled check that carries a hover explanation renders `aria-disabled`
  // instead of a real `disabled` attribute: a truly disabled <button> fires no
  // pointer events, so its Tooltip would never open. Every other disabled state
  // keeps the real attribute. The click handler no-ops while disabled either way.
  const disabledReason = activeCheck?.disabledReason;

  const nextButton = (
    <button
      type="button"
      onClick={() => {
        if (activeCheck) {
          if (!activeCheck.disabled) void activeCheck.run();
          return;
        }
        if (!gateOk) return;
        if (isLast) {
          pushToast(strings.guide.guideFinished);
          return;
        }
        if (nextPhase) setCurrentPhase(nextPhase.id);
      }}
      disabled={buttonDisabled && disabledReason == null}
      aria-disabled={disabledReason != null || undefined}
      className={`
        px-3 py-1.5 rounded-md text-sm font-medium border-2 transition-colors
        ${
          !buttonDisabled
            ? 'bg-white border-accent-400 text-slate-700 hover:bg-accent-50'
            : 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
        }
      `}
    >
      {buttonLabel}
    </button>
  );

  return (
    <div className="mt-8 no-print">
      {!gateOk && activeCheck === undefined && (
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
          {disabledReason != null ? (
            <Tooltip content={disabledReason} align="right">
              {nextButton}
            </Tooltip>
          ) : (
            nextButton
          )}
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
