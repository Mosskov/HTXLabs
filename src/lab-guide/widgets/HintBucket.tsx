// Hint-pulje button — visible counter that arms spend mode when clicked.
//
// Pure presentation: reads `bucketView(phaseId)` from RunnerContext and spend
// mode from HintSpendContext. Never dispatches LAZY_REPLENISH itself — the
// centralized effect in RunnerProvider owns that. The lightbulb-icon variant
// is chosen by current `tokens` (full / partial / empty); empty-bucket click
// is a no-op + tooltip with the countdown or generic empty copy.
//
// `placement === 'footer'`: unconditionally visible while the current phase
// has eligible widgets (LabGuide's footer mounts it inside that gate).
// `placement === 'inline'`: rendered inside a specific widget; suppresses
// itself when the owning widget's phaseScope ≠ currentPhaseId so the hidden-
// phase widget body doesn't paint a stray bucket.
import { HintAvailable1 } from '@/icons/HintAvailable1';
import { HintAvailable2 } from '@/icons/HintAvailable2';
import { HintAvailable3 } from '@/icons/HintAvailable3';
import { useHintSpend } from '../HintSpendContext';
import { usePhaseScope } from '../PhaseScopeContext';
import { useRunner } from '../RunnerContext';
import { Tooltip } from '../Tooltip';
import { format, strings } from '../strings.da';

interface Props {
  /** Where the bucket is mounted. `'footer'` always renders when eligible
   *  widgets exist; `'inline'` only renders when the surrounding phase scope
   *  matches the current phase. */
  placement: 'footer' | 'inline';
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function HintBucket({ placement }: Props) {
  const { state, bucketView, phaseHasHintEligibleWidgets } = useRunner();
  const { spendMode, enterSpendMode, exitSpendMode } = useHintSpend();
  const phaseScope = usePhaseScope();
  const currentPhaseId = state.currentPhaseId;

  // Inline buckets that belong to a hidden phase suppress themselves so the
  // hidden phase body doesn't render a stray bucket alongside its disabled
  // widgets.
  if (placement === 'inline' && phaseScope !== null && phaseScope !== currentPhaseId) {
    return null;
  }
  // No eligible widgets in the current phase → no bucket at all.
  if (!phaseHasHintEligibleWidgets(currentPhaseId)) return null;

  const { tokens, cap, msUntilNext, disabled } = bucketView(currentPhaseId);
  const armed = spendMode.kind === 'active' && spendMode.phaseId === currentPhaseId;
  const empty = tokens === 0;
  const canArm = !disabled && !empty;

  const Icon = tokens >= 3 ? HintAvailable3 : tokens === 2 ? HintAvailable2 : HintAvailable1;
  const showIcon = tokens > 0;

  const tooltip = disabled
    ? strings.widgets.hints.bucketDisabled
    : empty
      ? msUntilNext !== null
        ? format(strings.widgets.hints.bucketCountdown, { time: formatCountdown(msUntilNext) })
        : strings.widgets.hints.bucketEmpty
      : undefined;

  const ariaLabel = armed
    ? strings.widgets.hints.bucketSpendModeAriaLabel
    : format(strings.widgets.hints.bucketAriaLabel, { tokens, pool: cap });

  const colorClass = armed
    ? 'border-accent bg-accent/10 text-accent'
    : canArm
      ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed';

  const button = (
    <button
      type="button"
      onClick={() => {
        if (!canArm) return;
        if (armed) exitSpendMode();
        else enterSpendMode(currentPhaseId);
      }}
      aria-label={ariaLabel}
      aria-pressed={armed}
      aria-disabled={!canArm || undefined}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm font-medium ${colorClass}`}
    >
      {showIcon ? <Icon className="h-5 w-5" /> : <span className="text-base leading-none">💡</span>}
      <span className="tabular-nums">{tokens}</span>
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} align="right">
        {button}
      </Tooltip>
    );
  }
  return button;
}
