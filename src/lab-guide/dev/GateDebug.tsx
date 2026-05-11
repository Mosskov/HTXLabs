import { useRunner } from '@/lab-guide/RunnerContext';
import { canAdvanceTo, isGateSatisfied } from '@/lab-guide/gates';

/** Testbed-only panel: snapshots runner state and gate evaluations so you can
 * verify gate logic without trusting the visual stepper/footer. Auto-mounted
 * by `LabGuide` on `tags: ['test']` labs in dev — not student-facing. */
export function GateDebug() {
  const { state, phases, gateCtx, simulation } = useRunner();
  const simState = gateCtx.simulationStateRef.current;
  const simGateNames = Object.keys(simulation?.gates ?? {});
  const referencedPredicates = phases
    .filter((p) => p.gate.type === 'predicate')
    .map((p) => (p.gate as { type: 'predicate'; name: string }).name);
  const missingPredicates = referencedPredicates.filter((n) => !simGateNames.includes(n));

  return (
    <div className="my-6 rounded border border-amber-300 bg-amber-50 p-4 font-mono text-xs text-stone-800">
      <div className="mb-3 font-sans text-sm font-semibold text-amber-900">
        🔬 GateDebug — runtime snapshot
      </div>

      <Section title="Top">
        <KV k="currentPhaseId" v={state.currentPhaseId} />
        <KV k="mode" v={state.mode} />
        <KV k="labMode" v={state.labMode} />
        <KV k="dataPointCount (per phase)" v={formatDataPointCount(state.dataPointCount)} />
        <KV k="firedMilestones (per phase)" v={formatFiredMilestones(state.firedMilestones)} />
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
              const ok = isGateSatisfied(p.gate, state, simulation, gateCtx, p.id);
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

      <Section title="Simulation">
        <KV k="exposed gates" v={simGateNames.length === 0 ? '∅' : simGateNames.join(', ')} />
        {missingPredicates.length > 0 && (
          <div className="mt-1 text-red-700">
            ⚠ predicate gate(s) reference unknown sim gate name: {missingPredicates.join(', ')}
          </div>
        )}
        <div className="mt-2 font-sans text-xs text-stone-500">simulationState</div>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-white/60 p-2">
          {simState === null || simState === undefined ? 'null' : JSON.stringify(simState, null, 2)}
        </pre>
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

function formatDataPointCount(rec: Record<string, number>): string {
  const entries = Object.entries(rec).filter(([, n]) => n > 0);
  if (entries.length === 0) return '∅';
  return entries.map(([phaseId, n]) => `${phaseId}=${n}`).join(', ');
}

function formatFiredMilestones(rec: Record<string, Set<string>>): string {
  const entries = Object.entries(rec).filter(([, set]) => set.size > 0);
  if (entries.length === 0) return '∅';
  return entries.map(([phaseId, set]) => `${phaseId}={${Array.from(set).join(',')}}`).join(' | ');
}
