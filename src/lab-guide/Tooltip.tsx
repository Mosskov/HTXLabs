// Accessible hover/focus/tap tooltip: clones its single trigger child to inject
// role="tooltip" + a permanent aria-describedby + the hover/focus handlers;
// dismiss on blur, Escape, or pointer-leave. The bubble is absolutely
// positioned with no portal — it assumes the nearest positioned ancestor does
// not clip overflow. `align` flips its horizontal anchor for a trigger near a
// layout edge; the vertical side (below / above) is chosen on each open from
// the room left in the viewport, so a trigger near the bottom still shows it.
// Note: a truly `disabled` <button> fires no pointer events — wrap an
// `aria-disabled` button instead so the tooltip can open.
import {
  type KeyboardEvent,
  type ReactElement,
  cloneElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

interface Props {
  /** Tooltip text — shown to sighted and assistive-tech users alike. */
  content: string;
  /** Single trigger element; cloned to receive handlers + aria-describedby. */
  children: ReactElement;
  className?: string;
  /** Horizontal anchor of the bubble. `'left'` (default) aligns the bubble's
   *  left edge to the trigger; `'right'` aligns its right edge — use it when
   *  the trigger sits near the right edge of the layout (e.g. the footer
   *  button) so the bubble grows inward instead of off-screen. */
  align?: 'left' | 'right';
}

export function Tooltip({ content, children, className, align = 'left' }: Props) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const spanRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // On open, pick the vertical side: below by default, flipped above when the
  // bubble would overflow the viewport bottom and there is more room above.
  // Runs in useLayoutEffect so the corrected re-render lands before paint.
  useLayoutEffect(() => {
    if (!open) return;
    const span = spanRef.current;
    const bubble = bubbleRef.current;
    if (!span || !bubble) return;
    const rect = span.getBoundingClientRect();
    const bubbleHeight = bubble.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setPlacement(spaceBelow < bubbleHeight + 8 && spaceAbove > spaceBelow ? 'top' : 'bottom');
  }, [open]);

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
    <span ref={spanRef} className={`relative inline-block${className ? ` ${className}` : ''}`}>
      {trigger}
      {/* Always mounted so a focused trigger always announces the reason;
          sr-only when closed, positioned above/below the trigger when open. */}
      <div
        ref={bubbleRef}
        role="tooltip"
        id={tipId}
        data-open={open}
        className={
          open
            ? `absolute ${align === 'right' ? 'right-0' : 'left-0'} ${
                placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
              } z-10 max-w-[20rem] rounded bg-slate-800 px-3 py-2 text-sm leading-snug text-white shadow-lg`
            : 'sr-only'
        }
      >
        {content}
      </div>
    </span>
  );
}
