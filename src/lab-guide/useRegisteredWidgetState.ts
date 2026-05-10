// Hook: register a widget's gate-relevant state with the runner.
import { useEffect } from 'react';
import { useRunner } from './RunnerContext';
import type { WidgetState } from './gates';

/** Register `state` against `id` in the runner's widget map. The runner keeps
 * the registry in a ref (not React state) so widget renders don't cascade
 * through the gate evaluators; passing the same object identity every render
 * still triggers the effect, so the caller supplies a `deps` array of the
 * scalar fields that should drive re-registration.
 *
 * Deliberately no unmount cleanup: registered state must outlive a phase
 * change so the gate stays satisfied when the student navigates away and
 * back. Pass `null` to explicitly clear (e.g. Quiz's pre-check state).
 */
export function useRegisteredWidgetState(
  id: string,
  state: WidgetState | null,
  deps: ReadonlyArray<unknown>,
): void {
  const { registerWidgetState } = useRunner();
  // biome-ignore lint/correctness/useExhaustiveDependencies: scalar deps come from the caller; `state` itself is recomputed every render and would re-fire the effect uselessly
  useEffect(() => {
    registerWidgetState(id, state);
  }, [id, registerWidgetState, ...deps]);
}
