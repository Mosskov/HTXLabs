import { useEffect, useState } from 'react';
import { useRunner } from '../RunnerContext';
import { strings } from '../strings.da';

interface Option {
  id: string;
  label: string;
  correct?: boolean;
}

interface Props {
  id: string;
  prompt: string;
  options: Option[];
  /** Override the default "Korrekt!" feedback. */
  correctMessage?: string;
  /** Override the default "Forkert — prøv igen." feedback. */
  incorrectMessage?: string;
}

/** Single-select multiple-choice. Registers `{ kind: 'correct', correct }`
 * after the student presses "Tjek". Gate via
 * `{ type: 'all-correct', widgetIds: [...] }`. Picking a different option
 * after a check re-locks the gate until the student presses "Tjek" again. */
export function Quiz({ id, prompt, options, correctMessage, incorrectMessage }: Props) {
  const { state, setWidgetValue, registerWidgetState, bumpAttempts } = useRunner();
  const value = state.widgetValues[id] as string | undefined;
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

  const correctOptionId = options.find((o) => o.correct)?.id;
  const checkedNow = checkedFor != null && value === checkedFor;
  const correct = checkedNow && value === correctOptionId;

  // No unmount cleanup: the registered state must outlive a phase change so the
  // gate stays satisfied when the student navigates away and back. The pre-check
  // `null` registration below is intentional — that's the unchecked state, not
  // unmount cleanup.
  useEffect(() => {
    if (!checkedNow) {
      registerWidgetState(id, null);
      return;
    }
    registerWidgetState(id, { kind: 'correct', correct });
  }, [id, checkedNow, correct, registerWidgetState]);

  function onPick(optId: string) {
    setWidgetValue(id, optId);
    // Explicit reset: changing the answer must clear any prior feedback so the
    // student is forced to press "Tjek" again to re-validate.
    if (checkedFor !== null && optId !== checkedFor) setCheckedFor(null);
  }

  function onCheck() {
    if (!value) return;
    bumpAttempts(id);
    setCheckedFor(value);
  }

  return (
    <div className="my-4">
      <p className="text-sm font-medium text-slate-800 mb-2">{prompt}</p>
      <ul className="space-y-1">
        {options.map((opt) => (
          <li key={opt.id}>
            <label className="inline-flex items-center gap-2 text-slate-800">
              <input
                type="radio"
                name={`quiz-${id}`}
                checked={value === opt.id}
                onChange={() => onPick(opt.id)}
              />
              <span>{opt.label}</span>
            </label>
          </li>
        ))}
      </ul>

      {/* TODO(SPEC §13): migrate to phase-footer button registration when runner API lands. */}
      <button
        type="button"
        onClick={onCheck}
        disabled={!value}
        className="mt-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm disabled:opacity-50"
      >
        Tjek
      </button>

      {checkedNow && (
        <p className={`mt-1 text-sm ${correct ? 'text-emerald-700' : 'text-amber-700'}`}>
          {correct
            ? (correctMessage ?? strings.widgets.quiz.correct)
            : (incorrectMessage ?? strings.widgets.quiz.incorrect)}
        </p>
      )}
    </div>
  );
}
