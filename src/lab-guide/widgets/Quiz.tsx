import { useId } from 'react';
import { useRunner } from '../RunnerContext';
import { strings } from '../strings.da';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';

interface Option {
  id: string;
  label: string;
  correct?: boolean;
}

interface Props {
  id: string;
  prompt: string;
  options: Option[];
  /** Override the default "Tjek" button label. */
  checkLabel?: string;
  /** Override the default "Korrekt!" feedback. */
  correctMessage?: string;
  /** Override the default "Forkert — prøv igen." feedback. */
  incorrectMessage?: string;
}

/** Single-select multiple-choice. Registers `{ kind: 'correct', correct }`
 * after the student presses "Tjek". Gate via
 * `{ type: 'all-correct', widgetIds: [...] }`. Picking a different option
 * after a check re-locks the gate until the student presses "Tjek" again. */
export function Quiz({ id, prompt, options, checkLabel, correctMessage, incorrectMessage }: Props) {
  const { state, setWidgetValue, bumpAttempts } = useRunner();
  const value = state.widgetValues[id] as string | undefined;
  const checkedFor = (state.widgetValues[`${id}:checked`] as string | null | undefined) ?? null;

  const correctOptionId = options.find((o) => o.correct)?.id;
  const checkedNow = checkedFor != null && value === checkedFor;
  const correct = checkedNow && value === correctOptionId;

  // The pre-check `null` registration is intentional — that's the unchecked
  // state, distinct from unmount cleanup (which the hook does not do).
  useRegisteredWidgetState(id, checkedNow ? { kind: 'correct', correct } : null, [
    checkedNow,
    correct,
  ]);

  const promptId = useId();
  const feedbackId = useId();

  function onPick(optId: string) {
    setWidgetValue(id, optId);
  }

  function onCheck() {
    if (!value) return;
    bumpAttempts(id);
    setWidgetValue(`${id}:checked`, value);
  }

  return (
    <div className="my-4">
      <p id={promptId} className="text-sm font-medium text-slate-800 mb-2">
        {prompt}
      </p>
      <ul className="space-y-1" role="radiogroup" aria-labelledby={promptId}>
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
        aria-controls={feedbackId}
        className="mt-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm disabled:opacity-50"
      >
        {checkLabel ?? strings.widgets.quiz.checkLabel}
      </button>

      <div id={feedbackId} aria-live="polite" className="contents">
        {checkedNow && (
          <p className={`mt-1 text-sm ${correct ? 'text-green-700' : 'text-amber-700'}`}>
            {correct
              ? (correctMessage ?? strings.widgets.quiz.correct)
              : (incorrectMessage ?? strings.widgets.quiz.incorrect)}
          </p>
        )}
      </div>
    </div>
  );
}
