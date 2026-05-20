// MDX primitive: render children only when every widget in `widgetIds`
// reports a positive satisfaction bit. Uses the same kind-aware projection
// as the `'all-satisfied'` gate (imported from gates.ts — single source).
//
// `clearOnHide` is the invalidation contract: when the reveal flips from
// visible to hidden, each listed widget id is removed from the runner's
// widget registry. Without this, a previously-satisfied child widget
// (which `useRegisteredWidgetState` does NOT clean up on unmount — see
// the comment on that hook for why) would keep ghost-satisfying a phase
// gate while visually hidden.
//
// `scrollOnReveal` smooth-scrolls + focuses the revealed content on the
// hidden→visible transition. It must fire only on a real user-action reveal,
// never on a cold reload that hydrates persisted-correct state — see the
// two-ref guard in the effect below.
import { type ReactNode, useEffect, useRef } from 'react';
import { useRunner } from '../RunnerContext';
import { widgetSatisfied } from '../gates';

/** Scroll `el` into view and move keyboard/SR focus to it. Honors
 *  prefers-reduced-motion (instant scroll). Scroll first, then focus with
 *  `preventScroll` so focus does not fight the smooth scroll. */
function revealIntoView(el: HTMLElement | null) {
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

interface Props {
  widgetIds: string[];
  /** Widget ids to remove from the runner registry when the reveal flips
   *  from visible to hidden. Typically the ids of child widgets rendered
   *  inside this RevealWhen so their stale `satisfied: true` doesn't keep
   *  counting after the section disappears. Idempotent — clearing an
   *  already-absent id is a no-op. */
  clearOnHide?: string[];
  /** Opt-in correctness requirement. When true, the reveal projects
   *  `kind: 'filled'` widgets as `filled && correct === true` instead of
   *  presence-only. Same semantics as the `all-satisfied` gate's `strict`
   *  flag — see `widgetSatisfied`. */
  strict?: boolean;
  /** When true, smooth-scroll the revealed content into view and move focus
   *  to it on the hidden→visible transition — never on initial
   *  mount-while-visible. Reload-safe (see the effect's two-ref guard).
   *  Honors `prefers-reduced-motion`. */
  scrollOnReveal?: boolean;
  children: ReactNode;
}

export function RevealWhen({ widgetIds, clearOnHide, strict, scrollOnReveal, children }: Props) {
  const { gateCtx, registerWidgetState } = useRunner();
  const visible = widgetIds.every((id) => widgetSatisfied(gateCtx.widgets[id], strict));
  // True once every watched widget has registered any state. On a user-action
  // reveal the watched widgets were present (registered-but-unsatisfied) across
  // renders before the flip; on a cold reload they go absent→satisfied in one
  // step — the distinguishing signal used by the scroll guard below.
  const allPresent = widgetIds.every((id) => gateCtx.widgets[id] !== undefined);

  const containerRef = useRef<HTMLDivElement>(null);
  // Track previous visibility (clearOnHide edge + scroll edge) and previous
  // registry presence (scroll guard). `prevAllPresentRef` advances on the
  // registration render via the `allPresent` effect dep, even while `visible`
  // is still false.
  const prevVisibleRef = useRef(visible);
  const prevAllPresentRef = useRef(allPresent);
  useEffect(() => {
    if (prevVisibleRef.current && !visible && clearOnHide) {
      for (const id of clearOnHide) {
        registerWidgetState(id, null);
      }
    }
    // Scroll only on a genuine user-action reveal: the render before the flip
    // had all watched widgets already present. A cold reload registers a
    // watched widget absent→satisfied in one step, so `prevAllPresentRef` is
    // still false there and the scroll is suppressed.
    if (!prevVisibleRef.current && visible && scrollOnReveal && prevAllPresentRef.current) {
      revealIntoView(containerRef.current);
    }
    prevVisibleRef.current = visible;
    prevAllPresentRef.current = allPresent;
  }, [visible, allPresent, clearOnHide, scrollOnReveal, registerWidgetState]);

  if (!visible) return null;
  // Only the opt-in path wraps children — non-opt-in consumers keep the
  // byte-identical Fragment so existing layout is undisturbed.
  if (scrollOnReveal) {
    return (
      <div ref={containerRef} tabIndex={-1} className="outline-none">
        {children}
      </div>
    );
  }
  return <>{children}</>;
}
