// Dev-only diagnostic UI for the rubric engine — type a student answer, see per-criterion scoring.
// Sibling of GateDebug. Refuses to render in production builds.
import { DEV_EMBEDDER_URL, HttpEmbedder } from '@/lib/rubric/embedder';
import {
  CHECK_STATUSES,
  type CriterionResult,
  type RubricResult,
  VETO_STATUSES,
  evaluateRubric,
  parseRubric,
} from '@/lib/rubric/engine';
import { useMemo, useState } from 'react';

const embedder = new HttpEmbedder(DEV_EMBEDDER_URL);

interface RubricTesterProps {
  rubric: unknown;
}

export function RubricTester(props: RubricTesterProps) {
  if (!import.meta.env.DEV) {
    return (
      <div className="my-6 rounded border border-stone-300 bg-stone-50 p-4 text-sm text-stone-700">
        Dev-only værktøj — kør lokalt (<code>npm run dev</code> + <code>npm run dev:embed</code>).
      </div>
    );
  }
  return <RubricTesterInner {...props} />;
}

function RubricTesterInner({ rubric }: RubricTesterProps) {
  const parsed = useMemo(() => parseRubric(rubric), [rubric]);
  const debug = useMemo(() => new URLSearchParams(window.location.search).has('debug'), []);

  const [text, setText] = useState('');
  const [result, setResult] = useState<RubricResult | null>(null);
  const [pending, setPending] = useState(false);

  const embedderDown = useMemo(
    () =>
      result?.criteria.some((c) =>
        c.checks.some((ck) => ck.status === CHECK_STATUSES.SKIPPED_EMBEDDER),
      ) ?? false,
    [result],
  );

  if (!parsed.ok) {
    return (
      <div className="my-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        <div className="font-semibold">Rubric-validering fejlede</div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs">
          {JSON.stringify(parsed.errors, null, 2)}
        </pre>
      </div>
    );
  }

  const rubricObj = parsed.rubric;

  async function evaluate() {
    setPending(true);
    try {
      const r = await evaluateRubric(text, rubricObj, embedder, { debug });
      setResult(r);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="my-6 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-stone-800">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold text-amber-900">🔬 RubricTester — {rubricObj.title}</div>
        <div className="text-xs text-amber-900">
          rubric: <code>{rubricObj.id}</code> v{rubricObj.version}
          {debug && <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5">debug</span>}
        </div>
      </div>

      {embedderDown && (
        <div className="mb-3 rounded border border-red-300 bg-red-100 px-3 py-2 text-xs text-red-900">
          Embed-server svarer ikke — kør <code>npm run dev:embed</code> i en anden terminal.
          Literal- og regex-checks evalueres fortsat; semantiske checks vises som <em>?</em>.
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full rounded border border-stone-300 bg-white p-2 font-sans text-sm"
        placeholder="Skriv en hypotese her…"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={evaluate}
          disabled={pending || text.trim().length === 0}
          className="rounded bg-amber-700 px-4 py-1.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Evaluerer…' : 'Evaluér'}
        </button>
        {result && (
          <div className="text-xs text-stone-600">
            <span className={result.requiredSatisfied ? 'text-green-700' : 'text-red-700'}>
              requiredSatisfied: {String(result.requiredSatisfied)}
            </span>
            <span className="ml-3">allSatisfied: {String(result.allSatisfied)}</span>
          </div>
        )}
      </div>

      {result && <ResultView result={result} debug={debug} />}
    </div>
  );
}

function ResultView({ result, debug }: { result: RubricResult; debug: boolean }) {
  const triggeredMisconceptions = result.criteria.flatMap((c) =>
    c.misconceptions
      .filter((m) => m.status === VETO_STATUSES.TRIGGERED)
      .map((m) => ({ ...m, criterionId: c.id })),
  );
  const badRegex = result.criteria.flatMap((c) => [
    ...c.vetoes
      .filter((v) => v.status === VETO_STATUSES.SKIPPED_BAD_REGEX)
      .map((v) => ({ kind: 'veto' as const, criterionId: c.id, info: v.pattern ?? v.kind })),
    ...c.misconceptions
      .filter((m) => m.status === VETO_STATUSES.SKIPPED_BAD_REGEX)
      .map((m) => ({ kind: 'misconception' as const, criterionId: c.id, info: m.pattern })),
    ...c.checks
      .filter((ck) => ck.status === CHECK_STATUSES.SKIPPED_BAD_REGEX)
      .map((ck) => ({ kind: 'check' as const, criterionId: c.id, info: ck.pattern ?? ck.kind })),
  ]);

  return (
    <div className="mt-4 space-y-4">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-amber-300 text-left">
            <th className="py-1 pr-2">kriterium</th>
            <th className="py-1 pr-2">status</th>
            <th className="py-1 pr-2">score / matches</th>
            <th className="py-1 pr-2">hint</th>
          </tr>
        </thead>
        <tbody>
          {result.criteria.map((c) => (
            <CriterionRow key={c.id} c={c} debug={debug} />
          ))}
        </tbody>
      </table>

      {triggeredMisconceptions.length > 0 && (
        <div className="rounded border border-orange-300 bg-orange-50 p-3">
          <div className="mb-1 font-semibold text-orange-900">Mulige misforståelser</div>
          <ul className="list-disc pl-5 text-sm text-orange-900">
            {triggeredMisconceptions.map((m) => (
              <li key={`${m.criterionId}-${m.pattern}`}>
                <span className="text-stone-500">[{m.criterionId}]</span> {m.hint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {badRegex.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3">
          <div className="mb-1 font-semibold text-red-900">
            Rubric-fejl: regex kunne ikke kompilere
          </div>
          <ul className="list-disc pl-5 text-xs text-red-900">
            {badRegex.map((b) => (
              <li key={`${b.criterionId}-${b.kind}-${b.info}`}>
                {b.kind} på <code>{b.criterionId}</code>: <code>{b.info}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CriterionRow({ c, debug }: { c: CriterionResult; debug: boolean }) {
  const badge = !c.evaluable ? '?' : c.satisfied ? '✓' : c.degraded ? '✗ (delvis)' : '✗';
  const badgeColor = !c.evaluable
    ? 'text-stone-500'
    : c.satisfied
      ? 'text-green-700'
      : c.degraded
        ? 'text-orange-700'
        : 'text-red-700';

  const scoreCell = c.checks
    .map((ck) => {
      if (ck.kind === 'semantic') {
        if (ck.status === CHECK_STATUSES.PASS || ck.status === CHECK_STATUSES.FAIL) {
          return `sem ${ck.score?.toFixed(3)} (${ck.bestAnchor?.text.slice(0, 30)}…)`;
        }
        return `sem ${ck.status}`;
      }
      if (ck.kind === 'literal') {
        return ck.matches?.length ? `lit ✓ [${ck.matches.join(', ')}]` : `lit ${ck.status}`;
      }
      return ck.matches?.length ? `re ✓ [${ck.matches.join(', ')}]` : `re ${ck.status}`;
    })
    .join(' · ');

  return (
    <>
      <tr className="border-b border-amber-200 align-top">
        <td className="py-1 pr-2">
          <div className="font-mono">{c.id}</div>
          <div className="text-stone-500">{c.label}</div>
          {!c.required && <div className="text-stone-400">(valgfri)</div>}
        </td>
        <td className={`py-1 pr-2 font-semibold ${badgeColor}`}>{badge}</td>
        <td className="py-1 pr-2 font-mono">{scoreCell}</td>
        <td className="py-1 pr-2 text-stone-700">{!c.satisfied && c.hint ? c.hint : null}</td>
      </tr>
      {debug && (
        <tr className="border-b border-amber-100">
          <td colSpan={4} className="py-1 pr-2 pl-4 font-mono text-stone-500">
            {c.checks
              .filter((ck) => ck.kind === 'semantic' && ck.anchorScores)
              .flatMap((ck) =>
                ck.anchorScores!.map((s) => (
                  <div key={s.text}>
                    {s.score.toFixed(3)} · {s.text}
                  </div>
                )),
              )}
          </td>
        </tr>
      )}
    </>
  );
}
