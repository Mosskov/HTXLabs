// Hint-pulje button — visible counter that arms spend mode when clicked.
//
// Pure presentation: reads `bucketView(phaseId)` from RunnerContext and spend
// mode from HintSpendContext. Never dispatches LAZY_REPLENISH itself — the
// centralized effect in RunnerProvider owns that. Renders the hand-drawn
// `Bulb` icon plus the numeric token count. Empty-bucket click is a no-op +
// tooltip with the countdown or generic empty copy.
//
// Four distinct disabled visuals:
//   1. Phase has no hints (hintPoolSize=0) → NOT RENDERED (author explicitly
//      disabled hints; no affordance needed).
//   2. Empty + countdown → `BulbFilling` icon fills bottom-up over the
//      replenish cycle; M:SS lives in tooltip only.
//   3. Empty + no refill (depleted) → `BulbCracked` at opacity-60 + "0".
//   4. Tokens but no spendable targets → `Bulb` at opacity-60 + count.
//
// `placement === 'footer'`: unconditionally visible while the current phase
// has eligible widgets (LabGuide's footer mounts it inside that gate).
// `placement === 'inline'`: rendered inside a specific widget; suppresses
// itself when the owning widget's phaseScope ≠ currentPhaseId so the hidden-
// phase widget body doesn't paint a stray bucket.
import { Bulb } from '@/icons/Bulb';
import { BulbCracked } from '@/icons/BulbCracked';
import { BulbFilling } from '@/icons/BulbFilling';
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
  const { state, bucketView, phaseHasHintEligibleWidgets, phaseSpendableTargetCount } = useRunner();
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

  const { tokens, cap, msUntilNext, replenishMs, disabled } = bucketView(currentPhaseId);

  // Author explicitly disabled hints — don't render the bucket at all.
  if (disabled) return null;

  const armed = spendMode.kind === 'active' && spendMode.phaseId === currentPhaseId;
  const empty = tokens === 0;
  const noTargets = !empty && phaseSpendableTargetCount(currentPhaseId) === 0;
  const canArm = !empty && !noTargets;

  // Discriminated disabled cause — drives both tooltip + visual variant.
  type DisabledReason = 'countdown' | 'depleted' | 'no-targets' | null;
  const disabledReason: DisabledReason = empty
    ? msUntilNext !== null
      ? 'countdown'
      : 'depleted'
    : noTargets
      ? 'no-targets'
      : null;

  const tooltip =
    disabledReason === 'countdown' && msUntilNext !== null
      ? format(strings.widgets.hints.bucketCountdown, { time: formatCountdown(msUntilNext) })
      : disabledReason === 'depleted'
        ? strings.widgets.hints.bucketEmpty
        : disabledReason === 'no-targets'
          ? strings.widgets.hints.bucketNoTargets
          : undefined;

  const ariaLabel = armed
    ? strings.widgets.hints.bucketSpendModeAriaLabel
    : format(strings.widgets.hints.bucketAriaLabel, { tokens, pool: cap });

  const colorClass = armed
    ? 'border-accent-400 bg-accent-50 text-slate-700'
    : canArm
      ? 'border-accent-400 bg-white text-slate-700 hover:bg-accent-50'
      : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed';

  // Countdown fillPct: 0% just after a spend (msUntilNext ≈ replenishMs),
  // 100% the moment a token is granted. Guard against replenishMs=0.
  const fillPct =
    disabledReason === 'countdown' && msUntilNext !== null && replenishMs > 0
      ? ((replenishMs - msUntilNext) / replenishMs) * 100
      : 0;

  const ICON_SIZE = 'h-5 w-5';

  const icon =
    disabledReason === 'countdown' ? (
      <BulbFilling fillPct={fillPct} className={`${ICON_SIZE} opacity-60`} />
    ) : disabledReason === 'depleted' ? (
      <BulbCracked className={`${ICON_SIZE} opacity-60`} />
    ) : disabledReason === 'no-targets' ? (
      <Bulb className={`${ICON_SIZE} opacity-60`} />
    ) : (
      <Bulb className={ICON_SIZE} />
    );

  // Countdown shows bulb only (M:SS lives in tooltip); other states show the
  // token count next to the bulb.
  const countLabel =
    disabledReason === 'countdown' ? null : <span className="tabular-nums">{tokens}</span>;

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
      className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${colorClass}`}
    >
      {icon}
      {countLabel}
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} align="right" openDelayMs={500}>
        {button}
      </Tooltip>
    );
  }
  return button;
}
