// Student-facing rubric widget: textarea + "Tjek mit svar" button, evaluates against a rubric JSON.
//
// Contract with the gate: this widget registers `{ kind: 'rubric', satisfied }`
// where `satisfied` is derived each render from
//   `!dirty && !embedderDown && requiredSatisfied`, sourced from the live
// `result` (just-evaluated) or the persisted pass record (cross-reload).
// Editing the text — or changing `dependsOn` — flips `dirty:true` → the gate
// re-closes without us touching the persisted record. The status pill
// ("Ændret siden tjek") communicates that an earlier check is now stale.
//
// Reload-safety: each completed evaluate writes a minimal pass record to
// `widgetValues[`${id}:result`]` containing
//   `{ lastCheckedText, lastCheckedDependsOn, requiredSatisfied, embedderDown }`.
// On reload, that record hydrates the gate + pill so a prior pass survives
// without forcing a re-Tjek. The full `RubricResult` (criteria, hints) is
// component-state only — hints disappear on reload and reappear on next Tjek,
// which is the accepted trade-off vs. persisting embedder vectors.
import { DEV_EMBEDDER_URL, type Embedder, HttpEmbedder } from '@/lib/rubric/embedder';
import {
  CHECK_STATUSES,
  type RubricResult,
  VETO_STATUSES,
  evaluateRubric,
  parseRubric,
} from '@/lib/rubric/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRunner } from '../RunnerContext';
import { format, strings } from '../strings.da';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import { ProtectedTextarea } from './ProtectedInput';

const defaultEmbedder: Embedder = new HttpEmbedder(DEV_EMBEDDER_URL);

interface PersistedPass {
  lastCheckedText: string;
  lastCheckedDependsOn: string | null;
  requiredSatisfied: boolean;
  embedderDown: boolean;
}

function readPersisted(value: unknown): PersistedPass | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Partial<PersistedPass>;
  if (typeof p.lastCheckedText !== 'string') return null;
  if (typeof p.requiredSatisfied !== 'boolean') return null;
  return {
    lastCheckedText: p.lastCheckedText,
    lastCheckedDependsOn:
      typeof p.lastCheckedDependsOn === 'string' ? p.lastCheckedDependsOn : null,
    requiredSatisfied: p.requiredSatisfied,
    embedderDown: p.embedderDown === true,
  };
}

interface Props {
  id: string;
  prompt: string;
  rubric: unknown;
  minWords?: number;
  maxChars?: number;
  placeholder?: string;
  checkLabel?: string;
  tooShortMessage?: string;
  embedderDownMessage?: string;
  /** Title for the bonus panel surfaced when required criteria all pass but
   *  optional criteria still carry tiered hints. Defaults to
   *  `strings.widgets.rubric.bonusPanelTitle`. */
  bonusPanelTitle?: string;
  /** Opaque dependency string. When it changes after a check, `dirty` flips on
   *  (same as editing the text) and the gate re-closes. Use it to bind the
   *  pass to external context the prompt depends on — e.g. variable symbols
   *  the prompt interpolates. Caller stringifies; no deep equality. */
  dependsOn?: string;
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
  placeholder,
  checkLabel,
  tooShortMessage,
  embedderDownMessage,
  bonusPanelTitle,
  dependsOn,
  embedder = defaultEmbedder,
}: Props) {
  const { state, setWidgetValue, incrementRubricTier } = useRunner();
  const text = (state.widgetValues[id] as string | undefined) ?? '';
  const tiers = state.rubricHintTiers[id] ?? {};
  const dependsOnNorm = dependsOn ?? null;

  const persistedKey = `${id}:result`;
  const persisted = readPersisted(state.widgetValues[persistedKey]);

  const parsed = useMemo(() => parseRubric(rubric), [rubric]);
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

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const meetsMinWords = typeof minWords !== 'number' || words >= minWords;
  const nonEmpty = text.trim().length > 0;

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
          lastCheckedText: snapshotText,
          lastCheckedDependsOn: snapshotDependsOn,
          requiredSatisfied: r.requiredSatisfied,
          embedderDown: skipped,
        };
        setWidgetValue(persistedKey, record);
        // Post-resolve tier bump for criteria still failing. Required
        // criteria always count; optional criteria only count once required
        // all pass AND the optional criterion was actually evaluable — an
        // embedder outage on a semantic-only bonus must not ratchet the tier,
        // since the student can't make progress against a skipped check.
        for (const c of r.criteria) {
          if (c.satisfied || c.hints.length === 0) continue;
          if (c.required) {
            incrementRubricTier(id, c.id, c.hints.length);
          } else if (r.requiredSatisfied && c.evaluable) {
            incrementRubricTier(id, c.id, c.hints.length);
          }
        }
      }
    } finally {
      if (mountedRef.current) setPending(false);
    }
  };

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

  const checkDisabled = pending || !nonEmpty || !meetsMinWords;
  const tooShortText =
    tooShortMessage ?? format(strings.widgets.rubric.tooShort, { n: minWords ?? 0 });

  const triggeredMisconceptions =
    result && !dirty && !pending
      ? result.criteria.flatMap((c) =>
          c.misconceptions
            .filter((m) => m.status === VETO_STATUSES.TRIGGERED)
            .map((m) => ({ criterionId: c.id, hint: m.hint })),
        )
      : [];
  // Tiered hint stack for failing required criteria. Each criterion contributes
  // its first `tier` hints; we dedupe by text so e.g. a shared tier-1 nudge
  // collapses to one bullet across iv/dv/relation. First producer wins the key.
  const failedHints = (() => {
    if (!result || dirty || pending) return [] as { key: string; text: string }[];
    const entries: { criterionId: string; tier: number; text: string }[] = [];
    for (const c of result.criteria) {
      if (c.satisfied || !c.required) continue;
      const tier = tiers[c.id] ?? 0;
      if (tier === 0 || c.hints.length === 0) continue;
      for (let i = 0; i < Math.min(tier, c.hints.length); i++) {
        const text = c.hints[i];
        if (text !== undefined) entries.push({ criterionId: c.id, tier: i + 1, text });
      }
    }
    const seen = new Set<string>();
    const out: { key: string; text: string }[] = [];
    for (const e of entries) {
      if (seen.has(e.text)) continue;
      seen.add(e.text);
      out.push({ key: `fail-${e.criterionId}-${e.tier}`, text: e.text });
    }
    return out;
  })();
  // Bonus panel hints — same dedupe pass over optional unsatisfied criteria.
  // Non-evaluable optional criteria are skipped: when the embedder is down a
  // semantic-only bonus would otherwise surface unreachable advice.
  const bonusHints = (() => {
    if (!result || dirty || pending || !result.requiredSatisfied) {
      return [] as { key: string; text: string }[];
    }
    const entries: { criterionId: string; tier: number; text: string }[] = [];
    for (const c of result.criteria) {
      if (c.satisfied || c.required || !c.evaluable) continue;
      const tier = tiers[c.id] ?? 0;
      if (tier === 0 || c.hints.length === 0) continue;
      for (let i = 0; i < Math.min(tier, c.hints.length); i++) {
        const text = c.hints[i];
        if (text !== undefined) entries.push({ criterionId: c.id, tier: i + 1, text });
      }
    }
    const seen = new Set<string>();
    const out: { key: string; text: string }[] = [];
    for (const e of entries) {
      if (seen.has(e.text)) continue;
      seen.add(e.text);
      out.push({ key: `bonus-${e.criterionId}-${e.tier}`, text: e.text });
    }
    return out;
  })();
  const showHints =
    !!result &&
    !dirty &&
    !pending &&
    (failedHints.length > 0 || triggeredMisconceptions.length > 0);
  const showBonusPanel = bonusHints.length > 0;
  const showEmbedderBanner = embedderDown && !dirty;

  const tooShort = nonEmpty && !meetsMinWords;
  const helpId = `rr-${id}-help`;

  const pill = renderPill({ pending, lastCheckedText, dirty, satisfied });

  return (
    <div className="my-4">
      <label htmlFor={`rr-${id}`} className="block text-sm font-medium text-slate-800 mb-1">
        {prompt}
      </label>
      <ProtectedTextarea
        id={`rr-${id}`}
        value={text}
        maxLength={maxChars}
        placeholder={placeholder ?? strings.widgets.rubric.placeholder}
        aria-describedby={helpId}
        aria-invalid={tooShort || undefined}
        onChange={(e) => onTextChange(e.target.value)}
      />
      <div id={helpId} aria-live="polite" className="contents">
        {tooShort && <p className="mt-1 text-xs text-amber-700">{tooShortText}</p>}
        {typeof maxChars === 'number' && (
          <div className="mt-1 text-xs text-slate-500 text-right">
            {text.length} / {maxChars}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={evaluate}
          disabled={checkDisabled}
          className="rounded bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? strings.widgets.rubric.evaluating
            : (checkLabel ?? strings.widgets.rubric.checkLabel)}
        </button>
        {pill && <span className={pill.className}>{pill.label}</span>}
      </div>

      {showEmbedderBanner && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {embedderDownMessage ?? strings.widgets.rubric.embedderDown}
        </div>
      )}

      {showHints && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {failedHints.map((h) => (
            <li key={h.key}>{h.text}</li>
          ))}
          {triggeredMisconceptions.map((m) => (
            <li key={`mis-${m.criterionId}-${m.hint}`} className="text-orange-800">
              {m.hint}
            </li>
          ))}
        </ul>
      )}

      {showBonusPanel && (
        <div className="mt-3 rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <div className="mb-1 font-semibold">
            {bonusPanelTitle ?? strings.widgets.rubric.bonusPanelTitle}
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {bonusHints.map((h) => (
              <li key={h.key}>{h.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function renderPill(args: {
  pending: boolean;
  lastCheckedText: string | null;
  dirty: boolean;
  satisfied: boolean;
}): { label: string; className: string } | null {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  if (args.pending) {
    return {
      label: strings.widgets.rubric.evaluating,
      className: `${base} bg-slate-100 text-slate-700`,
    };
  }
  if (args.lastCheckedText === null) {
    return {
      label: strings.widgets.rubric.statusUnchecked,
      className: `${base} bg-slate-100 text-slate-600`,
    };
  }
  if (args.dirty) {
    return {
      label: strings.widgets.rubric.statusEdited,
      className: `${base} bg-amber-100 text-amber-900`,
    };
  }
  if (args.satisfied) {
    return {
      label: strings.widgets.rubric.statusPassed,
      className: `${base} bg-green-100 text-green-800`,
    };
  }
  // Checked, not dirty, not satisfied — the hint list speaks; no pill.
  return null;
}
