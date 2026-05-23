// Sole owner of the ephemeral hint-spend mode. Reload drops the armed cursor
// by design — spend mode is never persisted. The context also handles the
// Escape-key dismissal and auto-clears whenever currentPhaseId changes.
//
// Provider order in LabGuide.tsx: <RunnerProvider> > <HintSpendProvider> >
// <LabBody>. HintSpendProvider depends on useRunner() for the phase-change
// subscription, but RunnerProvider has no reverse dependency.
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRunner } from './RunnerContext';

export type SpendMode = { kind: 'idle' } | { kind: 'active'; phaseId: string };

interface HintSpendApi {
  spendMode: SpendMode;
  enterSpendMode: (phaseId: string) => void;
  exitSpendMode: () => void;
}

const IDLE: SpendMode = { kind: 'idle' };

// Default-tolerant context. Widgets mounted outside a HintSpendProvider (tests
// that render a widget under only RunnerProvider, dev tools, etc.) read a
// permanently-idle spend mode with no-op setters — they cannot arm spend mode
// without the provider, which is the intended behaviour. LabGuide.tsx mounts
// the real provider so production paths always get the live state.
const NULL_API: HintSpendApi = {
  spendMode: IDLE,
  enterSpendMode: () => {},
  exitSpendMode: () => {},
};

const HintSpendContext = createContext<HintSpendApi>(NULL_API);

export function HintSpendProvider({ children }: { children: ReactNode }) {
  const { state } = useRunner();
  const [spendMode, setSpendMode] = useState<SpendMode>(IDLE);

  const enterSpendMode = useCallback((phaseId: string) => {
    setSpendMode({ kind: 'active', phaseId });
  }, []);

  const exitSpendMode = useCallback(() => setSpendMode(IDLE), []);

  // Phase-change clears the armed cursor. The student can't keep a spend-mode
  // selection alive across phases (the lightbulbs they were aiming at belong
  // to a different phase's eligibility list).
  // biome-ignore lint/correctness/useExhaustiveDependencies: state.currentPhaseId IS the trigger — the effect body doesn't reference it because we always reset to IDLE
  useEffect(() => {
    setSpendMode(IDLE);
  }, [state.currentPhaseId]);

  // Global Escape dismisses spend mode. Only listens while armed so we don't
  // intercept Escape in other UI (e.g. dialogs).
  useEffect(() => {
    if (spendMode.kind !== 'active') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setSpendMode(IDLE);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [spendMode.kind]);

  const api = useMemo<HintSpendApi>(
    () => ({ spendMode, enterSpendMode, exitSpendMode }),
    [spendMode, enterSpendMode, exitSpendMode],
  );

  return <HintSpendContext.Provider value={api}>{children}</HintSpendContext.Provider>;
}

export function useHintSpend(): HintSpendApi {
  return useContext(HintSpendContext);
}
