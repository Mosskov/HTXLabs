// One VariableTable cell: renders either a locked readonly input wrapped in an
// unlock-affordance span, or an editable ProtectedInput inside a HintPopup.
// Owns the spend-on-click/Enter dance and the per-Tjek flash classes; the
// unlock session lives in useVariableTableUnlockSession.
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Tooltip } from '../Tooltip';
import { strings } from '../strings.da';
import { HintPopup } from './HintPopup';
import { ProtectedInput } from './ProtectedInput';
import { useVariableTableUnlockSession } from './useVariableTableUnlockSession';
import type { CellHintInfo } from './variableTableHints';

export interface FieldProps {
  id: string;
  /** Column label, rendered as a mobile-only `<label>` (the desktop column
   *  headers live in the table's single header band). */
  label: string;
  /** Programmatic label — always set so each input carries a section-aware
   *  accessible name on desktop, where the visible `<label>` is hidden. */
  ariaLabel: string;
  value: string;
  onChange: (next: string) => void;
  /** Hint resolution for this cell — popup entries (free + paid) + the
   *  remaining ladder length. */
  info: CellHintInfo;
  /** True iff a lock entry exists for this cell's expected-row key AND the
   *  current matcher report still shows the cell correct. Locked cells render
   *  as plain text spans (no input chrome, no hint chrome). */
  locked: boolean;
  /** Store lock key for this cell — string when `locked`, null otherwise.
   *  Snapshotted at edit-session start so the matcher pairing the lock was
   *  born under is the one cleared on blur, even if intervening edits to
   *  other rows shifted the studentIndex → expectedIndex mapping. */
  lockKey: string | null;
  /** Per-Tjek flash on this cell — emerald for newly-locked, rose for wrong
   *  or stale-lock cleanup. `null` between Tjeks. */
  flash: 'correct' | 'wrong' | null;
  /** Nonce that remounts the flash wrapper so a repeat-Tjek with identical
   *  flash keys still re-triggers the CSS transition. */
  flashNonce: number;
  /** False under `prefers-reduced-motion: reduce` — the colour still paints
   *  for the 1.5s window, but the fade transition is skipped. */
  flashWithTransition: boolean;
  /** Combined tooltip + sr-only prefix text for the locked branch. */
  lockedTooltipContent: ReactNode;
  /** Resolved sr-only description announced when the cell is armed-spendable. */
  armedSpendableAriaDescription: string;
  allowPaste?: boolean;
  armed: boolean;
  onSpend: () => void;
  onUnlock: (lockKey: string) => void;
}

export function flashClasses(
  flash: 'correct' | 'wrong' | null,
  flashWithTransition: boolean,
  locked: boolean,
): { flashClass: string; inputFlashClass: string } {
  // Flash wrapper class — shared by both branches so the column width is
  // identical input ↔ span. The static colour class (bg-emerald-100 /
  // bg-rose-100) paints immediately on mount; the keyframe utility
  // `animate-vt-flash-fade` (defined in globals.css) then fades the
  // background to transparent over 1500ms. Under reduced motion the
  // keyframe is omitted and the colour stays solid for the 1500ms window
  // (matching the prefers-reduced-motion contract — no animated motion,
  // but the visual signal still arrives). The `key={flashNonce}` remount
  // restarts the animation on repeat-Tjek with identical keys.
  const flashBg =
    flash === 'correct' ? 'bg-emerald-100' : flash === 'wrong' ? 'bg-rose-100' : 'bg-transparent';
  // Emerald fades to transparent (locked input is bg-transparent → page bg
  // shows through both during and after the fade). Rose fades to white
  // (editable input is forced transparent during flash, so the wrapper
  // bleeds through; the input regains its native bg-white when flash clears
  // — fading the wrapper to white makes that transition seamless).
  const flashAnim =
    flash !== null && flashWithTransition
      ? flash === 'wrong'
        ? ' animate-vt-flash-fade-to-white'
        : ' animate-vt-flash-fade'
      : '';
  const flashClass = `rounded ${flashBg}${flashAnim}`;
  // ProtectedInput hardcodes `bg-white`, which would cover the wrapper's
  // rose flash on the unlocked branch. Force the input transparent for the
  // flash window so the wrapper's animated rose bleeds through and fades
  // alongside the keyframe (a static `!bg-rose-100` on the input would
  // *defeat* the animation — `!important` beats the keyframe's intermediate
  // values, so the colour would snap on/off instead of fading). The locked
  // branch's input is already `bg-transparent`, so the emerald flash works
  // the same way; this just makes the editable branch behave identically.
  const inputFlashClass = flash === 'wrong' && !locked ? ' !bg-transparent' : '';

  return { flashClass, inputFlashClass };
}

export function Field({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  info,
  locked,
  lockKey,
  flash,
  flashNonce,
  flashWithTransition,
  lockedTooltipContent,
  armedSpendableAriaDescription,
  allowPaste,
  armed,
  onSpend,
  onUnlock,
}: FieldProps) {
  const armedSpendable = !locked && armed && info.nextTier !== null;
  // Hint-count pips: editable + popup will open on focus. N tiny amber
  // vertical ticks at bottom-left communicate "this cell has N hints" — one
  // tick per popup bullet, so the count matches what the student will read
  // when the popup opens. Stays visible while armed (the armed border is a
  // separate "spend mode" cue, not a hint-count cue). Gated on popupEntries
  // (not cap directly) so the indicator stays hidden mid-edit when the
  // section is dirty and the popup will not open. Locked cells never carry
  // hint chrome (the lock IS the affordance).
  const showHintTicks = !locked && info.popupEntries.length > 0;

  const inputClass = armedSpendable
    ? 'w-full border-amber-400 ring-1 ring-amber-300 cursor-pointer'
    : 'w-full hover:bg-accent-50 focus:border-accent-400 focus:!ring-0';

  const armedDescId = `${id}-armed`;
  const ariaDescribedBy = armedSpendable ? armedDescId : undefined;

  // Spend + auto-focus the cell so the popup opens with fresh entries.
  // Browser order on click: mousedown → focus → click. We preventDefault on
  // mousedown to suppress the natural focus (the popup would open against
  // stale entries), dispatch the spend, then re-focus on the next macrotask —
  // by which point React has flushed the reveal into popupEntries and
  // HintPopup's freshly-cloned onFocus sees willOpen=true.
  const handleMouseDown = (e: MouseEvent<HTMLInputElement>) => {
    if (!armedSpendable) return;
    e.preventDefault();
    onSpend();
    setTimeout(() => document.getElementById(id)?.focus(), 0);
  };
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (armedSpendable && e.key === 'Enter') {
      e.preventDefault();
      onSpend();
      // Already focused — but HintPopup's onFocus only fires on focus
      // *transitions*. Force a blur+refocus so the popup re-opens against
      // fresh entries.
      setTimeout(() => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        el?.blur();
        el?.focus();
      }, 0);
    }
  };

  const { isReadonlyRender, wrapperHandlers, onInputBlur } = useVariableTableUnlockSession({
    id,
    locked,
    lockKey,
    value,
    onUnlock,
  });

  const { flashClass, inputFlashClass } = flashClasses(flash, flashWithTransition, locked);

  return (
    <div className="min-w-0" data-locked={locked ? 'true' : undefined}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600 sm:hidden">
        {label}
      </label>
      {/* When locked-correct, the wrapper is the keyboard-reachable unlock
          affordance: tabIndex=0 + role=button puts the cell back in the
          tab order (the input itself stays tabIndex=-1 so SR users land on
          the wrapper's labelled button instead of an anonymous readonly
          input), and the aria-label tells the student what activates it.
          Enter / F2 / Space all trigger startEditSession via the existing
          keydown handler. focus-visible ring matches the readonly input's
          own ring so the visual cue is the same whichever element receives
          focus. */}
      <span
        className={`group/cell relative inline-block w-full${
          isReadonlyRender
            ? ' rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400'
            : ''
        }`}
        tabIndex={isReadonlyRender ? 0 : undefined}
        role={isReadonlyRender ? 'button' : undefined}
        aria-label={
          isReadonlyRender
            ? `${ariaLabel}. ${strings.widgets.variableTable.lockedTooltipScreenReaderPrefix} ${strings.widgets.variableTable.lockedKeyboardImperative}.`
            : undefined
        }
        {...wrapperHandlers}
      >
        <span key={flashNonce} className={`block w-full ${flashClass}`}>
          {isReadonlyRender ? (
            <Tooltip content={lockedTooltipContent} openDelayMs={500} fullWidth>
              <input
                id={id}
                type="text"
                value={value}
                readOnly
                aria-label={ariaLabel}
                // Suppress the input's own tab stop; the wrapper-span above
                // is the tabbable element when locked (role=button + tabIndex=0
                // + aria-label), so the cell remains one keyboard-reachable
                // unlock target instead of two adjacent focus stops.
                tabIndex={-1}
                className="block w-full cursor-default rounded border border-slate-200 bg-transparent px-3 py-1.5 text-sm text-slate-800 read-only:focus:outline-none read-only:focus:ring-1 read-only:focus:ring-slate-300"
                style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                onChange={() => {}}
              />
            </Tooltip>
          ) : (
            <HintPopup entries={info.popupEntries}>
              <ProtectedInput
                id={id}
                type="text"
                value={value}
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedBy}
                allowPaste={allowPaste}
                onChange={(e) => onChange(e.target.value)}
                onMouseDown={handleMouseDown}
                onKeyDown={handleInputKeyDown}
                onBlur={onInputBlur}
                className={`${inputClass}${inputFlashClass}`}
              />
            </HintPopup>
          )}
        </span>
        {showHintTicks && (
          // On focus-within (= popup is open) the container slides DOWN by 8 px
          // (bottom-0.5 → -bottom-1.5) and each pip grows from 6 px to 14 px,
          // so the pip top stays put while the bottom reaches the popup's top
          // edge (the popup is `top-full mt-1.5` = 6 px below the input). Net
          // effect: the pips become a visual bridge from input to hint box.
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2 bottom-0.5 flex gap-0.5 transition-all duration-150 group-focus-within/cell:-bottom-1.5"
          >
            {info.popupEntries.map((entry) => (
              <span
                key={`${id}-tick-${entry.key}`}
                className="block h-1.5 w-0.5 rounded-sm bg-amber-400 transition-all duration-150 group-focus-within/cell:h-3.5"
              />
            ))}
          </span>
        )}
      </span>
      {armedSpendable && (
        <span id={armedDescId} className="sr-only">
          {armedSpendableAriaDescription}
        </span>
      )}
    </div>
  );
}
