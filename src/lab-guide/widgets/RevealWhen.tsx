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
import { type ReactNode, useEffect, useRef } from 'react';
import { useRunner } from '../RunnerContext';
import { widgetSatisfied } from '../gates';

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
