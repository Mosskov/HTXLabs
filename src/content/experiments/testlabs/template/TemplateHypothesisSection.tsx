// Co-located helper for the template lab phase-1 hypothesis section. Reads
// the committed IV/DV symbols from the sibling VariableTable widget and
// interpolates them into the RubricResponse prompt + placeholder. Kept out
// of the framework because the symbol-injection pattern is content-layer
// scaffolding, not a framework concern.
import { useWidgetState } from '@/lab-guide/RunnerContext';
import { RubricResponse } from '@/lab-guide/widgets';
import type { VariableTableValues } from '@/lab-guide/widgets/VariableTable';

interface Props {
  rubric: unknown;
}

export function TemplateHypothesisSection({ rubric }: Props) {
  const variables = useWidgetState('variables');
  const values =
    variables?.kind === 'filled'
      ? (variables.values as VariableTableValues | undefined)
      : undefined;
  const iv = values?.iv.symbol.trim() || 'X';
  const dv = values?.dv.symbol.trim() || 'Y';
  return (
    <>
      <p className="my-3 text-slate-800">
        Hvordan forventer du at <b>{dv}</b> afhænger af <b>{iv}</b>?
      </p>
      <RubricResponse
        id="hypotese"
        rubric={rubric}
        prompt={`Skriv en kort hypotese om sammenhængen mellem ${iv} og ${dv}.`}
        placeholder={`Fx. Det forventes at ${dv} stiger lineært med ${iv} …`}
        minWords={10}
        dependsOn={`${iv}|${dv}`}
      />
    </>
  );
}
