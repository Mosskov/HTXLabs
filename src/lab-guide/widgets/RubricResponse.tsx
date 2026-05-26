// Student-facing rubric widget: textarea + persistent feedback panel beneath.
//
// Contract with the gate: this widget registers `{ kind: 'rubric', satisfied }`
// where `satisfied` is derived each render from
//   `!dirty && !embedderDown && requiredSatisfied`, sourced from the live
// `result` (just-evaluated) or the persisted pass record (cross-reload).
// Editing the text — or changing `dependsOn` — flips `dirty:true` → the gate
// re-closes without us touching the persisted record. Feedback to the student
// comes from a sticky panel below the textarea (Tips box with amber free
// misconceptions + slate paid tiers, plus a verdict-checklist section that
// unlocks once every failing criterion's hint ladder is fully spent) plus the
// Next-phase button enabling on pass; an sr-only `<output>` announces
// "Godkendt" once for AT users.
//
// Reload-safety: each completed evaluate writes a minimal pass record to
// `widgetValues[`${id}:result`]` containing
//   `{ lastCheckedText, lastCheckedDependsOn, requiredSatisfied, embedderDown }`.
// On reload, that record hydrates the gate so a prior pass survives without
// forcing a re-Tjek. The full `RubricResult` (criteria, hints, misconceptions)
// is component-state only, but the panel survives across remount via two
// compact `widgetValues` snapshots: `${id}:panelEntries` for the Tips
// bullets, and `${id}:verdictRows` for the "Hvad mangler" checklist. Both
// are written alongside the pass record at every evaluate; the verdict
// snapshot is also written at reveal-spend time, and the Tips snapshot
// is also written at every paid spend. Spent tier counters survive in
// `state.rubricHintTiers`. The verdict-revealed bit + frozen row-id list
// survive in `state.rubricVerdictsRevealed[id]` / `state.rubricVerdictRowIds[id]`.
// The sticky-panel one-way bit lives in `widgetValues[${id}:panelShown]`.
//
// Hint system: request-driven, per-phase token bucket. The textarea itself is
// the spend target — when the footer's HintBucket is armed, the textarea
// container shows an amber border + click/Enter spends 1 token to reveal the
// next paid tier in author-priority order across failing criteria. The
// 2-token verdict-reveal pill at the bottom of the panel unlocks the ✓/✗
// checklist once every failing criterion's ladder is at cap; it dispatches
// directly to the runner (not through spend mode), so the HintBucket's
// spendable-count never includes it. The widget registers itself as
// hint-eligible against the PhaseScopeContext.
import { DEV_EMBEDDER_URL, type Embedder, HttpEmbedder } from '@/lib/rubric/embedder';
import {
  CHECK_STATUSES,
  type RubricResult,
  VETO_STATUSES,
  evaluateRubric,
  parseRubric,
} from '@/lib/rubric/engine';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';
import { useHintSpend } from '../HintSpendContext';
import { useRunner } from '../RunnerContext';
import { Tooltip } from '../Tooltip';
import { format, strings } from '../strings.da';
import { useRegisteredHintEligibility } from '../useRegisteredHintEligibility';
import { useRegisteredWidgetCheck } from '../useRegisteredWidgetCheck';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import type { WidgetCheck } from '../widgetCheck';
import type { HintPopupEntry } from './HintPopup';
import { ProtectedTextarea } from './ProtectedInput';
import { TieredHintList } from './TieredHintList';

const defaultEmbedder: Embedder = new HttpEmbedder(DEV_EMBEDDER_URL);

const VERDICT_REVEAL_COST = 2;

// Persisted across reload via `widgetValues[${id}:result]`. Validated with
// Zod so a future shape change (or hand-edited localStorage) lands as a
// safe `null` rather than poisoning the gate with a half-typed object.
// `rubricId`/`rubricVersion` are checked at the use site (not the schema)
// against the currently parsed rubric — a mismatch makes the record ignored
// so an edited rubric can't keep the gate open under stale criteria.
const PersistedPassSchema = z
  .object({
    rubricId: z.string(),
    rubricVersion: z.number().int(),
    lastCheckedText: z.string(),
    lastCheckedDependsOn: z.string().nullable(),
    requiredSatisfied: z.boolean(),
    embedderDown: z.boolean(),
  })
  .strict();
type PersistedPass = z.infer<typeof PersistedPassSchema>;

function readPersisted(value: unknown): PersistedPass | null {
  const parsed = PersistedPassSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// Persisted-across-reload snapshot of the panel's bullets. Written at every
// evaluate + every paid spend; read on remount when `result` is null so the
// student sees the same Tips list they left. Zod-validated; a malformed
// payload (e.g. hand-edited localStorage) lands as `null` and the panel
// renders empty until the next Tjek. `group` is required in the snapshot
// (the writer always sets it to the parent criterion label) even though
// `HintPopupEntry.group` is `?`-optional on the consumer side.
const PanelEntrySchema = z
  .object({
    key: z.string(),
    text: z.string(),
    tone: z.enum(['misconception', 'hint']),
    group: z.string(),
  })
  .strict();
const PanelSnapshotSchema = z.object({ entries: z.array(PanelEntrySchema) }).strict();
type PanelSnapshot = z.infer<typeof PanelSnapshotSchema>;

function readPanelSnapshot(value: unknown): PanelSnapshot | null {
  const parsed = PanelSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// Persisted-across-reload snapshot of the verdict-checklist rows ("Hvad
// mangler" section). The row set is already frozen at reveal-spend time
// via `state.rubricVerdictRowIds[id]`; this snapshot adds the per-row
// label + live ✓/➔ satisfaction bit so the section keeps rendering after
// a remount drops the live `RubricResult`. Refreshed on every evaluate +
// at the initial verdict-reveal dispatch. Zod-validated; a malformed
// payload lands as `null` and the section renders empty until next Tjek.
const VerdictRowSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    satisfied: z.boolean(),
  })
  .strict();
const VerdictRowsSnapshotSchema = z.object({ rows: z.array(VerdictRowSchema) }).strict();
type VerdictRow = z.infer<typeof VerdictRowSchema>;
type VerdictRowsSnapshot = z.infer<typeof VerdictRowsSnapshotSchema>;

function readVerdictRowsSnapshot(value: unknown): VerdictRowsSnapshot | null {
  const parsed = VerdictRowsSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Resolve the frozen rowIds against a live result. Missing criteria (rubric
 *  edited mid-flight) are skipped defensively — same best-effort policy as
 *  the render-time row mapping. */
function computeVerdictRows(result: RubricResult, rowIds: ReadonlyArray<string>): VerdictRow[] {
  const rows: VerdictRow[] = [];
  for (const rid of rowIds) {
    const c = result.criteria.find((x) => x.id === rid);
    if (!c) continue;
    rows.push({ id: rid, label: c.label, satisfied: c.satisfied });
  }
  return rows;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Author-priority walk used by both the live panel and the snapshot writer.
 *  Iterates criteria once and, per criterion, emits its triggered
 *  misconceptions followed by its paid tiers — so TieredHintList groups each
 *  criterion's bullets as one contiguous block under its label header. */
function computePanelEntries(
  result: RubricResult,
  tiers: Record<string, number>,
): HintPopupEntry[] {
  const entries: HintPopupEntry[] = [];
  for (const c of result.criteria) {
    for (const m of c.misconceptions) {
      if (m.status !== VETO_STATUSES.TRIGGERED) continue;
      entries.push({
        key: `mis-${c.id}-${m.hint}`,
        text: m.hint,
        tone: 'misconception',
        group: c.label,
      });
    }
    const tier = tiers[c.id] ?? 0;
    if (tier <= 0) continue;
    const cap = c.hints.length;
    const ladderTier = Math.min(tier, cap);
    for (let i = 0; i < ladderTier; i++) {
      const text = c.hints[i];
      if (text === undefined) continue;
      entries.push({
        key: `tier-${c.id}-${i + 1}`,
        text,
        tone: 'hint',
        group: c.label,
      });
    }
  }
  return entries;
}

interface Props {
  id: string;
  prompt: string;
  rubric: unknown;
  minWords?: number;
  maxChars?: number;
  /** Soft upper bound on word count. Over the limit the check is blocked (the
   *  button is (aria-)disabled with a tooltip) and a `words / maxWords` counter
   *  shows. Unlike `maxChars` it is not hard-enforced — a textarea has no native
   *  word limit — so the student keeps their text and trims it down. */
  maxWords?: number;
  placeholder?: string;
  checkLabel?: string;
  /** Opt in to driving the check from the shared PhaseFooter button instead of
   *  the in-widget button. Ignored in open mode (the in-widget button stays so
   *  free-advance keeps self-check). Default `false`. */
  checkInFooter?: boolean;
  tooShortMessage?: string;
  tooLongMessage?: string;
  embedderDownMessage?: string;
  /** Section header above the verdict-checklist (once revealed). Default
   *  `strings.widgets.rubric.verdictsPanelHeader`. */
  verdictsPanelHeader?: string;
  /** Visible label on the verdict-reveal pill. Default
   *  `strings.widgets.rubric.verdictRevealPillLabel`. */
  verdictRevealPillLabel?: string;
  /** Opaque dependency string. When it changes after a check, `dirty` flips on
   *  (same as editing the text) and the gate re-closes. Use it to bind the
   *  pass to external context the prompt depends on — e.g. variable symbols
   *  the prompt interpolates. Caller stringifies; no deep equality. */
  dependsOn?: string;
  /** SEN accommodation — propagated to the textarea to bypass paste-block. */
  allowPaste?: boolean;
  /** Test-injection seam. Defaults to a module-level HttpEmbedder pointed at
   *  the local dev server (no embed server in production → embedder-down
   *  banner is the expected path; gate stays closed). */
  embedder?: Embedder;
}

export function RubricResponse({
  id,
  prompt,
  rubric,
  minWords,
  maxChars,
  maxWords,
  placeholder,
  checkLabel,
  checkInFooter = false,
  tooShortMessage,
  tooLongMessage,
  embedderDownMessage,
  verdictsPanelHeader,
  verdictRevealPillLabel,
  dependsOn,
  allowPaste,
  embedder = defaultEmbedder,
}: Props) {
  const {
    state,
    setWidgetValue,
    spendAndRevealRubricTier,
    revealRubricVerdicts,
    bucketView,
    registerSpendableCount,
  } = useRunner();
  const { spendMode, exitSpendMode } = useHintSpend();
  const text = (state.widgetValues[id] as string | undefined) ?? '';
  const tiers = state.rubricHintTiers[id] ?? {};
  const dependsOnNorm = dependsOn ?? null;

  const persistedKey = `${id}:result`;
  const panelShownKey = `${id}:panelShown`;
  const panelEntriesKey = `${id}:panelEntries`;
  const verdictRowsKey = `${id}:verdictRows`;
  const persistedRaw = readPersisted(state.widgetValues[persistedKey]);
  const panelSnapshot = readPanelSnapshot(state.widgetValues[panelEntriesKey]);
  const verdictRowsSnapshot = readVerdictRowsSnapshot(state.widgetValues[verdictRowsKey]);

  const parsed = useMemo(() => parseRubric(rubric), [rubric]);

  // Hint eligibility — registers against the surrounding PhaseScopeContext.
  // Only enabled when the rubric parsed (a bad rubric has no ladder, so no
  // hint surface either). The hook cleans up on unmount.
  useRegisteredHintEligibility(id, parsed.ok, 'rubric');

  // Ignore the persisted record if it was written against a different rubric
  // (different id) or an older version — stale criteria must not keep the
  // gate open after the author edits the rubric JSON.
  const persisted =
    persistedRaw &&
    parsed.ok &&
    persistedRaw.rubricId === parsed.rubric.id &&
    persistedRaw.rubricVersion === parsed.rubric.version
      ? persistedRaw
      : null;
  // Surface parse failures in the dev console — author sees them on page load.
  useEffect(() => {
    if (!parsed.ok) {
      console.error(`[RubricResponse:${id}] rubric failed validation`, parsed.errors);
    }
  }, [parsed, id]);

  const [result, setResult] = useState<RubricResult | null>(null);
  const [pending, setPending] = useState(false);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  // Synchronous re-entry guard for `evaluate`. The closed-over `pending` state
  // is not synchronous enough to block a same-render double-click, and the
  // footer's `disabled` only reaches the button after the `revision` tick —
  // so this ref is the one thing that reliably stops a second `evaluateRubric`.
  const pendingRef = useRef(false);

  // Tjek-flash state — emerald-only, mirrors VT cell pass-flash. Paints
  // bg-emerald-100 on a passing Tjek (`requiredSatisfied` is the same bit
  // that drives the gate). Cleared after 1500ms. The `nonce` key on the
  // background wrapper restarts the CSS keyframe even when two consecutive
  // passing Tjeks happen back-to-back. No rose-on-fail variant: panel
  // bullets carry the failure feedback; rose would compete with them.
  const [flash, setFlash] = useState<{ nonce: number; withTransition: boolean } | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashNonceRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Clear any pending flash timer on unmount so a late tick can't setState on
  // an unmounted widget (matches VT's pattern).
  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  // Derive the "what was checked last" pair from the persisted record so a
  // reload (no live `result`) still produces the right dirty/satisfied bits.
  // Live evaluates write the record synchronously alongside `setResult`, so
  // the two sources never disagree at render time.
  const lastCheckedText = persisted?.lastCheckedText ?? null;
  const lastCheckedDependsOn = persisted?.lastCheckedDependsOn ?? null;

  // embedderDown: live result wins; otherwise the persisted bit (so a prior
  // outage doesn't silently re-open after reload).
  const liveEmbedderDown =
    !!result &&
    result.criteria.some((c) =>
      c.checks.some((ch) => ch.status === CHECK_STATUSES.SKIPPED_EMBEDDER),
    );
  const embedderDown = result ? liveEmbedderDown : (persisted?.embedderDown ?? false);

  const dirty =
    lastCheckedText !== null &&
    (text !== lastCheckedText || dependsOnNorm !== lastCheckedDependsOn);

  const requiredSatisfied = result
    ? result.requiredSatisfied
    : (persisted?.requiredSatisfied ?? false);

  // `lastCheckedText !== null` gates satisfaction on "an evaluate has actually
  // happened" — protects against a live `result` outliving a wiped persisted
  // record (e.g. after `resetLab`, which clears widgetValues but not component
  // state).
  const satisfied =
    parsed.ok && lastCheckedText !== null && !dirty && !embedderDown && requiredSatisfied;

  // Always-register pattern — even with a bad rubric, we publish satisfied:false
  // from mount so hooks order is stable across the render-branch below.
  useRegisteredWidgetState(id, { kind: 'rubric', satisfied }, [satisfied]);

  // Live spendable-target count: sum of unrevealed paid tiers across failing
  // criteria. Only spend-mode targets are counted — the verdict-reveal pill is
  // a direct-dispatch button (panel-resident, never armed), so it's excluded.
  // Eligibility mirrors `failingCriteria` below.
  const rubricSpendableCount = (() => {
    if (!parsed.ok || !result) return 0;
    let count = 0;
    for (const c of result.criteria) {
      if (c.satisfied || c.hints.length === 0) continue;
      const eligible = c.required || (result.requiredSatisfied && c.evaluable);
      if (!eligible) continue;
      const tier = tiers[c.id] ?? 0;
      const remaining = c.hints.length - tier;
      if (remaining > 0) count += remaining;
    }
    return count;
  })();
  useEffect(() => {
    if (!parsed.ok) return;
    registerSpendableCount(id, rubricSpendableCount);
    return () => registerSpendableCount(id, null);
  }, [id, parsed.ok, rubricSpendableCount, registerSpendableCount]);

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const meetsMinWords = typeof minWords !== 'number' || words >= minWords;
  const overMaxWords = typeof maxWords === 'number' && words > maxWords;
  const nonEmpty = text.trim().length > 0;
  // `tooShort` (typed something but below the minimum) drives aria-invalid — an
  // empty field is not "invalid". `wordCountHint` is the broader tooltip text:
  // it also covers a fresh empty field (so a student jumping straight to Tjek
  // sees why) and the above-maximum case. The message surfaces as a hover
  // tooltip on the check button, never as an inline paragraph; `!pending`
  // suppresses it mid-check, when the button reads "Tjekker…". Below-minimum
  // wins over above-maximum if an author misconfigures minWords > maxWords.
  const tooShort = nonEmpty && !meetsMinWords;
  const tooShortText =
    tooShortMessage ?? format(strings.widgets.rubric.tooShort, { n: minWords ?? 0 });
  const tooLongText =
    tooLongMessage ?? format(strings.widgets.rubric.tooLong, { n: maxWords ?? 0 });
  const wordCountHint = pending
    ? undefined
    : !meetsMinWords
      ? tooShortText
      : overMaxWords
        ? tooLongText
        : undefined;

  const onTextChange = (next: string) => {
    // Invalidate any in-flight evaluation: when it resolves, its requestId
    // won't match anymore and the resolution gets dropped (pending still
    // clears so the button re-enables). We deliberately do NOT clear the
    // persisted record here — that's what lets the panel stay sticky after
    // an edit (per the F9 fix; panel bullets read from the latest result
    // regardless of dirty state).
    requestIdRef.current += 1;
    setWidgetValue(id, next);
  };

  const evaluate = async () => {
    if (!parsed.ok) return;
    // Re-entry guard: drop a second call while one is already in flight.
    if (pendingRef.current) return;
    pendingRef.current = true;
    const reqId = ++requestIdRef.current;
    const snapshotText = text;
    const snapshotDependsOn = dependsOnNorm;
    setPending(true);
    try {
      const r = await evaluateRubric(snapshotText, parsed.rubric, embedder);
      if (!mountedRef.current) return;
      if (reqId === requestIdRef.current) {
        const skipped = r.criteria.some((c) =>
          c.checks.some((ch) => ch.status === CHECK_STATUSES.SKIPPED_EMBEDDER),
        );
        setResult(r);
        // Persist the minimal pass record alongside the live result. React
        // batches the dispatch + setResult so the next render sees both.
        const record: PersistedPass = {
          rubricId: parsed.rubric.id,
          rubricVersion: parsed.rubric.version,
          lastCheckedText: snapshotText,
          lastCheckedDependsOn: snapshotDependsOn,
          requiredSatisfied: r.requiredSatisfied,
          embedderDown: skipped,
        };
        setWidgetValue(persistedKey, record);
        // Snapshot the Tips list for cross-remount survival. `tiers` is the
        // closed-over render-time value — Tjek itself never bumps tiers, so
        // the snapshot reflects the just-evaluated `r` paired with the live
        // tier state.
        setWidgetValue(panelEntriesKey, { entries: computePanelEntries(r, tiers) });
        // Verdict-rows snapshot refresh — only meaningful once the student
        // has paid the verdict reveal (otherwise the section doesn't render
        // at all). Closed-over `state.rubricVerdictRowIds[id]` is the
        // frozen row set from reveal time; we recompute live ✓/➔ against
        // the just-evaluated `r`.
        const liveVerdictRowIds = state.rubricVerdictRowIds?.[id];
        if (verdictsRevealed && liveVerdictRowIds) {
          setWidgetValue(verdictRowsKey, {
            rows: computeVerdictRows(r, liveVerdictRowIds),
          });
        }
        // Tjek flash — emerald-only, on pass. A failing Tjek deliberately
        // does NOT paint a rose flash on the textarea: the panel bullets
        // (misconceptions + revealable hint ladders) are the failure
        // feedback, and rose would compete with them. Embedder-down also
        // skips (the amber banner is the feedback). Nonce bumps on every
        // pass so a repeat passing-Tjek still restarts the keyframe.
        if (!skipped && r.requiredSatisfied) {
          const nonce = flashNonceRef.current + 1;
          flashNonceRef.current = nonce;
          setFlash({
            nonce,
            withTransition: !prefersReducedMotion(),
          });
          if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
          flashTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setFlash(null);
            flashTimerRef.current = null;
          }, 1500);
        }
      }
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  };

  // Footer-check opt-in: when `checkInFooter` is set (and the rubric parsed,
  // and we're not in open mode), the in-widget Tjek button is suppressed and
  // the PhaseFooter drives `evaluate` instead. The check object is stable; we
  // mutate it in place each render so the footer reads the latest closure +
  // live `disabled`/`pending`. A `pending`-derived `revision` re-fires the
  // registration on each async-check edge so the footer re-renders.
  // `disabled` mirrors the in-widget `checkDisabled` (computed after the
  // `parsed.ok` early return below); recomputed here because this hook must
  // run before that return to keep hook order stable on a bad rubric.
  const footerActive = checkInFooter && parsed.ok && state.mode !== 'open';
  const checkRef = useRef<WidgetCheck>({
    label: '',
    run: () => {},
    disabled: false,
    pending: false,
  });
  checkRef.current.label = pending
    ? strings.widgets.rubric.evaluating
    : (checkLabel ?? strings.widgets.rubric.checkLabel);
  checkRef.current.run = evaluate;
  checkRef.current.disabled = pending || !nonEmpty || !meetsMinWords || overMaxWords;
  checkRef.current.disabledReason = wordCountHint;
  checkRef.current.pending = pending;
  useRegisteredWidgetCheck(id, footerActive, checkRef, pending ? 1 : 0);

  // Sticky-panel one-way bit. Reads from widgetValues so it survives reload
  // (the bit is persisted automatically via SET_WIDGET_VALUE). The first-show
  // write happens in a useEffect (below) to avoid render-time dispatches.
  const panelShown = state.widgetValues[panelShownKey] === true;

  // Verdict-reveal state. Both slices fall back to {} on hydration, so direct
  // index access is safe.
  const verdictsRevealed = state.rubricVerdictsRevealed?.[id] === true;
  const persistedVerdictRowIds = state.rubricVerdictRowIds?.[id] ?? null;

  // Resolved verdict-checklist rows for render. Live `result` wins so the
  // ✓/➔ ticks update immediately on every Tjek; on a fresh remount (no
  // result yet) the snapshot keeps the section visible until the next Tjek.
  // `null` means the section should not render at all.
  const verdictRows: VerdictRow[] | null =
    verdictsRevealed && persistedVerdictRowIds
      ? result
        ? computeVerdictRows(result, persistedVerdictRowIds)
        : (verdictRowsSnapshot?.rows ?? null)
      : null;

  // Bad rubric: render disabled chrome so the page doesn't break.
  if (!parsed.ok) {
    const isDev = import.meta.env.DEV;
    return (
      <div className="my-4">
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {isDev ? (
            <>
              <div className="font-semibold">Rubric-validering fejlede ({id})</div>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs">
                {JSON.stringify(parsed.errors, null, 2)}
              </pre>
            </>
          ) : (
            <div>{strings.widgets.rubric.rubricError}</div>
          )}
        </div>
      </div>
    );
  }

  const checkDisabled = pending || !nonEmpty || !meetsMinWords || overMaxWords;

  // Failing criteria — the spend-mode targets. Eligibility mirrors the old
  // auto-bump rule: required criteria always count; optional ones only once
  // `requiredSatisfied` AND `evaluable` so an embedder outage on a
  // semantic-only bonus doesn't surface unreachable hints.
  const failingCriteria = (() => {
    if (!result) return [] as { id: string; label: string; cap: number; tier: number }[];
    return result.criteria
      .filter((c) => {
        if (c.satisfied || c.hints.length === 0) return false;
        if (c.required) return true;
        return result.requiredSatisfied && c.evaluable;
      })
      .map((c) => ({
        id: c.id,
        label: c.label,
        cap: c.hints.length,
        tier: tiers[c.id] ?? 0,
      }));
  })();

  // Panel entries: amber misconceptions from the latest `result` first, then
  // paid tier reveals walked in author order. Critically, this is independent
  // of `dirty`/`pending` — the F9 fix is that paid bullets must NOT vanish
  // mid-edit. Live `result` wins; on a fresh remount (no `result` yet) we
  // hydrate from the persisted snapshot so bullets survive cross-phase nav
  // and reload. Snapshot writes happen at evaluate + spend; see below.
  const panelEntries: HintPopupEntry[] = result
    ? computePanelEntries(result, tiers)
    : (panelSnapshot?.entries ?? []);

  // First-show write of the sticky `panelShown` bit. The guard makes this
  // one-shot — once the bit lands in widgetValues, the effect's `panelShown`
  // dep is `true` and the body short-circuits. Lives in a useEffect (not the
  // render body) so we never dispatch during render — that would warn under
  // strict mode and risk an update loop.
  useEffect(() => {
    if (!panelShown && panelEntries.length > 0) {
      setWidgetValue(panelShownKey, true);
    }
  }, [panelShown, panelEntries.length, panelShownKey, setWidgetValue]);

  const showEmbedderBanner = embedderDown && !dirty;

  const helpId = `rr-${id}-help`;

  // Visible status pill removed — feedback comes from the panel and the
  // Next-phase button enabling on pass. The sr-only live region preserves
  // the AT-side "Godkendt" announcement.
  const showAriaStatus = !pending && !dirty && satisfied;

  // Spend mode: only the active phase's widget acts on it (PhaseScopeContext
  // ensures only the active body is visible, but the conjunction makes the
  // armed-cursor scoping explicit).
  const armed = spendMode.kind === 'active' && spendMode.phaseId === state.currentPhaseId;
  const armedSpendable = armed && failingCriteria.length > 0;

  const currentPhase = state.currentPhaseId;
  const bucket = bucketView(currentPhase);

  // Verdict-reveal unlock predicate. The `.length > 0` guard avoids the
  // vacuous-true case on a fully passing rubric (every() over an empty array
  // returns true) — otherwise the pill would render with no checklist content
  // behind it and a click would burn 2 tokens for nothing.
  const verdictUnlocked =
    failingCriteria.length > 0 && failingCriteria.every((c) => c.tier >= c.cap);

  // Frozen verdict-row computation. Called only at the moment of the
  // reveal-spend dispatch — the snapshot is then persisted in
  // `rubricVerdictRowIds[id]` and never recomputed for that widget. Required
  // criteria are always in the snapshot (their ladder is always accessible);
  // optionals are included iff they are currently failing + eligible (which,
  // by `verdictUnlocked`, means they are in `failingCriteria` and at cap).
  const computeVerdictRowIdsSnapshot = (): string[] => {
    if (!result) return [];
    const failingIds = new Set(failingCriteria.map((c) => c.id));
    const ids: string[] = [];
    for (const c of result.criteria) {
      if (c.required || failingIds.has(c.id)) ids.push(c.id);
    }
    return ids;
  };

  const handleVerdictReveal = () => {
    if (!verdictUnlocked || verdictsRevealed) return;
    if (bucket.tokens < VERDICT_REVEAL_COST) return;
    const rowIds = computeVerdictRowIdsSnapshot();
    revealRubricVerdicts({ widgetId: id, rowIds });
    // Write the initial verdict-rows snapshot synchronously alongside the
    // reveal dispatch so the section keeps rendering across a remount even
    // before the student re-Tjeks. `result` is guaranteed non-null here:
    // `verdictUnlocked` is derived from `failingCriteria` which derives
    // from `result`.
    if (result) {
      setWidgetValue(verdictRowsKey, { rows: computeVerdictRows(result, rowIds) });
    }
  };

  const spendNextAvailableTier = () => {
    const target = failingCriteria.find((c) => c.tier < c.cap);
    if (!target) return;
    spendAndRevealRubricTier({ widgetId: id, criterionId: target.id, hintCap: target.cap });
    exitSpendMode();
    // Re-snapshot the Tips list against the projected next-tier value so the
    // freshly-revealed bullet survives a remount. Spends only happen while
    // `result` is non-null (failingCriteria reads from it), so the guard
    // here is defensive.
    if (result) {
      const nextTiers = { ...tiers, [target.id]: target.tier + 1 };
      setWidgetValue(panelEntriesKey, { entries: computePanelEntries(result, nextTiers) });
    }
  };

  // Armed-textarea click: dispatch the next tier. We do NOT preventDefault on
  // the click — letting the natural focus happen means a keyboard student who
  // arms + tabs to the textarea can keep editing seamlessly after the spend.
  const onTextareaClick = (_e: ReactMouseEvent<HTMLTextAreaElement>) => {
    if (!armedSpendable) return;
    spendNextAvailableTier();
  };

  // Armed-textarea Enter: preventDefault BEFORE dispatch is non-negotiable —
  // a <textarea>'s default Enter behavior is to insert a newline, which would
  // dirty the just-checked text and the freshly-spent tier would vanish on the
  // next render (charge-without-reveal bug). The guard runs only while armed,
  // so off-arm Enter still produces newlines as expected.
  const onTextareaKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!armedSpendable) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      spendNextAvailableTier();
    }
  };

  // In-widget check button (shown when the footer isn't driving the check —
  // open mode, or `checkInFooter` not set). Wrapped in a Tooltip when the word
  // count blocks the check, so the reason surfaces on hover.
  const checkButton = (
    <button
      type="button"
      onClick={() => {
        if (!checkDisabled) void evaluate();
      }}
      // While the check is blocked on word count (empty, too-short, too-long)
      // the button renders `aria-disabled` — not `disabled` — so the Tooltip
      // can still open on hover (a truly disabled <button> fires no pointer
      // events). `pending` keeps the real attribute.
      disabled={checkDisabled && wordCountHint == null}
      aria-disabled={wordCountHint != null || undefined}
      className="rounded bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      {pending
        ? strings.widgets.rubric.evaluating
        : (checkLabel ?? strings.widgets.rubric.checkLabel)}
    </button>
  );

  // Panel renders once it has been shown at least once. `panelShown` is the
  // single source of truth — the bit is set on the first observed non-empty
  // `panelEntries`, and never cleared (so editing away a misconception or
  // satisfying a criterion does NOT collapse the panel mid-edit, which was
  // the F9 failure mode).
  const panelVisible = panelShown;
  const pipCount = panelEntries.length;

  const verdictsHeader = verdictsPanelHeader ?? strings.widgets.rubric.verdictsPanelHeader;
  const verdictRevealLabel =
    verdictRevealPillLabel ?? strings.widgets.rubric.verdictRevealPillLabel;
  const verdictRevealDisabled = bucket.tokens < VERDICT_REVEAL_COST;

  // Default chrome mirrors VT's cell input class (`hover:bg-accent-50` +
  // accent focus border, no ring). During the flash window the textarea is
  // forced `!bg-transparent` so the wrapper's animated background bleeds
  // through and fades alongside the keyframe (a static `!bg-emerald-100` /
  // `!bg-rose-100` on the textarea would beat the keyframe's intermediate
  // values and snap on/off instead of fading) — same trick VT uses.
  const flashOverride = flash !== null ? ' !bg-transparent' : '';
  const textareaClass = armedSpendable
    ? `border-amber-400 ring-1 ring-amber-300 cursor-pointer${flashOverride}`
    : `hover:bg-accent-50 focus:border-accent-400 focus:!ring-0${flashOverride}`;

  // Flash wrapper class — emerald-only, mirrors VT's pass-flash keyframe.
  // The `key={flashKey}` remount restarts the animation on repeat passing
  // Tjeks. `rounded-md` matches the textarea's corners exactly so the
  // bleed-through doesn't show beyond the input's edge.
  const flashBg = flash !== null ? 'bg-emerald-100' : 'bg-transparent';
  const flashAnim = flash?.withTransition ? ' animate-vt-flash-fade' : '';
  const flashClass = `rounded-md ${flashBg}${flashAnim}`;
  const flashKey = flash?.nonce ?? 0;

  return (
    <div className="my-4">
      <label htmlFor={`rr-${id}`} className="block text-sm font-medium text-slate-800 mb-1">
        {prompt}
      </label>
      {/* Wrapper hosts the textarea + the left-edge pip cluster. `relative`
          for the pip-cluster's absolute positioning; `group` so the pips can
          react to focus-within. */}
      <span className="group/rr relative block w-full">
        {/* Flash background — sits behind the textarea as an absolutely
            positioned sibling so the `key={flashKey}` remount restarts the
            keyframe WITHOUT remounting the textarea (which would drop the
            student's focus / selection / IME composition mid-typing). The
            textarea is forced `!bg-transparent` during the flash window so
            the emerald/rose bleeds through and fades alongside the keyframe.
            `pointer-events-none` keeps clicks/focus reaching the textarea. */}
        <span
          aria-hidden="true"
          key={flashKey}
          className={`pointer-events-none absolute inset-0 ${flashClass}`}
        />
        <ProtectedTextarea
          id={`rr-${id}`}
          value={text}
          maxLength={maxChars}
          placeholder={placeholder ?? strings.widgets.rubric.placeholder}
          aria-describedby={helpId}
          aria-invalid={tooShort || overMaxWords || undefined}
          allowPaste={allowPaste}
          onChange={(e) => onTextChange(e.target.value)}
          onClick={onTextareaClick}
          onKeyDown={onTextareaKeyDown}
          className={textareaClass}
        />
        {pipCount > 0 && (
          // Pip cluster: mirror of the VariableTable cell pip block, flipped
          // to the textarea's left edge. Count = panelEntries.length — one
          // pip per visible bullet in the panel. On focus-within the cluster
          // slides down + the pips grow to bridge visually toward the panel
          // (which is the persistent surface below the textarea — the
          // bridge metaphor mirrors VT's pip→popup behaviour). VT's pip code
          // is intentionally not extracted; this is a local copy reusing the
          // same Tailwind utilities (PL4).
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2 bottom-0.5 flex gap-0.5 transition-all duration-150 group-focus-within/rr:-bottom-1.5"
          >
            {panelEntries.map((entry) => (
              <span
                key={`rr-${id}-pip-${entry.key}`}
                className="block h-1.5 w-0.5 rounded-sm bg-amber-400 transition-all duration-150 group-focus-within/rr:h-3.5"
              />
            ))}
          </span>
        )}
      </span>
      {/* Word counter sits directly below the textarea, right-aligned (C1).
          Frees the panel below to use a content-driven width (C2) instead
          of sharing a flex row with the counter. */}
      <div id={helpId} aria-live="polite" className="mt-1 text-right text-xs">
        {typeof maxChars === 'number' && (
          <div className="text-slate-500">
            {text.length} / {maxChars}
          </div>
        )}
        {typeof maxWords === 'number' && (
          <div className={overMaxWords ? 'text-amber-700' : 'text-slate-500'}>
            {format(strings.widgets.rubric.wordCount, { n: words, max: maxWords })}
          </div>
        )}
      </div>

      {/* Panel — own block below the counter. `max-w-[50ch]` (C2) caps the
          reading line at ~optimal Danish width without sharing the row.
          Collapse/pin visuals are intentionally deferred — they'll be
          iterated alongside the per-criterion verdict redesign in the
          D3 testlab pass. */}
      {panelVisible && (
        <section
          aria-label={strings.widgets.rubric.hintsLabel}
          // `hint-popup` class is the same hook globals.css uses to
          // suppress the project-wide `.prose ul > li::before` blue dot
          // — see TieredHintList for the popup-side use.
          className="hint-popup mt-2 max-w-[50ch] rounded-md border border-amber-300 bg-slate-50 p-3 text-sm"
        >
          {verdictRows && verdictRows.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {verdictsHeader}
              </div>
              <ul className="space-y-1">
                {verdictRows.map((row) => {
                  // Live ✓/➔ via `result.criteria` when present; snapshot
                  // fallback after remount before the next Tjek. `➔` is
                  // InstructionBox's active-step glyph ("do this next"),
                  // not `✗` ("you got this wrong") — tone stays slate.
                  const template = row.satisfied
                    ? strings.widgets.rubric.verdictPass
                    : strings.widgets.rubric.verdictFail;
                  return (
                    <li
                      key={`verdict-${row.id}`}
                      className={`flex items-start gap-2 ${row.satisfied ? 'text-emerald-800' : 'text-slate-700'}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`select-none leading-snug ${row.satisfied ? 'text-base' : 'text-sm'}`}
                      >
                        {row.satisfied ? '✓' : '➔'}
                      </span>
                      <span>{format(template, { label: row.label })}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Bullets grouped per criterion (label as header). Shared
                renderer with VT's HintPopup so the two surfaces stay visually
                consistent — misconceptions in orange, paid tiers in slate,
                dash glyph. Returns null when empty, so a hint-empty panel
                that only carries the verdict-reveal pill renders cleanly. */}
          <TieredHintList entries={panelEntries} />

          {verdictUnlocked && !verdictsRevealed && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleVerdictReveal}
                disabled={verdictRevealDisabled}
                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verdictRevealLabel}
              </button>
            </div>
          )}
        </section>
      )}

      {(showAriaStatus || !footerActive) && (
        <div className="mt-2 flex items-center justify-end gap-3">
          {showAriaStatus && (
            <output className="sr-only" aria-live="polite">
              {strings.widgets.rubric.statusPassed}
            </output>
          )}
          {!footerActive &&
            (wordCountHint != null ? (
              <Tooltip content={wordCountHint} align="right" openDelayMs={500}>
                {checkButton}
              </Tooltip>
            ) : (
              checkButton
            ))}
        </div>
      )}

      {showEmbedderBanner && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {embedderDownMessage ?? strings.widgets.rubric.embedderDown}
        </div>
      )}
    </div>
  );
}
