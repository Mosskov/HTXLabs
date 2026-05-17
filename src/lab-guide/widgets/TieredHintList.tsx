// Shared tiered-hint list: bullet list + dedup + bonus panel. Consumed by
// RubricResponse and VariableTable.
//
// `variant='list'` (default): full bulleted list of failed hints + optional
// misconception color + optional bonus panel. Caller pre-dedupes via the
// `key` field — first-producer-wins is enforced upstream.
// `variant='inline'`: single inline hint paragraph (no <ul>, no bonus, no
// misconception color). Falls back to empty render when no hints.
import { strings } from '../strings.da';

export interface TieredHint {
  key: string;
  text: string;
}

export interface TieredMisconception {
  key: string;
  text: string;
}

interface Props {
  /** Pre-deduped failing-criteria hint entries. */
  failedHints: TieredHint[];
  /** Pre-resolved misconception entries (orange text in list variant). */
  misconceptions?: TieredMisconception[];
  /** Pre-deduped optional-criteria bonus hints. When non-empty, list variant
   *  renders a separate bonus panel below the main list. */
  bonusHints?: TieredHint[];
  /** Title for the bonus panel; falls back to a Danish default. */
  bonusTitle?: string;
  /** `aria-label` for the main hint list. Falls back to a Danish default. */
  ariaLabel?: string;
  /** `'list'` = bulleted list + bonus panel. `'inline'` = single hint paragraph
   *  (uses the first entry in `failedHints` only; ignores misconceptions and
   *  bonus). */
  variant?: 'list' | 'inline';
}

export function TieredHintList({
  failedHints,
  misconceptions = [],
  bonusHints = [],
  bonusTitle,
  ariaLabel,
  variant = 'list',
}: Props) {
  if (variant === 'inline') {
    const first = failedHints[0];
    if (!first) return null;
    return <p className="mt-1 text-sm text-slate-600">{first.text}</p>;
  }

  const showHints = failedHints.length > 0 || misconceptions.length > 0;
  const showBonus = bonusHints.length > 0;
  if (!showHints && !showBonus) return null;

  return (
    <>
      {showHints && (
        <ul
          aria-label={ariaLabel ?? strings.widgets.rubric.hintsLabel}
          aria-live="polite"
          className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700"
        >
          {failedHints.map((h) => (
            <li key={h.key}>{h.text}</li>
          ))}
          {misconceptions.map((m) => (
            <li key={m.key} className="text-orange-800">
              {m.text}
            </li>
          ))}
        </ul>
      )}
      {showBonus && (
        <div className="mt-3 rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <h3 className="mb-1 font-semibold text-sm">
            {bonusTitle ?? strings.widgets.rubric.bonusPanelTitle}
          </h3>
          <ul aria-live="polite" className="list-disc space-y-1 pl-5">
            {bonusHints.map((h) => (
              <li key={h.key}>{h.text}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
