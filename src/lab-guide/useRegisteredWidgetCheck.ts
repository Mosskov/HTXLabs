// Hook: register a widget's footer-invokable check action with the runner.
import { type RefObject, useEffect } from 'react';
import { useRunner } from './RunnerContext';
import type { WidgetCheck } from './widgetCheck';

/** Register the stable check object `checkRef.current` against `id` so the
 *  PhaseFooter can invoke this widget's Tjek. Mirrors `useRegisteredWidgetState`
 *  with one deliberate divergence: this hook **cleans up on unmount**. A check
 *  action is a live React callback bound to a mounted widget — it must not
 *  outlive its widget (unlike registered widget *state*, which deliberately
 *  persists across phase changes so a gate stays satisfied).
 *
 *  The widget keeps `checkRef` stable and mutates `checkRef.current` in place
 *  each render, so no re-registration is needed for `label`/`run` changes —
 *  the footer reads the live object. `revision` is the explicit re-fire knob:
 *  bump it on a `pending` edge so the footer re-renders and re-reads.
 */
export function useRegisteredWidgetCheck(
  id: string,
  enabled: boolean,
  checkRef: RefObject<WidgetCheck>,
  revision: number,
): void {
  const { registerWidgetCheck } = useRunner();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` is an intentional re-registration trigger (carries `pending` edges to the footer); `checkRef.current` is read fresh each fire, never captured
  useEffect(() => {
    if (!enabled || checkRef.current == null) return;
    registerWidgetCheck(id, checkRef.current);
    return () => registerWidgetCheck(id, null);
  }, [id, enabled, registerWidgetCheck, checkRef, revision]);
}
