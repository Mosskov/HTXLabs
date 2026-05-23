// Per-phase scope wrapper used by LabGuide to tag descendants with their
// owning phase. All phase bodies are mounted simultaneously (hidden via the
// `hidden` attribute), so widgets need a structural signal to register
// hint-eligibility against the correct phase — `useRunner().state.currentPhaseId`
// would label every widget with the active phase, which is wrong.
//
// `null` (the default) signals "no phase scope" — used in tests and dev tools
// that mount widgets outside a phase body.
import { type ReactNode, createContext, useContext } from 'react';

const PhaseScopeContext = createContext<string | null>(null);

export function PhaseScopeProvider({
  phaseId,
  children,
}: {
  phaseId: string;
  children: ReactNode;
}) {
  return <PhaseScopeContext.Provider value={phaseId}>{children}</PhaseScopeContext.Provider>;
}

/** Returns the owning phase id, or `null` when the descendant is not inside a
 *  PhaseScopeProvider. */
export function usePhaseScope(): string | null {
  return useContext(PhaseScopeContext);
}
