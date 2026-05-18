// Dev-only diagnostic surface for variable-table-test phase 3. Subscribes to
// a VariableTable's registered state and renders the structured
// CorrectnessReport so the author can see each CellError type and
// RowMatch status fire in real time. Read-only consumer; never writes.
import { useWidgetState } from '@/lab-guide/RunnerContext';
import type {
  CellError,
  CorrectnessReport,
  RowMatch,
  VariableRowErrors,
} from '@/lab-guide/widgets/variableTableCorrectness';

interface Props {
  widgetId: string;
}

const CELL_LABEL: Record<keyof VariableRowErrors, string> = {
  name: 'Navn',
  symbol: 'Symbol',
  unit: 'Enhed',
};

function cellTag(err: CellError | undefined): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (!err) return { text: '✓', tone: 'ok' };
  switch (err.type) {
    case 'empty':
      return { text: 'tom', tone: 'bad' };
    case 'mismatch':
      return { text: 'forkert', tone: 'bad' };
    case 'case-mismatch':
      return { text: 'case-fejl', tone: 'warn' };
    case 'misplaced':
      return { text: `misplaced (fra ${err.from})`, tone: 'warn' };
    case 'row-swapped':
      return { text: `byttet (med ${err.from})`, tone: 'warn' };
    case 'common-mistake':
      return { text: `common: ${err.kind}`, tone: 'warn' };
    case 'whitespace-internal':
      return { text: 'mellemrum', tone: 'warn' };
  }
}

function toneClass(tone: 'ok' | 'warn' | 'bad'): string {
  if (tone === 'ok') return 'bg-emerald-100 text-emerald-800';
  if (tone === 'warn') return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
}

function matchTone(status: RowMatch['status']): 'ok' | 'warn' | 'bad' {
  if (status === 'matched') return 'ok';
  if (status === 'partial') return 'warn';
  return 'bad';
}

function RowMatchBlock({ match }: { match: RowMatch }) {
  const tone = matchTone(match.status);
  return (
    <div className={`rounded px-2 py-1 text-xs ${toneClass(tone)}`}>
      <div>
        <span className="font-medium">Forventet #{match.expectedIndex}:</span> {match.status}
        {match.status !== 'missing' && <> (række #{match.studentIndex})</>}
      </div>
      {match.status === 'partial' && (
        <div className="mt-1 flex flex-wrap gap-2">
          {(['name', 'symbol', 'unit'] as const).map((c) => {
            const tag = cellTag(match.errors[c]);
            return (
              <span key={c} className={`rounded px-2 py-0.5 ${toneClass(tag.tone)}`}>
                {CELL_LABEL[c]}: {tag.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionBlock({ label, matches }: { label: string; matches: RowMatch[] }) {
  return (
    <div className="mb-2">
      <div className="text-xs font-semibold text-slate-700 mb-1">{label}</div>
      {matches.length === 0 ? (
        <div className="text-xs text-slate-500">(ingen forventede)</div>
      ) : (
        <div className="flex flex-col gap-1">
          {matches.map((m) => (
            <RowMatchBlock key={`${m.status}-${m.expectedIndex}`} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ErrorInspector({ widgetId }: Props) {
  const w = useWidgetState(widgetId);
  if (!w || w.kind !== 'filled') {
    return (
      <div className="my-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        Inspector: (ingen registrering endnu — udfyld i det mindste én celle)
      </div>
    );
  }
  const report = w.errors as CorrectnessReport | undefined;
  return (
    <div className="my-4 rounded border border-slate-200 bg-slate-50 p-3 font-mono text-sm">
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        <span className={`rounded px-2 py-0.5 ${toneClass(w.filled ? 'ok' : 'bad')}`}>
          filled: {String(w.filled)}
        </span>
        <span
          className={`rounded px-2 py-0.5 ${toneClass(
            w.correct === true ? 'ok' : w.correct === false ? 'bad' : 'warn',
          )}`}
        >
          correct: {w.correct === undefined ? '—' : String(w.correct)}
        </span>
      </div>
      {report ? (
        <>
          <SectionBlock label="Uafhængige variable (IV-rækker)" matches={report.iv} />
          <SectionBlock label="Afhængige variable (DV-rækker)" matches={report.dv} />
          <SectionBlock label="Konstanter" matches={report.constants ?? []} />
        </>
      ) : (
        <div className="text-xs text-slate-500">
          (widget kører uden `expected` — ingen CorrectnessReport)
        </div>
      )}
    </div>
  );
}
