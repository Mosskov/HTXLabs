// Hook: register a widget as hint-eligible against the surrounding phase
// scope (provided by PhaseScopeContext). Cleans up on unmount — eligibility
// is structural (live phase ownership), not value-bearing, so the registry
// must shrink when a widget unmounts.
//
// `enabled === false` skips registration entirely (e.g. RubricResponse with
// a parse failure, or VariableTable without an `expected` answer key — no
// ladder, no hint surface).
import { useEffect } from 'react';
import { usePhaseScope } from './PhaseScopeContext';
import { type HintEligibilityKind, useRunner } from './RunnerContext';

export function useRegisteredHintEligibility(
  id: string,
  enabled: boolean,
  kind: HintEligibilityKind,
): void {
  const { registerHintEligibility } = useRunner();
  const phaseId = usePhaseScope();
  useEffect(() => {
    if (!enabled || phaseId === null) return;
    registerHintEligibility(id, { phaseId, kind });
    return () => registerHintEligibility(id, null);
  }, [id, enabled, kind, phaseId, registerHintEligibility]);
}
