// Per-field lightbulb shown only while spend mode is active. Clicking
// invokes the widget-supplied `onSpend` handler — the widget's closure calls
// `useRunner().spendAndRevealRubricTier(...)` or `spendAndRevealVtTier(...)`.
// The icon digit is the NEXT tier the click would unlock (so `1` after no
// reveal, `2` after tier 1, …).
//
// `variant === 'reveal'` renders the 4th-tier reveal pill instead — labelled
// "Vis svar (N)" and visually distinct. Disabled when the bucket can't cover
// the reveal cost.
import { HintAvailable1 } from '@/icons/HintAvailable1';
import { HintAvailable2 } from '@/icons/HintAvailable2';
import { HintAvailable3 } from '@/icons/HintAvailable3';
import { useHintSpend } from '../HintSpendContext';
import { Tooltip } from '../Tooltip';
import { format, strings } from '../strings.da';

interface NormalProps {
  variant?: 'normal';
  /** Next tier the click would unlock (1, 2, 3, …). Drives the icon digit. */
  nextTier: number;
  /** Total ladder length — surfaced to AT users as "{tier} of {cap}". */
  cap: number;
  /** Click handler — the widget's atomic-spend closure. Spend mode exits in
   *  HintSpendContext when this fires (handled by the widget via
   *  `exitSpendMode()`). */
  onSpend: () => void;
}

interface RevealProps {
  variant: 'reveal';
  /** Token cost (always 2 today, kept as a prop for flexibility). */
  cost: number;
  /** Greyed when bucket < cost. */
  disabled?: boolean;
  onSpend: () => void;
}

type Props = NormalProps | RevealProps;

export function HintLightbulb(props: Props) {
  const { spendMode, exitSpendMode } = useHintSpend();
  if (spendMode.kind !== 'active') return null;

  if (props.variant === 'reveal') {
    const { cost, disabled, onSpend } = props;
    const ariaLabel = format(strings.widgets.hints.revealAriaLabel, { cost });
    const label = format(strings.widgets.hints.revealLabel, { cost });
    const button = (
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          onSpend();
          exitSpendMode();
        }}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        className={
          disabled
            ? 'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400 cursor-not-allowed'
            : 'inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100'
        }
      >
        <span aria-hidden="true">🔍</span>
        <span>{label}</span>
      </button>
    );
    if (disabled) {
      return <Tooltip content={strings.widgets.hints.insufficientHints}>{button}</Tooltip>;
    }
    return button;
  }

  const { nextTier, cap, onSpend } = props;
  const Icon = nextTier >= 3 ? HintAvailable3 : nextTier === 2 ? HintAvailable2 : HintAvailable1;
  return (
    <button
      type="button"
      onClick={() => {
        onSpend();
        exitSpendMode();
      }}
      aria-label={format(strings.widgets.hints.lightbulbAriaLabel, {
        tier: nextTier,
        cap,
      })}
      className="inline-flex items-center justify-center rounded-full p-0.5 text-amber-700 hover:bg-amber-50"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
