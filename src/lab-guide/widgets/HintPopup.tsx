// Focus-triggered popup that surfaces revealed hint tiers (paid) and
// misconception / always-on diagnostics (free). Composed by RubricResponse +
// VariableTable: the consumer passes a pre-resolved `entries` list (built from
// the latest result/snapshot under the widget's own free-vs-paid gating rule)
// and wraps the input/textarea this popup is attached to.
//
// `entries.length === 0` → popup does not open at all on focus. The empty
// state is "no popup", not "empty popup".
import { type KeyboardEvent, type ReactElement, cloneElement, useId, useState } from 'react';
import { strings } from '../strings.da';
import { TieredHintList } from './TieredHintList';

export interface HintPopupEntry {
  key: string;
  text: string;
  /** Free misconception entries render in orange at the top. Paid ladder
   *  entries (and reveal text) render in neutral slate. */
  tone: 'misconception' | 'hint' | 'reveal';
  /** Optional section header rendered above the entry (criterion label, etc.).
   *  Adjacent entries with the same `group` share one header. */
  group?: string;
}

interface Props {
  entries: HintPopupEntry[];
  /** Single trigger element — input or textarea. Cloned to inject focus/blur
   *  handlers and `aria-describedby`. */
  children: ReactElement;
  /** Horizontal anchor of the popup. Defaults to `'left'`. */
  align?: 'left' | 'right';
}

export function HintPopup({ entries, children, align = 'left' }: Props) {
  const popupId = useId();
  const [open, setOpen] = useState(false);
  const willOpen = entries.length > 0;

  // Merge the popup id with any existing `aria-describedby` the consumer
  // already set (e.g. RubricResponse's word-count help id). Replacing it would
  // silently drop the consumer's description for AT users.
  const existingDescribedBy = children.props['aria-describedby'];
  const describedBy = willOpen
    ? [existingDescribedBy, popupId].filter(Boolean).join(' ')
    : existingDescribedBy;

  const trigger = cloneElement(children, {
    'aria-describedby': describedBy,
    onFocus: (e: React.FocusEvent) => {
      children.props.onFocus?.(e);
      if (willOpen) setOpen(true);
    },
    onBlur: (e: React.FocusEvent) => {
      children.props.onBlur?.(e);
      setOpen(false);
    },
    onKeyDown: (e: KeyboardEvent) => {
      children.props.onKeyDown?.(e);
      if (e.key === 'Escape' && open) {
        e.stopPropagation();
        setOpen(false);
      }
    },
  });

  if (!willOpen) {
    return <span className="inline-block w-full">{trigger}</span>;
  }

  return (
    <span className="relative inline-block w-full">
      {trigger}
      {open && (
        <section
          id={popupId}
          aria-label={strings.widgets.hints.popupAriaLabel}
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 z-20 w-80 max-w-[min(20rem,100vw)] rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg`}
        >
          <TieredHintList entries={entries} />
        </section>
      )}
    </span>
  );
}
