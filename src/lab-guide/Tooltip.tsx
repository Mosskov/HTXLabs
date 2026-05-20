// Accessible hover/focus/tap tooltip: clones its single trigger child to inject
// role="tooltip" + a permanent aria-describedby; dismiss on blur, Escape, or
// pointer-leave. The bubble is absolutely positioned with no portal — it
// assumes the nearest positioned ancestor (the instruction-box card) does not
// clip overflow.
import { type KeyboardEvent, type ReactElement, cloneElement, useId, useState } from 'react';

interface Props {
  /** Tooltip text — shown to sighted and assistive-tech users alike. */
  content: string;
  /** Single trigger element; cloned to receive handlers + aria-describedby. */
  children: ReactElement;
  className?: string;
}

export function Tooltip({ content, children, className }: Props) {
  const tipId = useId();
  const [open, setOpen] = useState(false);

  // Click is open (idempotent), NOT toggle: on a touch tap the event order is
  // pointerenter/focus (→ open) then click; a toggling click would re-close
  // what focus just opened. Dismissal is via blur, Escape, or pointer-leave.
  const trigger = cloneElement(children, {
    'aria-describedby': tipId,
    tabIndex: children.props.tabIndex ?? 0,
    onPointerEnter: () => setOpen(true),
    onPointerLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    onClick: () => setOpen(true),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.stopPropagation();
        setOpen(false);
      }
    },
  });

  return (
    <span className={`relative inline-block${className ? ` ${className}` : ''}`}>
      {trigger}
      {/* Always mounted so a focused trigger always announces the reason;
          sr-only when closed, visible-positioned below the row when open. */}
      <div
        role="tooltip"
        id={tipId}
        data-open={open}
        className={
          open
            ? 'absolute left-0 top-full z-10 mt-1 max-w-[16rem] rounded bg-slate-800 px-2 py-1 text-xs text-white shadow'
            : 'sr-only'
        }
      >
        {content}
      </div>
    </span>
  );
}
