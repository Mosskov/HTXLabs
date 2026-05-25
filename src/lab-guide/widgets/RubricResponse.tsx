// Student-facing rubric widget: textarea + "Tjek mit svar" button, evaluates against a rubric JSON.
//
// Contract with the gate: this widget registers `{ kind: 'rubric', satisfied }`
// where `satisfied` is derived each render from
//   `!dirty && !embedderDown && requiredSatisfied`, sourced from the live
// `result` (just-evaluated) or the persisted pass record (cross-reload).
// Editing the text — or changing `dependsOn` — flips `dirty:true` → the gate
// re-closes without us touching the persisted record. Feedback to the student
// comes from a focus-triggered HintPopup beside the textarea (misconceptions
// always free + orange; revealed criterion tiers stacked underneath) plus the
// Next-phase button enabling on pass; an sr-only `<output>` announces
// "Godkendt" once for AT users.
//
// Reload-safety: each completed evaluate writes a minimal pass record to
// `widgetValues[`${id}:result`]` containing
//   `{ lastCheckedText, lastCheckedDependsOn, requiredSatisfied, embedderDown }`.
// On reload, that record hydrates the gate + pill so a prior pass survives
// without forcing a re-Tjek. The full `RubricResult` (criteria, hints,
// misconceptions) is component-state only — the popup will render empty until
// the next Tjek, but spent tier counters survive in `state.rubricHintTiers`
// so the very next Tjek immediately re-paints every paid tier without
// spending again. This is the accepted trade-off vs. persisting embedder
// vectors.
//
// Hint system: request-driven, per-phase token bucket. Auto-bump on Tjek is
// gone — students opt into seeing a tier by clicking the bucket (arms spend
// mode) and then a per-criterion lightbulb. The widget registers itself as
// hint-eligible against the PhaseScopeContext so the runner ticker / bucket
// know which phase owns it.
import { DEV_EMBEDDER_URL, type Embedder, HttpEmbedder } from '@/lib/rubric/embedder';
import {
  CHECK_STATUSES,
  type RubricResult,
  VETO_STATUSES,
  evaluateRubric,
  parseRubric,
} from '@/lib/rubric/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useHintSpend } from '../HintSpendContext';
import { useRunner } from '../RunnerContext';
import { Tooltip } from '../Tooltip';
import { format, strings } from '../strings.da';
import { useRegisteredHintEligibility } from '../useRegisteredHintEligibility';
import { useRegisteredWidgetCheck } from '../useRegisteredWidgetCheck';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import type { WidgetCheck } from '../widgetCheck';
import { HintBucket } from './HintBucket';
import { HintLightbulb } from './HintLightbulb';
import { HintPopup, type HintPopupEntry } from './HintPopup';
import { ProtectedTextarea } from './ProtectedInput';

const defaultEmbedder: Embedder = new HttpEmbedder(DEV_EMBEDDER_URL);

const REVEAL_COST = 2;

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
  dependsOn,
  allowPaste,
  embedder = defaultEmbedder,
}: Props) {
  const { state, setWidgetValue, spendAndRevealRubricTier, bucketView, registerSpendableCount } =
    useRunner();
  const { spendMode } = useHintSpend();
  const text = (state.widgetValues[id] as string | undefined) ?? '';
  const tiers = state.rubricHintTiers[id] ?? {};
  const dependsOnNorm = dependsOn ?? null;

  const persistedKey = `${id}:result`;
  const persistedRaw = readPersisted(state.widgetValues[persistedKey]);

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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  // Live spendable-target count: the number of failing criteria that could
  // still accept a paid hint. Mirrors the eligibility rule used to render
  // `failingCriteria` below (required always counts; optional only when
  // `requiredSatisfied && evaluable`). HintBucket sums this across the phase
  // to disable when tokens > 0 but nothing is left to buy.
  const rubricSpendableCount = (() => {
    if (!parsed.ok || !result) return 0;
    let count = 0;
    for (const c of result.criteria) {
      if (c.satisfied || c.hints.length === 0) continue;
      if (c.required) {
        count++;
        continue;
      }
      if (result.requiredSatisfied && c.evaluable) count++;
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
    // persisted record here — that's what lets the pill show "Ændret siden
    // tjek" rather than reverting to "Ikke tjekket endnu".
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

  // Surface a fresh result (live or persisted-shaped) for the popup, gated on
  // the same "feedback only" rule: result present, not dirty, not mid-check.
  // `lastCheckedText !== null` keeps stale local `result` from driving popups
  // after `resetLab` clears the persisted record without remounting the widget.
  const showFeedback = !!result && lastCheckedText !== null && !dirty && !pending;

  // Build the popup entries from the latest result + persisted tier counters.
  // - Misconceptions are free and always appear at the top in orange.
  // - For each criterion with `tier > 0`: render its tier texts under a header
  //   with the criterion label. Reveal text (tier === hintCap + 1) appears
  //   underneath in distinct tone.
  const popupEntries: HintPopupEntry[] = (() => {
    if (!showFeedback || !result) return [];
    const entries: HintPopupEntry[] = [];
    // Misconceptions — free, always shown when result is fresh.
    for (const c of result.criteria) {
      for (const m of c.misconceptions) {
        if (m.status !== VETO_STATUSES.TRIGGERED) continue;
        entries.push({
          key: `mis-${c.id}-${m.hint}`,
          text: m.hint,
          tone: 'misconception',
        });
      }
    }
    // Paid tier reveals per criterion. Walk criteria in author order so the
    // popup reads consistently across re-evaluations.
    for (const c of result.criteria) {
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
      if (tier > cap && c.reveal !== undefined) {
        entries.push({
          key: `reveal-${c.id}`,
          text: c.reveal,
          tone: 'reveal',
          group: c.label,
        });
      }
    }
    return entries;
  })();

  const showEmbedderBanner = embedderDown && !dirty;

  const helpId = `rr-${id}-help`;

  // Visible status pill removed — feedback now comes from the popup (on fail)
  // and the Next-phase button enabling (on pass). The sr-only live region
  // preserves the AT-side "Godkendt" announcement on pass.
  const showAriaStatus = !pending && !dirty && satisfied;

  // Spend mode: render lightbulbs alongside failing criteria. Only the active
  // phase's widget shows them — spend-mode's `phaseId` is the active phase,
  // and PhaseScopeContext ensures only the active phase body is visible.
  const armed =
    spendMode.kind === 'active' && spendMode.phaseId === state.currentPhaseId && showFeedback;
  const currentPhase = state.currentPhaseId;
  const bucket = bucketView(currentPhase);

  const failingCriteria = (() => {
    if (!result)
      return [] as { id: string; label: string; cap: number; tier: number; reveal?: string }[];
    // Eligibility mirrors the old auto-bump rule: required criteria always
    // count; optional ones only once `requiredSatisfied` AND `evaluable` so
    // an embedder outage on a semantic-only bonus doesn't surface unreachable
    // hints — the verdict on the bonus isn't real when the system can't
    // evaluate it.
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
        reveal: c.reveal,
      }));
  })();

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

  return (
    <div className="my-4">
      <label htmlFor={`rr-${id}`} className="block text-sm font-medium text-slate-800 mb-1">
        {prompt}
      </label>
      <HintPopup entries={popupEntries}>
        <ProtectedTextarea
          id={`rr-${id}`}
          value={text}
          maxLength={maxChars}
          placeholder={placeholder ?? strings.widgets.rubric.placeholder}
          aria-describedby={helpId}
          aria-invalid={tooShort || overMaxWords || undefined}
          allowPaste={allowPaste}
          onChange={(e) => onTextChange(e.target.value)}
        />
      </HintPopup>
      <div id={helpId} aria-live="polite" className="contents">
        {typeof maxChars === 'number' && (
          <div className="mt-1 text-xs text-slate-500 text-right">
            {text.length} / {maxChars}
          </div>
        )}
        {typeof maxWords === 'number' && (
          <div
            className={`mt-1 text-xs text-right ${overMaxWords ? 'text-amber-700' : 'text-slate-500'}`}
          >
            {format(strings.widgets.rubric.wordCount, { n: words, max: maxWords })}
          </div>
        )}
      </div>

      {(showAriaStatus || !footerActive) && (
        <div className="mt-2 flex items-center justify-end gap-3">
          {showAriaStatus && (
            <output className="sr-only" aria-live="polite">
              {strings.widgets.rubric.statusPassed}
            </output>
          )}
          {!footerActive && (
            <>
              <HintBucket placement="inline" />
              {wordCountHint != null ? (
                <Tooltip content={wordCountHint} align="right" openDelayMs={500}>
                  {checkButton}
                </Tooltip>
              ) : (
                checkButton
              )}
            </>
          )}
        </div>
      )}

      {showEmbedderBanner && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {embedderDownMessage ?? strings.widgets.rubric.embedderDown}
        </div>
      )}

      {armed && failingCriteria.length > 0 && (
        <ul
          aria-label={strings.widgets.rubric.hintsLabel}
          className="mt-3 list-none space-y-2 pl-0 text-sm text-slate-700"
        >
          {failingCriteria.map((c) => {
            const atCap = c.tier >= c.cap;
            // Reveal pill renders only at the boundary (tier === cap). Once the
            // reveal is unlocked (tier > cap) the criterion has nothing left to
            // spend on — the reveal text is already in the popup.
            const revealAvailable = c.tier === c.cap && c.reveal !== undefined;
            const insufficient = revealAvailable && bucket.tokens < REVEAL_COST;
            return (
              <li key={c.id} className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{c.label}</span>
                {revealAvailable ? (
                  <HintLightbulb
                    variant="reveal"
                    cost={REVEAL_COST}
                    disabled={insufficient}
                    onSpend={() =>
                      spendAndRevealRubricTier({
                        widgetId: id,
                        criterionId: c.id,
                        op: { kind: 'reveal', cost: REVEAL_COST },
                        hintCap: c.cap,
                      })
                    }
                  />
                ) : atCap ? null : (
                  <HintLightbulb
                    nextTier={c.tier + 1}
                    cap={c.cap}
                    onSpend={() =>
                      spendAndRevealRubricTier({
                        widgetId: id,
                        criterionId: c.id,
                        op: { kind: 'tier' },
                        hintCap: c.cap,
                      })
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
