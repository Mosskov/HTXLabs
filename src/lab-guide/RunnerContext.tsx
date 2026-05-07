import type { Phase } from '@/lib/schema';
import type { ProgressEvent } from '@/sim-contract';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

interface RunnerApi {
  state: RunnerState;
  phases: Phase[];
  setCurrentPhase: (phaseId: string) => void;
  setMode: (mode: Mode) => void;
  setLabMode: (mode: LabMode) => void;
  setWidgetValue: (id: string, value: unknown) => void;
  setDataTable: (id: string, rows: DataRow[]) => void;
  bumpAttempts: (id: string) => number;
  fireMilestone: (id: string) => void;
  onSimulationProgress: (e: ProgressEvent) => void;
  registerWidgetState: (id: string, state: WidgetState | null) => void;
  gateCtx: GateCtx;
  resetLab: () => void;
}

const RunnerContext = createContext<RunnerApi | null>(null);

export function RunnerProvider({
  experimentId,
  experimentVersion,
  phases,
  children,
  initialMode = 'guided',
  initialLabMode = 'virtual',
}: {
  experimentId: string;
  experimentVersion: number;
  phases: Phase[];
  initialMode?: Mode;
  initialLabMode?: LabMode;
  children: ReactNode;
}) {
  const [state, setState] = useState<RunnerState>(() => {
    const loaded = load(experimentId);
    if (loaded && isStateCompatible(loaded, experimentVersion, phases)) return loaded;
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
  const [, setTick] = useState(0);

  const setCurrentPhase = useCallback(
    (phaseId: string) =>
      setState((s) => {
        const visited = new Set(s.visitedPhaseIds);
        visited.add(phaseId);
        return { ...s, currentPhaseId: phaseId, visitedPhaseIds: visited };
      }),
    [],
  );

  const setMode = useCallback((mode: Mode) => setState((s) => ({ ...s, mode })), []);
  const setLabMode = useCallback((labMode: LabMode) => setState((s) => ({ ...s, labMode })), []);

  const setWidgetValue = useCallback((id: string, value: unknown) => {
    setState((s) => ({ ...s, widgetValues: { ...s.widgetValues, [id]: value } }));
  }, []);

  const setDataTable = useCallback((id: string, rows: DataRow[]) => {
    setState((s) => ({ ...s, dataTables: { ...s.dataTables, [id]: rows } }));
  }, []);

  const bumpAttempts = useCallback((id: string): number => {
    let next = 0;
    setState((s) => {
      next = (s.attemptCounts[id] ?? 0) + 1;
      return { ...s, attemptCounts: { ...s.attemptCounts, [id]: next } };
    });
    return next;
  }, []);

  const fireMilestone = useCallback((id: string) => {
    setState((s) => {
      if (s.firedMilestones.has(id)) return s;
      const fm = new Set(s.firedMilestones);
      fm.add(id);
      return { ...s, firedMilestones: fm };
    });
  }, []);

  const onSimulationProgress = useCallback(
    (e: ProgressEvent) => {
      switch (e.type) {
        case 'milestone':
          fireMilestone(e.id);
          break;
        case 'data-collected':
          setState((s) => ({ ...s, dataPointCount: s.dataPointCount + e.count }));
          break;
        case 'reset':
          // Resets are pedagogical, not destructive — just bump a milestone marker.
          fireMilestone('__reset__');
          break;
      }
    },
    [fireMilestone],
  );

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
    setState(emptyState(experimentId, experimentVersion, phases, initialMode, initialLabMode));
  }, [experimentId, experimentVersion, phases, initialMode, initialLabMode]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-create on every state change so consumers re-evaluate gates
  const gateCtx: GateCtx = useMemo(
    () => ({ widgets: widgetStateRef.current, simulationStateRef }),
    [state],
  );

  const api: RunnerApi = useMemo(
    () => ({
      state,
      phases,
      setCurrentPhase,
      setMode,
      setLabMode,
      setWidgetValue,
      setDataTable,
      bumpAttempts,
      fireMilestone,
      onSimulationProgress,
      registerWidgetState,
      gateCtx,
      resetLab,
    }),
    [
      state,
      phases,
      setCurrentPhase,
      setMode,
      setLabMode,
      setWidgetValue,
      setDataTable,
      bumpAttempts,
      fireMilestone,
      onSimulationProgress,
      registerWidgetState,
      gateCtx,
      resetLab,
    ],
  );

  return <RunnerContext.Provider value={api}>{children}</RunnerContext.Provider>;
}

export function useRunner(): RunnerApi {
  const ctx = useContext(RunnerContext);
  if (!ctx) throw new Error('useRunner must be used within RunnerProvider');
  return ctx;
}
