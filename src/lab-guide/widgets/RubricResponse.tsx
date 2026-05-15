// Student-facing rubric widget: textarea + "Tjek mit svar" button, evaluates against a rubric JSON.
//
// Contract with the gate: this widget registers `{ kind: 'rubric', satisfied }`
// where `satisfied` is derived each render from
//   `result && !dirty && !embedderDown && result.requiredSatisfied`.
// Editing the text flips `dirty:true` → `satisfied:false` → the gate re-closes
// without us touching the stored `result`. The status pill ("Ændret siden tjek")
// communicates that an earlier check happened but is now stale.
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
  embedder = defaultEmbedder,
}: Props) {
  const { state, setWidgetValue } = useRunner();
  const text = (state.widgetValues[id] as string | undefined) ?? '';

  const parsed = useMemo(() => parseRubric(rubric), [rubric]);
  // Surface parse failures in the dev console — author sees them on page load.
  useEffect(() => {
    if (!parsed.ok) {
      console.error(`[RubricResponse:${id}] rubric failed validation`, parsed.errors);
    }
  }, [parsed, id]);

  const [result, setResult] = useState<RubricResult | null>(null);
  const [lastCheckedText, setLastCheckedText] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const embedderDown =
    !!result &&
    result.criteria.some((c) =>
      c.checks.some((ch) => ch.status === CHECK_STATUSES.SKIPPED_EMBEDDER),
    );
  const dirty = lastCheckedText !== null && text !== lastCheckedText;
  const satisfied = parsed.ok && !!result && !dirty && !embedderDown && result.requiredSatisfied;

  // Always-register pattern — even with a bad rubric, we publish satisfied:false
  // from mount so hooks order is stable across the render-branch below.
  useRegisteredWidgetState(id, { kind: 'rubric', satisfied }, [satisfied]);

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const meetsMinWords = typeof minWords !== 'number' || words >= minWords;
  const nonEmpty = text.trim().length > 0;

  const onTextChange = (next: string) => {
    // Invalidate any in-flight evaluation: when it resolves, its requestId
    // won't match anymore and the resolution gets dropped (pending still
    // clears so the button re-enables). We deliberately do NOT clear `result`
    // or `lastCheckedText` here — those are what let the pill show "Ændret
    // siden tjek" rather than reverting to "Ikke tjekket endnu".
    requestIdRef.current += 1;
    setWidgetValue(id, next);
  };

  const evaluate = async () => {
    if (!parsed.ok) return;
    const reqId = ++requestIdRef.current;
    const snapshotText = text;
    setPending(true);
    try {
      const r = await evaluateRubric(snapshotText, parsed.rubric, embedder);
      if (!mountedRef.current) return;
      if (reqId === requestIdRef.current) {
        setResult(r);
        setLastCheckedText(snapshotText);
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
  const failedHints =
    result && !dirty && !pending
      ? result.criteria.flatMap((c) =>
          !c.satisfied && c.required && c.hint ? [{ criterionId: c.id, hint: c.hint }] : [],
        )
      : [];
  const showHints =
    !!result &&
    !dirty &&
    !pending &&
    (failedHints.length > 0 || triggeredMisconceptions.length > 0);
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
            <li key={`fail-${h.criterionId}`}>{h.hint}</li>
          ))}
          {triggeredMisconceptions.map((m) => (
            <li key={`mis-${m.criterionId}-${m.hint}`} className="text-orange-800">
              {m.hint}
            </li>
          ))}
        </ul>
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
