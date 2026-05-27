// Student-facing rubric widget: textarea + persistent feedback panel beneath.
//
// Contract with the gate: this widget registers `{ kind: 'rubric', satisfied }`
// where `satisfied` is derived each render from
//   `!dirty && !embedderDown && requiredSatisfied`, sourced from the live
// `result` (just-evaluated) or the persisted pass record (cross-reload).
// Editing the text — or changing `dependsOn` — flips `dirty:true` → the gate
// re-closes without us touching the persisted record. Feedback to the student
// comes from a flat panel below the textarea: all matched misconceptions
// (orange flat-dash bullets) pin to the top regardless of which criterion
// they target, then the active group's spent-hint stack renders below them
// newest-on-top. The active group is the first failing criterion in author
// order; satisfied criteria drop out of the panel entirely. When that group's
// ladder is capped, the deepest hint carries the `➔` marker (text-accent,
// text-sm) — the InstructionBox active-step glyph signalling "do this to
// advance". The Next-phase button enables on pass; an sr-only `<output>`
// announces "Godkendt" once for AT users.
//
// Reload-safety: each completed evaluate writes a minimal pass record to
// `widgetValues[`${id}:result`]` containing
//   `{ lastCheckedText, lastCheckedDependsOn, requiredSatisfied, embedderDown }`.
// On reload, that record hydrates the gate so a prior pass survives without
// forcing a re-Tjek. The full `RubricResult` (criteria, hints, misconceptions)
// is component-state only, but the panel survives across remount via a single
// already-filtered render-view snapshot under `widgetValues[${id}:panelEntries]`
// (written at every evaluate + every paid spend) plus the matching
// `activeCriterionId` envelope field. Spent tier counters survive in
// `state.rubricHintTiers`. The sticky-panel one-way bit lives in
// `widgetValues[${id}:panelShown]`; the manual collapse bit lives in
// `widgetValues[${id}:panelCollapsed]`.
//
// Hint system: request-driven, per-phase token bucket. The textarea itself is
// the spend target — when the footer's HintBucket is armed, the textarea
// container shows an amber border + click/Enter spends 1 token on the FIRST
// failing criterion in author order (strict per-group gating). If that
// criterion's ladder is capped and it remains failing, the spend is a no-op
// until the student satisfies it. The bottom-left pip cluster doubles as the
// panel toggle: clicking it collapses or reopens the panel; any spend forces
// the panel back open. The widget registers itself as hint-eligible against
// the PhaseScopeContext.
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
import { ProtectedTextarea } from './ProtectedInput';

const defaultEmbedder: Embedder = new HttpEmbedder(DEV_EMBEDDER_URL);

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

// Persisted-across-reload snapshot of the panel's bullets. The writer stores
// the already-filtered render view (pinned misconceptions + the active
// group's spent-hint stack) plus an `activeCriterionId` envelope field
// naming the active group at write-time. The render layer trusts this
// verbatim until the next Tjek produces a fresh `result`. `group` and
// `criterionId` are both optional — old snapshots written under the prior
// schema parse cleanly; their misconception entries render in the
// common-errors block; their paid-tier entries are ignored until the next
// Tjek (no key-derived fallback so stale later-group hints can't leak in).
const PanelEntrySchema = z
  .object({
    key: z.string(),
    text: z.string(),
    tone: z.enum(['misconception', 'hint']),
    group: z.string().optional(),
    criterionId: z.string().optional(),
    /** When true, render the `➔` active-step marker instead of `–`. Set on
     *  the deepest hint of a capped failing criterion. */
    isActiveDirective: z.boolean().optional(),
  })
  .strict();
const PanelSnapshotSchema = z
  .object({
    entries: z.array(PanelEntrySchema),
    activeCriterionId: z.string().nullable().optional(),
  })
  .strict();
type PanelEntry = z.infer<typeof PanelEntrySchema>;
type PanelSnapshot = z.infer<typeof PanelSnapshotSchema>;

function readPanelSnapshot(value: unknown): PanelSnapshot | null {
  const parsed = PanelSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface FailingCriterion {
  id: string;
  label: string;
  cap: number;
  tier: number;
}

/** Build the already-filtered render view from a live `result`. Returns the
 *  pinned-misconception bullets (flat list, all criteria) followed by the
 *  active group's spent hints rendered newest-on-top, with `isActiveDirective`
 *  set on the deepest hint when the active group's ladder is capped. */
function computePanelView(
  result: RubricResult,
  tiers: Record<string, number>,
  activeCriterion: FailingCriterion | null,
): { entries: PanelEntry[]; activeCriterionId: string | null } {
  const entries: PanelEntry[] = [];
  // Common errors at top: all triggered misconceptions across all criteria,
  // regardless of which criterion they target.
  for (const c of result.criteria) {
    for (const m of c.misconceptions) {
      if (m.status !== VETO_STATUSES.TRIGGERED) continue;
      entries.push({
        key: `mis-${c.id}-${m.hint}`,
        text: m.hint,
        tone: 'misconception',
        criterionId: c.id,
        group: c.label,
      });
    }
  }
  // Active group's spent-hint stack, newest-on-top. Only the active group's
  // bullets appear; earlier (now-satisfied) criteria leave no trail.
  if (activeCriterion) {
    const criterion = result.criteria.find((c) => c.id === activeCriterion.id);
    const tier = tiers[activeCriterion.id] ?? 0;
    if (criterion && tier > 0) {
      const cap = criterion.hints.length;
      const ladderTier = Math.min(tier, cap);
      const capped = ladderTier >= cap;
      const deepestIndex = ladderTier - 1;
      for (let i = ladderTier - 1; i >= 0; i--) {
        const text = criterion.hints[i];
        if (text === undefined) continue;
        entries.push({
          key: `tier-${criterion.id}-${i + 1}`,
          text,
          tone: 'hint',
          criterionId: criterion.id,
          group: criterion.label,
          isActiveDirective: capped && i === deepestIndex,
        });
      }
    }
  }
  return { entries, activeCriterionId: activeCriterion?.id ?? null };
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
  /** Aria-label override for the pip-toggle button when the panel is
   *  collapsed. Vars: {n} = pip count. */
  pipToggleShowLabel?: string;
  /** Aria-label override for the pip-toggle button when the panel is open. */
  pipToggleHideLabel?: string;
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
  pipToggleShowLabel,
  pipToggleHideLabel,
  dependsOn,
  allowPaste,
  embedder = defaultEmbedder,
}: Props) {
  const { state, setWidgetValue, spendAndRevealRubricTier, registerSpendableCount } = useRunner();
  const { spendMode, exitSpendMode } = useHintSpend();
  const text = (state.widgetValues[id] as string | undefined) ?? '';
  const tiers = state.rubricHintTiers[id] ?? {};
  const dependsOnNorm = dependsOn ?? null;

  const persistedKey = `${id}:result`;
  const panelShownKey = `${id}:panelShown`;
  const panelEntriesKey = `${id}:panelEntries`;
  const panelCollapsedKey = `${id}:panelCollapsed`;
  const persistedRaw = readPersisted(state.widgetValues[persistedKey]);
  const panelSnapshot = readPanelSnapshot(state.widgetValues[panelEntriesKey]);

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

  // Failing criteria — eligibility mirrors the old auto-bump rule: required
  // criteria always count; optional ones only once `requiredSatisfied` AND
  // `evaluable` so an embedder outage on a semantic-only bonus doesn't
  // surface unreachable hints. Computed once and shared across the strict-
  // gating helpers below.
  const failingCriteria: FailingCriterion[] = (() => {
    if (!result) return [];
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

  // Strict per-group gating: the first failing criterion in author order is
  // the only reachable spend target. If its ladder is capped, the
  // HintBucket's spendable count goes to 0 — later criteria contribute 0
  // because they're unreachable until the active group is satisfied.
  const firstFailingCriterion: FailingCriterion | null = failingCriteria[0] ?? null;
  const rubricSpendableCount = (() => {
    if (!parsed.ok || !result || !firstFailingCriterion) return 0;
    const remaining = firstFailingCriterion.cap - firstFailingCriterion.tier;
    return Math.max(0, remaining);
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
        // Snapshot the already-filtered panel view for cross-remount survival.
        // The active group is derived fresh from the just-evaluated result —
        // closed-over `failingCriteria` was computed against the previous
        // render's `result`, so we recompute here against `r`.
        const liveFailing: FailingCriterion[] = r.criteria
          .filter((c) => {
            if (c.satisfied || c.hints.length === 0) return false;
            if (c.required) return true;
            return r.requiredSatisfied && c.evaluable;
          })
          .map((c) => ({
            id: c.id,
            label: c.label,
            cap: c.hints.length,
            tier: tiers[c.id] ?? 0,
          }));
        const liveActive = liveFailing[0] ?? null;
        const view = computePanelView(r, tiers, liveActive);
        setWidgetValue(panelEntriesKey, view);
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
  // Manual collapse bit — persisted per-widget so a student's collapse choice
  // survives phase nav + reload.
  const panelCollapsed = state.widgetValues[panelCollapsedKey] === true;

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

  // Panel render view: live `result` wins; on fresh remount fall back to the
  // persisted already-filtered snapshot. The render layer trusts the snapshot
  // verbatim — no live derivation of "which criterion is currently failing"
  // from key ordering (that would risk leaking stale later-group hints back
  // into the panel before the next Tjek).
  const panelView: { entries: PanelEntry[]; activeCriterionId: string | null } = result
    ? computePanelView(result, tiers, firstFailingCriterion)
    : {
        entries: panelSnapshot?.entries ?? [],
        activeCriterionId: panelSnapshot?.activeCriterionId ?? null,
      };
  const pinnedErrors = panelView.entries.filter((e) => e.tone === 'misconception');
  const activeStackEntries = panelView.entries.filter((e) => e.tone === 'hint');
  const activeStackVisible = activeStackEntries.length > 0;
  const hasContent = activeStackVisible || pinnedErrors.length > 0;

  // First-show write of the sticky `panelShown` bit. The guard makes this
  // one-shot — once the bit lands in widgetValues, the effect's `panelShown`
  // dep is `true` and the body short-circuits.
  useEffect(() => {
    if (!panelShown && hasContent) {
      setWidgetValue(panelShownKey, true);
    }
  }, [panelShown, hasContent, panelShownKey, setWidgetValue]);

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
  const armedSpendable = armed && rubricSpendableCount > 0;

  const spendNextAvailableTier = () => {
    // Strict per-group gating: target the first failing criterion only.
    // If its ladder is capped, no-op until the student satisfies it.
    const target = firstFailingCriterion;
    if (!target || target.tier >= target.cap) return;
    spendAndRevealRubricTier({ widgetId: id, criterionId: target.id, hintCap: target.cap });
    exitSpendMode();
    // Auto-reopen the panel on any spend. The freshly-revealed hint is the
    // whole point — a collapsed panel must surface it.
    if (panelCollapsed) setWidgetValue(panelCollapsedKey, false);
    // Re-snapshot the Tips list against the projected next-tier value so the
    // freshly-revealed bullet survives a remount. Spends only happen while
    // `result` is non-null (failingCriteria reads from it), so the guard
    // here is defensive.
    if (result) {
      const nextTiers = { ...tiers, [target.id]: target.tier + 1 };
      const nextActive: FailingCriterion = { ...target, tier: target.tier + 1 };
      const view = computePanelView(result, nextTiers, nextActive);
      setWidgetValue(panelEntriesKey, view);
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

  // Panel renders only when it has been shown at least once, content is
  // present, and the student hasn't manually collapsed it. The hasContent
  // guard prevents the "empty box on satisfy" failure mode — when the active
  // group is satisfied AND no errors are pinned, the panel hides.
  const panelVisible = panelShown && hasContent && !panelCollapsed;
  const pipCount = panelView.entries.length;
  const pipsVisible = panelShown && hasContent;

  const pipShowLabelTemplate = pipToggleShowLabel ?? strings.widgets.rubric.pipToggleShowLabel;
  const pipHideLabelTemplate = pipToggleHideLabel ?? strings.widgets.rubric.pipToggleHideLabel;
  const pipAriaLabel = panelCollapsed
    ? format(pipShowLabelTemplate, { n: pipCount })
    : pipHideLabelTemplate;

  const togglePanelCollapsed = () => {
    setWidgetValue(panelCollapsedKey, !panelCollapsed);
  };

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
      {/* Wrapper hosts the textarea + the bottom-left pip cluster. `relative`
          for the pip-cluster's absolute positioning. */}
      <span className="relative block w-full">
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
        {pipsVisible && pipCount > 0 && (
          // Pip cluster as panel toggle. Mirrors VariableTable's focused-state
          // pip geometry: container `-bottom-1.5` (6 px below the textarea
          // bottom border), pips `h-3.5` (14 px), so the pip top sits 8 px
          // inside the textarea and the pip bottom lands exactly on the panel
          // top edge (panel row uses `mt-1.5` for the matching 6 px offset).
          // No button padding/background chrome — keeping the click target as
          // just the pips themselves preserves VT's visual identity. Hover +
          // focus-visible darken each pip (amber-400 → amber-600).
          <button
            type="button"
            onClick={togglePanelCollapsed}
            aria-label={pipAriaLabel}
            aria-expanded={!panelCollapsed}
            className="group absolute -bottom-1.5 left-2 flex gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm"
          >
            {panelView.entries.map((entry) => (
              <span
                key={`rr-${id}-pip-${entry.key}`}
                aria-hidden="true"
                className="block h-3.5 w-0.5 rounded-sm bg-amber-400 transition-colors group-hover:bg-amber-600 group-focus-visible:bg-amber-600"
              />
            ))}
          </button>
        )}
      </span>
      {/* Row directly under the textarea wrapper: hint panel on the left so
          the pip cluster (positioned at the textarea's -bottom-1.5) lands
          exactly on its top edge, word counter on the right. The row always
          renders so the counter stays right-aligned even when the panel is
          hidden. `mt-1.5` (6 px) matches the pip-toggle's `-bottom-1.5`
          (-6 px) so pip-bottom == panel-top, mirroring VariableTable's
          pip→popup geometry. */}
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Panel — flat list. Pinned misconceptions at top (orange
              flat-dash bullets), then the active group's spent-hint stack
              newest-on-top. No criterion-label headers in the panel — the
              surface reads as a single hint list. */}
          {panelVisible && (
            <section
              aria-label={strings.widgets.rubric.hintsLabel}
              // `hint-popup` class is the same hook globals.css uses to
              // suppress the project-wide `.prose ul > li::before` blue dot.
              className="hint-popup max-w-[50ch] rounded-md border border-amber-300 bg-slate-50 p-3 text-sm"
            >
              {pinnedErrors.length > 0 && (
                <ul className={`space-y-1${activeStackVisible ? ' mb-2' : ''}`}>
                  {pinnedErrors.map((entry) => (
                    <li key={entry.key} className="flex items-start gap-2 text-orange-800">
                      <span aria-hidden="true" className="select-none leading-snug">
                        –
                      </span>
                      <span>{entry.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {activeStackVisible && (
                <ul className="space-y-1">
                  {activeStackEntries.map((entry) => {
                    const isDirective = entry.isActiveDirective === true;
                    return (
                      <li
                        key={entry.key}
                        className={`flex items-start gap-2 ${
                          isDirective ? 'text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`select-none leading-snug ${
                            isDirective ? 'text-sm text-accent' : ''
                          }`}
                        >
                          {isDirective ? '➔' : '–'}
                        </span>
                        <span>{entry.text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
        <div id={helpId} aria-live="polite" className="shrink-0 text-right text-xs">
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
      </div>

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
