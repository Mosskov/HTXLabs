// Hint-pulje button — visible counter that arms spend mode when clicked.
//
// Pure presentation: reads `bucketView(phaseId)` from RunnerContext and spend
// mode from HintSpendContext. Never dispatches LAZY_REPLENISH itself — the
// centralized effect in RunnerProvider owns that. Renders a single 💡 glyph
// plus the numeric token count — no per-token icon variants (the digit-icons
// duplicated the counter). Empty-bucket click is a no-op + tooltip with the
// countdown or generic empty copy.
//
// Four distinct disabled visuals (today's grey shell stays the family default):
//   1. Empty + countdown — M:SS label replaces the token digit.
//   2. Empty + no refill — icon dims to opacity-60 (depleted).
//   3. Phase has no hints (hintPoolSize=0) — small lock glyph overlay.
//   4. Tokens but no spendable targets — full-opacity icon, tooltip only.
//
// `placement === 'footer'`: unconditionally visible while the current phase
// has eligible widgets (LabGuide's footer mounts it inside that gate).
// `placement === 'inline'`: rendered inside a specific widget; suppresses
// itself when the owning widget's phaseScope ≠ currentPhaseId so the hidden-
// phase widget body doesn't paint a stray bucket.
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

  const { tokens, cap, msUntilNext, disabled } = bucketView(currentPhaseId);
  const armed = spendMode.kind === 'active' && spendMode.phaseId === currentPhaseId;
  const empty = tokens === 0;
  const noTargets = !disabled && !empty && phaseSpendableTargetCount(currentPhaseId) === 0;
  const canArm = !disabled && !empty && !noTargets;

  // Discriminated disabled cause — drives both tooltip + visual variant.
  type DisabledReason = 'phase' | 'countdown' | 'depleted' | 'no-targets' | null;
  const disabledReason: DisabledReason = disabled
    ? 'phase'
    : empty
      ? msUntilNext !== null
        ? 'countdown'
        : 'depleted'
      : noTargets
        ? 'no-targets'
        : null;

  const tooltip =
    disabledReason === 'phase'
      ? strings.widgets.hints.bucketDisabled
      : disabledReason === 'countdown' && msUntilNext !== null
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

  // Per-reason icon styling. Countdown swaps the digit for the M:SS label;
  // depleted dims the icon (run-out feel); phase-disabled adds a lock glyph
  // overlay; no-targets stays at full opacity (the tooltip carries the meaning).
  const iconOpacity = disabledReason === 'depleted' ? 'opacity-60' : '';

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
      <span aria-hidden="true" className={`relative text-base leading-none ${iconOpacity}`}>
        💡
        {disabledReason === 'phase' && (
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-slate-200 text-[8px] leading-none text-slate-500"
          >
            🔒
          </span>
        )}
      </span>
      {disabledReason === 'countdown' && msUntilNext !== null ? (
        <span className="tabular-nums text-xs text-slate-500">{formatCountdown(msUntilNext)}</span>
      ) : (
        <span className="tabular-nums">{tokens}</span>
      )}
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
