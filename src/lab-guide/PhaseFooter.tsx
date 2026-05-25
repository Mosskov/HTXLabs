// Bottom-of-phase footer: previous/next buttons + gate-block tooltip.
import type { Phase } from '@/lib/schema';
import { type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { ResetWorkButton } from './ResetWorkButton';
import { useRunner } from './RunnerContext';
import { Tooltip } from './Tooltip';
import { gateMessage, isGateSatisfied, widgetSatisfied } from './gates';
import { strings } from './strings.da';
import { HintBucket } from './widgets/HintBucket';
import { ToastContext } from './widgets/ToastContext';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

  // "Tjek dim" — disabled WITH a reason (empty values, clean snapshot, below
  // min-words, …). Renders a slightly lighter slate-50 shell to read as
  // "temporarily quiet, not broken" vs. the fully-disabled slate-100 gate lock.
  const tjekDim = activeCheck?.disabled === true && disabledReason != null;

  // Gate-unlock flash: emerald-only, fires exactly once on the false → true
  // transition of `gateOk`. Per F1 the button never flashes on a per-Tjek
  // outcome; the only progress signal is "you just unlocked the next phase".
  // `flashNonce` re-mounts the wrapper so the CSS keyframe re-fires each
  // time the gate re-opens (e.g. unlock cell → re-Tjek → gate closes then
  // re-opens). Initial mount with an already-satisfied gate does NOT flash
  // (a returning student should not see the celebration replay on every
  // visit to a completed phase).
  const [flashNonce, setFlashNonce] = useState(0);
  const [flashWithTransition, setFlashWithTransition] = useState(true);
  const prevGateOkRef = useRef(gateOk);
  useEffect(() => {
    if (prevGateOkRef.current === false && gateOk === true) {
      setFlashWithTransition(!prefersReducedMotion());
      setFlashNonce((n) => n + 1);
    }
    prevGateOkRef.current = gateOk;
  }, [gateOk]);

  const flashActive = flashNonce > 0;

  const baseButtonClass = 'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors';
  // During the flash window, drop the bg-* so the wrapper bg bleeds through and
  // fades alongside the keyframe; `!important` would defeat the keyframe.
  const enabledClass = flashActive
    ? 'border-accent-400 text-slate-700 hover:bg-accent-50'
    : 'bg-white border-accent-400 text-slate-700 hover:bg-accent-50';
  const dimClass = 'bg-slate-50 border-slate-300 text-slate-400 cursor-not-allowed';
  const fullyDisabledClass = 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed';
  const stateClass = !buttonDisabled ? enabledClass : tjekDim ? dimClass : fullyDisabledClass;

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
      className={`${baseButtonClass} ${stateClass}`}
    >
      {buttonLabel}
    </button>
  );

  // Emerald wrapper renders only when the gate is currently satisfied AND a
  // transition has fired. Re-renders are keyed on `flashNonce` so each gate-
  // unlock event remounts the wrapper and re-fires the keyframe.
  const flashedButton =
    flashActive && gateOk ? (
      <span
        key={flashNonce}
        className={`inline-block rounded-md bg-emerald-100${
          flashWithTransition ? ' animate-vt-flash-fade-to-white' : ''
        }`}
      >
        {nextButton}
      </span>
    ) : (
      nextButton
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
        <div className="flex items-center gap-2">
          <HintBucket placement="footer" />
          {middleActions}
        </div>
        <div className="flex-1 flex items-center justify-end gap-2">
          {disabledReason != null ? (
            <Tooltip content={disabledReason} align="right" openDelayMs={500}>
              {flashedButton}
            </Tooltip>
          ) : (
            flashedButton
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
