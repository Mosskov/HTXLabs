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
import type { WidgetCheck } from './widgetCheck';
import type { VariableTableValues } from './widgets/VariableTable';

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
  /** Bump the tier counter for a RubricResponse widget's failing criterion.
   *  Capped at `cap` (the criterion's `hints.length`). Idempotent at cap. */
  incrementRubricTier: (widgetId: string, criterionId: string, cap: number) => void;
  /** Bump the tier counter for a VariableTable widget's failing cell. Capped
   *  at `cap` (the cell's resolved hint-ladder length). Idempotent at cap.
   *  `cellKey` is a uniform dot-path `<section>.<expectedIndex>.<cell>` —
   *  e.g. `iv.0.symbol`, `dv.1.unit`, `constants.0.name`. */
  incrementVariableTableTier: (widgetId: string, cellKey: string, cap: number) => void;
  /** Snapshot the current VariableTable values as the most recent Tjek
   *  result. Overwrites any prior snapshot for that widget id. */
  setVariableTableLastChecked: (widgetId: string, values: VariableTableValues) => void;
  onSimulationProgress: (e: ProgressEvent) => void;
  setSimulationState: (state: unknown) => void;
  registerWidgetState: (id: string, state: WidgetState | null) => void;
  /** Register (or, with `null`, clear) a widget's footer-invokable check
   *  action. Parallel to `registerWidgetState` — see `widgetChecks`. */
  registerWidgetCheck: (id: string, check: WidgetCheck | null) => void;
  /** Live map of widget id → check action, read by `PhaseFooter` to drive the
   *  merged check button. Kept separate from `gateCtx.widgets` so the pure
   *  gate evaluators never see a React callback. Footer consumers re-render on
   *  `tick` via their existing `gateCtx` subscription. */
  widgetChecks: Record<string, WidgetCheck>;
  /** Latest snapshot of the sim's published state (via `onState`). Exposed so
   * widgets like the sim-mode `DataTable` can mirror sim-owned data without
   * adding a new ProgressEvent kind. Subscribe to `tick` (via gate evaluation
   * or `registerWidgetState`) to re-render on change. */
  simulationStateRef: { readonly current: unknown };
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
  // Parallel registry for footer-invokable widget check actions. Same ref-not-
  // -state pattern as `widgetStateRef`; read by `PhaseFooter`.
  const widgetCheckRef = useRef<Record<string, WidgetCheck>>({});
  // Seed from persisted state so sim-mirror consumers (sim-mode DataTable)
  // render the restored rows on the first paint, not after the sim's first
  // post-mount `onState` publish.
  const simulationStateRef = useRef<unknown>(state.simulationState);
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

  const incrementRubricTier = useCallback((widgetId: string, criterionId: string, cap: number) => {
    dispatch({ type: 'INCREMENT_RUBRIC_TIER', widgetId, criterionId, cap });
  }, []);

  const incrementVariableTableTier = useCallback(
    (widgetId: string, cellKey: string, cap: number) => {
      dispatch({ type: 'INCREMENT_VARIABLE_TABLE_TIER', widgetId, cellKey, cap });
    },
    [],
  );

  const setVariableTableLastChecked = useCallback(
    (widgetId: string, values: VariableTableValues) => {
      dispatch({ type: 'SET_VARIABLE_TABLE_LAST_CHECKED', widgetId, values });
    },
    [],
  );

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

  // Trailing-edge debounce for persisting the sim's published state. The ref
  // update + tick bump above are the fast path for predicate gates and the
  // sim-mode DataTable mirror; the reducer dispatch only needs to happen
  // often enough for reload-survival. 200ms keeps localStorage writes bounded
  // even if a future sim publishes on every animation frame.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSimulationState = useCallback((s: unknown) => {
    simulationStateRef.current = s;
    setTick((t) => t + 1);
    if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      dispatch({ type: 'SET_SIMULATION_STATE', state: s });
    }, 200);
  }, []);

  // Flush a pending sim-state debounce synchronously. The reducer dispatch
  // can't propagate during unmount or pagehide, so write directly through
  // `save()` using the latest committed state + the up-to-date sim ref.
  const flushSimulationState = useCallback(() => {
    if (persistTimerRef.current === null) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = null;
    save({ ...stateRef.current, simulationState: simulationStateRef.current });
  }, []);

  // Unmount cleanup: covers route changes inside the SPA.
  useEffect(() => {
    return () => flushSimulationState();
  }, [flushSimulationState]);

  // pagehide: covers hard reload, tab close, and bfcache transitions.
  // Preferred over `beforeunload` for mobile and bfcache reliability.
  useEffect(() => {
    const handler = () => flushSimulationState();
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, [flushSimulationState]);

  const registerWidgetState = useCallback((id: string, ws: WidgetState | null) => {
    if (ws === null) {
      delete widgetStateRef.current[id];
    } else {
      widgetStateRef.current[id] = ws;
    }
    setTick((t) => t + 1);
  }, []);

  const registerWidgetCheck = useCallback((id: string, check: WidgetCheck | null) => {
    if (check === null) {
      delete widgetCheckRef.current[id];
    } else {
      widgetCheckRef.current[id] = check;
    }
    setTick((t) => t + 1);
  }, []);

  const resetLab = useCallback(() => {
    // Cancel any pending sim-state persist so a late trailing-edge dispatch
    // can't resurrect the wiped state with a stale snapshot.
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
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
    incrementRubricTier,
    incrementVariableTableTier,
    setVariableTableLastChecked,
    onSimulationProgress,
    setSimulationState,
    registerWidgetState,
    registerWidgetCheck,
    widgetChecks: widgetCheckRef.current,
    simulationStateRef,
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

/** Read a peer widget's registered state. Used by widgets that compose
 *  ({@link RevealWhen}) or read sibling data (the template hypothesis section
 *  reads `'variables'` for symbol injection). Re-renders the caller when any
 *  widget registration changes via the existing `tick` subscription that
 *  `gateCtx` depends on. Returns `undefined` if the widget hasn't registered
 *  (yet, or after `RevealWhen.clearOnHide` cleared it). The caller narrows on
 *  `.kind` if it needs a specific shape. */
export function useWidgetState(id: string): WidgetState | undefined {
  const { gateCtx } = useRunner();
  return gateCtx.widgets[id];
}
