// Co-located helper for phase 4: renders a button that toggles a `seed` string
// fed to RubricResponse's `dependsOn` prop, so the maintainer can verify that
// changing dependsOn after a pass flips the widget to "Ændret siden tjek" and
// closes the gate without touching the textarea.
import { RubricResponse } from '@/lab-guide/widgets';
import { useState } from 'react';

interface Props {
  rubric: unknown;
}

export function DependsOnDriver({ rubric }: Props) {
  const [seed, setSeed] = useState<'alpha' | 'beta'>('alpha');
  return (
    <>
      <div className="my-3 flex items-center gap-3 text-sm text-slate-700">
        <button
          type="button"
          onClick={() => setSeed(seed === 'alpha' ? 'beta' : 'alpha')}
          className="rounded border border-slate-300 bg-white px-3 py-1 font-medium hover:bg-slate-50"
        >
          Skift dependsOn
        </button>
        <span>
          Nuværende værdi: <code className="rounded bg-slate-100 px-1.5 py-0.5">{seed}</code>
        </span>
      </div>
      <RubricResponse
        id="dep"
        rubric={rubric}
        prompt="Skriv en hypotese (fx. 'X stiger, så Y vokser')."
        placeholder="Skriv en hypotese her…"
        minWords={5}
        dependsOn={seed}
      />
    </>
  );
}
