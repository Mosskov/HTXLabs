// React context wrapping runner state + dispatch + widget/sim live registries.
import { computeReplenishGrants } from '@/lib/hintReplenish';
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
  DEFAULT_HINT_POOL_SIZE,
  DEFAULT_HINT_REPLENISH_MINUTES,
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

/** A widget eligible to participate in the request-driven hint system —
 *  currently only `<RubricResponse>` and `<VariableTable expected>`. */
export type HintEligibilityKind = 'rubric' | 'vtCell';
export interface HintEligibility {
  phaseId: string;
  kind: HintEligibilityKind;
}

/** Bucket projection consumed by `HintBucket` and the centralized replenish
 *  effect. `tokens` reflects the absent-as-full rule; `msUntilNext` is `null`
 *  when the bucket is full or the timer is disabled. */
export interface BucketView {
  tokens: number;
  cap: number;
  msUntilNext: number | null;
  /** Full replenish interval in ms. `HintBucket` uses it with `msUntilNext`
   *  to compute the `BulbFilling` icon's progress (`(replenishMs - msUntilNext)
   *  / replenishMs`). `0` when the timer is disabled. */
  replenishMs: number;
  /** True when `cap === 0` (`hintPoolSize: 0` author override) — bucket is
   *  rendered disabled with the appropriate copy. */
  disabled: boolean;
}

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
  /** Atomic spend-and-reveal for a RubricResponse criterion. Caller supplies
   *  the criterion id and the hint ladder cap. Every spend costs 1 token —
   *  the per-criterion reveal variant retired with F9. The context layer
   *  resolves `phaseId` from `currentPhaseId`, `now` from `Date.now()`, and
   *  `poolCap` from the current phase's `hintPoolSize` override. The reducer
   *  re-validates token sufficiency + the tier ceiling against the latest
   *  state, so rapid double-clicks reveal at most one tier. */
  spendAndRevealRubricTier: (args: {
    widgetId: string;
    criterionId: string;
    hintCap: number;
  }) => void;
  /** Widget-level "show what's missing" reveal for a RubricResponse. Costs
   *  2 tokens; sets `rubricVerdictsRevealed[widgetId] = true` and freezes
   *  `rubricVerdictRowIds[widgetId]` to the criterion-id snapshot the widget
   *  computed at spend time. Idempotent in the reducer — a re-dispatch on an
   *  already-revealed widget is a no-op. */
  revealRubricVerdicts: (args: { widgetId: string; rowIds: readonly string[] }) => void;
  /** Atomic spend-and-reveal for a VariableTable cell ladder. Same shape as
   *  the rubric variant but VT has no reveal tier — every spend is a single
   *  tier advance. */
  spendAndRevealVtTier: (args: {
    widgetId: string;
    cellKey: string;
    /** The hint text the widget would surface at this tier (already F7-sliced
     *  by `resolveLadder`). Stored verbatim in `variableTableHintReveals` so
     *  later cell edits don't lose paid hints. */
    revealedText: string;
    hintCap: number;
  }) => void;
  /** Bucket projection for `phaseId` (defaults to `currentPhaseId`). Reads
   *  `hintTokens` / `hintLastReplenishAt` and applies the absent-as-full
   *  rule + replenishment math. */
  bucketView: (phaseId?: string) => BucketView;
  /** Snapshot the current VariableTable values as the most recent Tjek
   *  result. Overwrites any prior snapshot for that widget id. */
  setVariableTableLastChecked: (widgetId: string, values: VariableTableValues) => void;
  /** Lock a set of VariableTable cells (by `${section}.${expectedIndex}.${cell}`
   *  keys) as confirmed-correct. Idempotent — re-locking already-locked cells
   *  is a no-op. Empty `cellKeys` short-circuits. */
  lockVtCells: (widgetId: string, cellKeys: readonly string[]) => void;
  /** Unlock a single VariableTable cell by its expected-row key. When the
   *  resulting per-widget map is empty, the parent entry is dropped so the
   *  persisted state stays compact. Idempotent for unknown keys. */
  unlockVtCell: (widgetId: string, cellKey: string) => void;
  onSimulationProgress: (e: ProgressEvent) => void;
  setSimulationState: (state: unknown) => void;
  registerWidgetState: (id: string, state: WidgetState | null) => void;
  /** Register (or, with `null`, clear) a widget's footer-invokable check
   *  action. Parallel to `registerWidgetState` — see `widgetChecks`. */
  registerWidgetCheck: (id: string, check: WidgetCheck | null) => void;
  /** Register (or, with `null`, clear) a widget's hint eligibility. Structural
   *  — separate from value-bearing widget state — so the ticker/effect can
   *  decide which phase has hint-eligible widgets mounted under its scope. */
  registerHintEligibility: (id: string, eligibility: HintEligibility | null) => void;
  /** Register (or, with `null`, clear) a widget's live spendable-target count.
   *  Each hint-eligible widget reports how many of its targets currently have
   *  a remaining ladder + are eligible to receive a paid hint. The HintBucket
   *  reads `phaseSpendableTargetCount(currentPhaseId)` to decide whether to
   *  stay armable: tokens > 0 with no spendable target is a dead click. */
  registerSpendableCount: (id: string, count: number | null) => void;
  /** Sum of spendable-target counts across all hint-eligible widgets whose
   *  `phaseScope === phaseId`. `0` means "nothing to buy here right now". */
  phaseSpendableTargetCount: (phaseId: string) => number;
  /** True iff some widget has registered hint eligibility for the named
   *  phase. Drives ticker mount + bucket visibility. */
  phaseHasHintEligibleWidgets: (phaseId: string) => boolean;
  /** Widget ids registered as hint-eligible for the named phase. Exposed for
   *  framework consumers that need to scope a per-widget render decision to
   *  the active phase. */
  phaseHintEligibleWidgetIds: (phaseId: string) => string[];
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
  // Hint-eligibility registry — separate from value-bearing widget state
  // because it is structural (phase ownership) not value-bearing.
  const hintEligibilityRef = useRef<Record<string, HintEligibility>>({});
  // Live per-widget spendable-target count. Read alongside hintEligibilityRef
  // to scope counts to a phase. Absence means "nothing reported"; treated as 0.
  const spendableCountRef = useRef<Record<string, number>>({});
  // Seed from persisted state so sim-mirror consumers (sim-mode DataTable)
  // render the restored rows on the first paint, not after the sim's first
  // post-mount `onState` publish.
  const simulationStateRef = useRef<unknown>(state.simulationState);
  // Tick to force gate-evaluating subscribers to re-render after widget changes.
  const [tick, setTick] = useState(0);
  // Independent 1 Hz tick for the hint bucket countdown — kept separate so the
  // gate ctx (and every subscriber to it) doesn't re-evaluate every second.
  const [hintTick, setHintTick] = useState(0);
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

  // Phase-config lookup by id — used to resolve `hintPoolSize` /
  // `hintReplenishMinutes` overrides when dispatching hint actions.
  const phaseById = useMemo(() => {
    const map = new Map<string, Phase>();
    for (const p of phases) map.set(p.id, p);
    return map;
  }, [phases]);

  const poolCapFor = useCallback(
    (phaseId: string) => phaseById.get(phaseId)?.hintPoolSize ?? DEFAULT_HINT_POOL_SIZE,
    [phaseById],
  );
  const replenishMsFor = useCallback(
    (phaseId: string) => {
      const minutes =
        phaseById.get(phaseId)?.hintReplenishMinutes ?? DEFAULT_HINT_REPLENISH_MINUTES;
      return Math.max(0, minutes) * 60_000;
    },
    [phaseById],
  );

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

  const spendAndRevealRubricTier = useCallback(
    ({
      widgetId,
      criterionId,
      hintCap,
    }: {
      widgetId: string;
      criterionId: string;
      hintCap: number;
    }) => {
      const phaseId = stateRef.current.currentPhaseId;
      dispatch({
        type: 'SPEND_AND_REVEAL_RUBRIC_TIER',
        phaseId,
        widgetId,
        criterionId,
        hintCap,
        poolCap: poolCapFor(phaseId),
        now: Date.now(),
      });
    },
    [poolCapFor],
  );

  const revealRubricVerdicts = useCallback(
    ({ widgetId, rowIds }: { widgetId: string; rowIds: readonly string[] }) => {
      const phaseId = stateRef.current.currentPhaseId;
      dispatch({
        type: 'REVEAL_RUBRIC_VERDICTS',
        phaseId,
        widgetId,
        rowIds,
        poolCap: poolCapFor(phaseId),
        now: Date.now(),
      });
    },
    [poolCapFor],
  );

  const spendAndRevealVtTier = useCallback(
    ({
      widgetId,
      cellKey,
      revealedText,
      hintCap,
    }: {
      widgetId: string;
      cellKey: string;
      revealedText: string;
      hintCap: number;
    }) => {
      const phaseId = stateRef.current.currentPhaseId;
      dispatch({
        type: 'SPEND_AND_REVEAL_VT_TIER',
        phaseId,
        widgetId,
        cellKey,
        revealedText,
        hintCap,
        poolCap: poolCapFor(phaseId),
        now: Date.now(),
      });
    },
    [poolCapFor],
  );

  const setVariableTableLastChecked = useCallback(
    (widgetId: string, values: VariableTableValues) => {
      dispatch({ type: 'SET_VARIABLE_TABLE_LAST_CHECKED', widgetId, values });
    },
    [],
  );

  const lockVtCells = useCallback((widgetId: string, cellKeys: readonly string[]) => {
    if (cellKeys.length === 0) return;
    dispatch({ type: 'LOCK_VT_CELLS', widgetId, cellKeys });
  }, []);

  const unlockVtCell = useCallback((widgetId: string, cellKey: string) => {
    dispatch({ type: 'UNLOCK_VT_CELL', widgetId, cellKey });
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

  const registerHintEligibility = useCallback((id: string, eligibility: HintEligibility | null) => {
    if (eligibility === null) {
      delete hintEligibilityRef.current[id];
    } else {
      hintEligibilityRef.current[id] = eligibility;
    }
    // Force gateCtx subscribers to re-render so the footer bucket appears
    // when the first eligible widget mounts (and vice versa on unmount).
    setTick((t) => t + 1);
  }, []);

  const registerSpendableCount = useCallback((id: string, count: number | null) => {
    if (count === null) {
      delete spendableCountRef.current[id];
    } else {
      spendableCountRef.current[id] = Math.max(0, count);
    }
    // Force HintBucket consumers (subscribed via gateCtx tick) to re-evaluate
    // the armability of the bucket on the next paint.
    setTick((t) => t + 1);
  }, []);

  const phaseSpendableTargetCount = useCallback((phaseId: string) => {
    let total = 0;
    for (const [id, eligibility] of Object.entries(hintEligibilityRef.current)) {
      if (eligibility.phaseId !== phaseId) continue;
      total += spendableCountRef.current[id] ?? 0;
    }
    return total;
  }, []);

  const phaseHasHintEligibleWidgets = useCallback((phaseId: string) => {
    for (const eligibility of Object.values(hintEligibilityRef.current)) {
      if (eligibility.phaseId === phaseId) return true;
    }
    return false;
  }, []);

  const phaseHintEligibleWidgetIds = useCallback((phaseId: string) => {
    const out: string[] = [];
    for (const [id, eligibility] of Object.entries(hintEligibilityRef.current)) {
      if (eligibility.phaseId === phaseId) out.push(id);
    }
    return out;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: hintTick is an explicit 1 Hz refresh signal — without it the countdown text is stale between dispatch boundaries
  const bucketView = useCallback(
    (phaseId?: string): BucketView => {
      const pid = phaseId ?? state.currentPhaseId;
      const cap = poolCapFor(pid);
      const replenishMs = replenishMsFor(pid);
      if (cap === 0) {
        return { tokens: 0, cap: 0, msUntilNext: null, replenishMs: 0, disabled: true };
      }
      const rawTokens = state.hintTokens[pid];
      const tokens = rawTokens ?? cap;
      const lastAt = state.hintLastReplenishAt[pid] ?? null;
      let msUntilNext: number | null = null;
      if (tokens < cap && lastAt !== null && replenishMs > 0) {
        const elapsed = Date.now() - lastAt;
        const remainder = elapsed % replenishMs;
        msUntilNext = Math.max(0, replenishMs - remainder);
      }
      return { tokens, cap, msUntilNext, replenishMs, disabled: false };
    },
    [
      state.currentPhaseId,
      state.hintTokens,
      state.hintLastReplenishAt,
      poolCapFor,
      replenishMsFor,
      hintTick,
    ],
  );

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

  // === Hint-system effects ===
  //
  // Three effects, all gated on "current phase has hint-eligible widgets":
  //   1. 1 Hz hintTick — refreshes the bucket countdown text without mutating
  //      reducer state.
  //   2. ANCHOR_HINT_TIMER on phase change — discards off-phase wall-clock
  //      elapsed time so the student can't park elsewhere to grind tokens.
  //   3. Centralized LAZY_REPLENISH dispatcher — single owner per phase,
  //      idempotency-guarded in the reducer.
  //
  // The "has eligible widgets" predicate is read from the ref via `tick` so
  // registrations during mount immediately gate these effects.

  const currentPhaseId = state.currentPhaseId;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` carries registration changes so the predicate re-evaluates when an eligible widget mounts/unmounts
  const hasEligibleHere = useMemo(
    () => phaseHasHintEligibleWidgets(currentPhaseId),
    [currentPhaseId, tick, phaseHasHintEligibleWidgets],
  );

  // 1 Hz countdown tick.
  useEffect(() => {
    if (!hasEligibleHere) return;
    const handle = setInterval(() => setHintTick((t) => t + 1), 1000);
    return () => clearInterval(handle);
  }, [hasEligibleHere]);

  // Phase-entry anchor: discard off-phase wall-clock for partial buckets.
  useEffect(() => {
    if (!hasEligibleHere) return;
    dispatch({
      type: 'ANCHOR_HINT_TIMER',
      phaseId: currentPhaseId,
      now: Date.now(),
      poolCap: poolCapFor(currentPhaseId),
    });
  }, [hasEligibleHere, currentPhaseId, poolCapFor]);

  // Centralized LAZY_REPLENISH. Reads state via the ref to avoid stale-closure
  // grants, and uses `fromLastReplenishAt` as an idempotency guard in the
  // reducer. The dependency on hintTick is what makes this re-evaluate ~1/s;
  // the dependencies on state.hintTokens and state.hintLastReplenishAt make
  // it re-evaluate immediately after a spend (so the post-spend anchor isn't
  // ignored until the next 1 Hz tick).
  // biome-ignore lint/correctness/useExhaustiveDependencies: hintTick + state.hintTokens + state.hintLastReplenishAt are explicit refresh signals — without them the effect waits a full second after a spend or skips ticks
  useEffect(() => {
    if (!hasEligibleHere) return;
    const cap = poolCapFor(currentPhaseId);
    const replenishMs = replenishMsFor(currentPhaseId);
    if (cap === 0 || replenishMs <= 0) return;
    const current = stateRef.current;
    const tokens = current.hintTokens[currentPhaseId] ?? cap;
    if (tokens >= cap) return;
    const lastAt = current.hintLastReplenishAt[currentPhaseId] ?? null;
    if (lastAt === null) return;
    const { grants, newLastAt } = computeReplenishGrants(
      Date.now(),
      lastAt,
      replenishMs,
      tokens,
      cap,
    );
    if (grants <= 0) return;
    dispatch({
      type: 'LAZY_REPLENISH',
      phaseId: currentPhaseId,
      fromLastReplenishAt: lastAt,
      newLastReplenishAt: newLastAt,
      grants,
      poolCap: cap,
    });
  }, [
    hasEligibleHere,
    currentPhaseId,
    hintTick,
    poolCapFor,
    replenishMsFor,
    state.hintTokens,
    state.hintLastReplenishAt,
  ]);

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
    spendAndRevealRubricTier,
    revealRubricVerdicts,
    spendAndRevealVtTier,
    bucketView,
    setVariableTableLastChecked,
    lockVtCells,
    unlockVtCell,
    onSimulationProgress,
    setSimulationState,
    registerWidgetState,
    registerWidgetCheck,
    registerHintEligibility,
    registerSpendableCount,
    phaseSpendableTargetCount,
    phaseHasHintEligibleWidgets,
    phaseHintEligibleWidgetIds,
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
