// React context wrapping runner state + dispatch + widget/sim live registries.
import type { Phase } from '@/lib/schema';
import type { ProgressEvent, SimulationModule } from '@/sim-contract';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { GateCtx, WidgetState } from './gates';
import {
  type DataRow,
  type LabMode,
  type Mode,
  type RunnerState,
  emptyState,
  isStateCompatible,
  load,
  save,
  wipe,
} from './runner';
import { runnerReducer } from './runnerReducer';

interface RunnerApi {
  state: RunnerState;
  phases: Phase[];
  simulation: SimulationModule | undefined;
  /** Bumps on `resetLab()` — use as a React `key` on the simulation component
   * so its internal state remounts cleanly along with the runner state. */
  resetKey: number;
  setCurrentPhase: (phaseId: string) => void;
  setMode: (mode: Mode) => void;
  setLabMode: (mode: LabMode) => void;
  setWidgetValue: (id: string, value: unknown) => void;
  setDataTable: (id: string, rows: DataRow[]) => void;
  bumpAttempts: (id: string) => number;
  fireMilestone: (id: string) => void;
  onSimulationProgress: (e: ProgressEvent) => void;
  setSimulationState: (state: unknown) => void;
  registerWidgetState: (id: string, state: WidgetState | null) => void;
  gateCtx: GateCtx;
  resetLab: () => void;
}

const RunnerContext = createContext<RunnerApi | null>(null);

export function RunnerProvider({
  experimentId,
  experimentVersion,
  phases,
  simulation,
  children,
  initialMode = 'guided',
  initialLabMode = 'virtual',
}: {
  experimentId: string;
  experimentVersion: number;
  phases: Phase[];
  simulation?: SimulationModule;
  initialMode?: Mode;
  initialLabMode?: LabMode;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(runnerReducer, undefined, () => {
    const loaded = load(experimentId);
    if (loaded && isStateCompatible(loaded, experimentVersion, phases)) {
      // URL-driven mode wins over the persisted mode field — mode is a view
      // setting, not progress. Other fields (currentPhaseId, widgetValues, …)
      // are preserved as-is.
      return loaded.mode === initialMode ? loaded : { ...loaded, mode: initialMode };
    }
    if (loaded) {
      console.info(`[htxlabs] state mismatch for ${experimentId} — wiping and restarting.`);
      wipe(experimentId);
    }
    return emptyState(experimentId, experimentVersion, phases, initialMode, initialLabMode);
  });

  // Persist on every change.
  useEffect(() => {
    save(state);
  }, [state]);

  // Live widget state map — kept in a ref so widget renders don't trigger
  // a runner re-render cascade. Gate evaluation reads from here.
  const widgetStateRef = useRef<Record<string, WidgetState>>({});
  const simulationStateRef = useRef<unknown>(null);
  // Tick to force gate-evaluating subscribers to re-render after widget changes.
  const [tick, setTick] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  // Track latest committed state + pending in-render bumps so `bumpAttempts`
  // can return the correct next count even on synchronous re-entry within
  // the same render. Cleared on every commit.
  const stateRef = useRef(state);
  const pendingBumpsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    stateRef.current = state;
    pendingBumpsRef.current = {};
  }, [state]);

  const setCurrentPhase = useCallback((id: string) => {
    dispatch({ type: 'SET_CURRENT_PHASE', id });
  }, []);

  const setMode = useCallback((mode: Mode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const setLabMode = useCallback((labMode: LabMode) => {
    dispatch({ type: 'SET_LAB_MODE', labMode });
  }, []);

  const setWidgetValue = useCallback((id: string, value: unknown) => {
    dispatch({ type: 'SET_WIDGET_VALUE', id, value });
  }, []);

  const setDataTable = useCallback((id: string, rows: DataRow[]) => {
    dispatch({ type: 'SET_DATA_TABLE', id, rows });
  }, []);

  const bumpAttempts = useCallback((id: string): number => {
    const committed = stateRef.current.attemptCounts[id] ?? 0;
    const pending = pendingBumpsRef.current[id] ?? 0;
    const next = committed + pending + 1;
    pendingBumpsRef.current[id] = pending + 1;
    dispatch({ type: 'BUMP_ATTEMPTS', id });
    return next;
  }, []);

  const fireMilestone = useCallback((id: string) => {
    dispatch({ type: 'FIRE_MILESTONE', id });
  }, []);

  const onSimulationProgress = useCallback((e: ProgressEvent) => {
    switch (e.type) {
      case 'milestone':
        dispatch({ type: 'FIRE_MILESTONE', id: e.id });
        break;
      case 'data-collected':
        dispatch({ type: 'INCREMENT_DATA_POINTS', count: e.count });
        break;
      case 'reset':
        break;
    }
  }, []);

  const setSimulationState = useCallback((s: unknown) => {
    simulationStateRef.current = s;
    setTick((t) => t + 1);
  }, []);

  const registerWidgetState = useCallback((id: string, ws: WidgetState | null) => {
    if (ws === null) {
      delete widgetStateRef.current[id];
    } else {
      widgetStateRef.current[id] = ws;
    }
    setTick((t) => t + 1);
  }, []);

  const resetLab = useCallback(() => {
    wipe(experimentId);
    dispatch({
      type: 'RESET',
      nextState: emptyState(experimentId, experimentVersion, phases, initialMode, initialLabMode),
    });
    simulationStateRef.current = null;
    setResetKey((k) => k + 1);
  }, [experimentId, experimentVersion, phases, initialMode, initialLabMode]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-create on every state-or-tick change so consumers re-evaluate gates after widget (re)registration
  const gateCtx: GateCtx = useMemo(
    () => ({ widgets: widgetStateRef.current, simulationStateRef }),
    [state, tick],
  );

  const api: RunnerApi = {
    state,
    phases,
    simulation,
    resetKey,
    setCurrentPhase,
    setMode,
    setLabMode,
    setWidgetValue,
    setDataTable,
    bumpAttempts,
    fireMilestone,
    onSimulationProgress,
    setSimulationState,
    registerWidgetState,
    gateCtx,
    resetLab,
  };

  return <RunnerContext.Provider value={api}>{children}</RunnerContext.Provider>;
}

export function useRunner(): RunnerApi {
  const ctx = useContext(RunnerContext);
  if (!ctx) throw new Error('useRunner must be used within RunnerProvider');
  return ctx;
}
