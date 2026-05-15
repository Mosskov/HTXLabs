// MDX primitive: render children only when every widget in `widgetIds`
// reports a positive satisfaction bit. Mirrors the kind-aware projection
// used by the `'all-satisfied'` gate.
//
// `clearOnHide` is the invalidation contract: when the reveal flips from
// visible to hidden, each listed widget id is removed from the runner's
// widget registry. Without this, a previously-satisfied child widget
// (which `useRegisteredWidgetState` does NOT clean up on unmount — see
// the comment on that hook for why) would keep ghost-satisfying a phase
// gate while visually hidden.
import { type ReactNode, useEffect, useRef } from 'react';
import { useRunner } from '../RunnerContext';
import type { WidgetState } from '../gates';

interface Props {
  widgetIds: string[];
  /** Widget ids to remove from the runner registry when the reveal flips
   *  from visible to hidden. Typically the ids of child widgets rendered
   *  inside this RevealWhen so their stale `satisfied: true` doesn't keep
   *  counting after the section disappears. Idempotent — clearing an
   *  already-absent id is a no-op. */
  clearOnHide?: string[];
  children: ReactNode;
}

function widgetSatisfied(w: WidgetState | undefined): boolean {
  if (!w) return false;
  switch (w.kind) {
    case 'correct':
      return w.correct;
    case 'checked':
      return w.allChecked;
    case 'filled':
      return w.filled;
    case 'rubric':
      return w.satisfied;
    case 'keywords':
      return w.total > 0 && w.foundCount === w.total;
  }
}

export function RevealWhen({ widgetIds, clearOnHide, children }: Props) {
  const { gateCtx, registerWidgetState } = useRunner();
  const visible = widgetIds.every((id) => widgetSatisfied(gateCtx.widgets[id]));

  // Track the previous visibility so we can detect the visible→hidden edge
  // and clear dependent widget state once per transition, not on every
  // render while hidden.
  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    if (prevVisibleRef.current && !visible && clearOnHide) {
      for (const id of clearOnHide) {
        registerWidgetState(id, null);
      }
    }
    prevVisibleRef.current = visible;
  }, [visible, clearOnHide, registerWidgetState]);

  if (!visible) return null;
  return <>{children}</>;
}
