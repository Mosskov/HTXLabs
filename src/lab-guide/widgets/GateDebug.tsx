import { useRunner } from '@/lab-guide/RunnerContext';
import { canAdvanceTo, isGateSatisfied } from '@/lab-guide/gates';

/** Testbed-only widget: snapshots runner state and gate evaluations so you
 * can verify gate logic without trusting the visual stepper/footer. Drop
 * into hej-verden's theory.mdx — not for student-facing labs. */
export function GateDebug() {
  const { state, phases, gateCtx, simulation } = useRunner();

  return (
    <div className="my-6 rounded border border-amber-300 bg-amber-50 p-4 font-mono text-xs text-stone-800">
      <div className="mb-3 font-sans text-sm font-semibold text-amber-900">
        🔬 GateDebug — runtime snapshot
      </div>

      <Section title="Top">
        <KV k="currentPhaseId" v={state.currentPhaseId} />
        <KV k="mode" v={state.mode} />
        <KV k="labMode" v={state.labMode} />
        <KV k="dataPointCount" v={String(state.dataPointCount)} />
        <KV
          k="firedMilestones"
          v={state.firedMilestones.size === 0 ? '∅' : Array.from(state.firedMilestones).join(', ')}
        />
        <KV k="visitedPhaseIds" v={Array.from(state.visitedPhaseIds).join(', ')} />
      </Section>

      <Section title="Phases">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-amber-300 text-left">
              <th className="py-1 pr-2">id</th>
              <th className="py-1 pr-2">gate</th>
              <th className="py-1 pr-2">visited</th>
              <th className="py-1 pr-2">current</th>
              <th className="py-1 pr-2">isGateSatisfied</th>
              <th className="py-1 pr-2">canAdvanceTo</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((p) => {
              const visited = state.visitedPhaseIds.has(p.id);
              const current = state.currentPhaseId === p.id;
              const ok = isGateSatisfied(p.gate, state, simulation, gateCtx);
              const reachable = canAdvanceTo(p.id, phases, state, simulation, gateCtx);
              return (
                <tr key={p.id} className="border-b border-amber-200 align-top">
                  <td className="py-1 pr-2">{p.id}</td>
                  <td className="py-1 pr-2 break-all">{JSON.stringify(p.gate)}</td>
                  <td className="py-1 pr-2">{visited ? '✓' : '·'}</td>
                  <td className="py-1 pr-2">{current ? '✓' : '·'}</td>
                  <td className={`py-1 pr-2 ${ok ? 'text-green-700' : 'text-red-700'}`}>
                    {ok ? 'true' : 'false'}
                  </td>
                  <td className={`py-1 pr-2 ${reachable ? 'text-green-700' : 'text-red-700'}`}>
                    {reachable ? 'true' : 'false'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title={`Registered widget state (${Object.keys(gateCtx.widgets).length})`}>
        {Object.keys(gateCtx.widgets).length === 0 ? (
          <div>∅</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-amber-300 text-left">
                <th className="py-1 pr-2">id</th>
                <th className="py-1 pr-2">kind</th>
                <th className="py-1 pr-2">payload</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(gateCtx.widgets).map(([id, ws]) => (
                <tr key={id} className="border-b border-amber-200 align-top">
                  <td className="py-1 pr-2">{id}</td>
                  <td className="py-1 pr-2">{ws.kind}</td>
                  <td className="py-1 pr-2 break-all">{JSON.stringify(ws)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <details className="mt-2">
        <summary className="cursor-pointer font-sans text-xs text-amber-900">
          Raw state JSON
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-white/60 p-2">
          {JSON.stringify(
            {
              widgetValues: state.widgetValues,
              dataTables: state.dataTables,
              attemptCounts: state.attemptCounts,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide text-amber-900">
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-500">{k}:</span>
      <span>{v}</span>
    </div>
  );
}
