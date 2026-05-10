import { type VariantGroup, matchVariantGroups } from '@/lib/textMatch';
import { useRunner } from '../RunnerContext';
import { format, strings } from '../strings.da';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';
import { ProtectedTextarea } from './ProtectedInput';

interface Props {
  id: string;
  prompt: string;
  /** Optional minimum word floor; below it the gate stays unfilled and an
   * amber hint shows. */
  minWords?: number;
  /** Optional hard character cap; when set, an `X / Y` counter is shown. */
  maxChars?: number;
  /** Override the default placeholder. */
  placeholder?: string;
  /** Override the default below-threshold hint. Receives no interpolation —
   * supply the full literal string. */
  tooShortMessage?: string;
  /** Opt-in keyword mode: when provided, the widget switches its registered
   * state from `{kind:'filled'}` to `{kind:'keywords', foundCount}` so it can
   * be gated via `{type:'keyword-count', widgetId, min}`. `foundCount` is the
   * number of groups with at least one variant matched, and only counts once
   * `minWords` is met (the `minWords` floor closes the spam gap). */
  keywordGroups?: VariantGroup[];
  /** Override scan-mode flags. Defaults: caseInsensitive=true, wordBoundary=true. */
  matchOptions?: { caseInsensitive?: boolean; wordBoundary?: boolean };
  /** Override the default "Nøgleord fundet: n / t" label. Substitutions
   * `{n}` and `{t}` are honoured. */
  keywordsFoundLabel?: string;
}

/** Generic free-text response. By default, persists to runner and gates via
 * `{type:'all-filled', widgetIds:[...]}`. With `keywordGroups`, switches into
 * keyword-count mode. Both quantity constraints (minWords floor, maxChars
 * ceiling) are optional. */
export function FreeTextResponse({
  id,
  prompt,
  minWords,
  maxChars,
  placeholder,
  tooShortMessage,
  keywordGroups,
  matchOptions,
  keywordsFoundLabel,
}: Props) {
  const { state, setWidgetValue } = useRunner();
  const value = (state.widgetValues[id] as string | undefined) ?? '';
  const nonEmpty = value.trim().length > 0;
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const meetsMinWords = typeof minWords !== 'number' || words >= minWords;
  const filled = nonEmpty && meetsMinWords;
  const tooShort = nonEmpty && !meetsMinWords;

  const keywordMode = Array.isArray(keywordGroups) && keywordGroups.length > 0;
  const matchResult = keywordMode
    ? matchVariantGroups(value, keywordGroups, { kind: 'scan', ...matchOptions })
    : null;
  const foundCount = keywordMode && meetsMinWords ? (matchResult?.matchedCount ?? 0) : 0;
  const total = matchResult?.total ?? 0;

  useRegisteredWidgetState(
    id,
    keywordMode ? { kind: 'keywords', foundCount, total } : { kind: 'filled', filled },
    [keywordMode, filled, foundCount, total],
  );

  const tooShortText =
    tooShortMessage ?? format(strings.widgets.freeText.tooShort, { n: minWords ?? 0 });

  const helpId = `ft-${id}-help`;

  return (
    <div className="my-4">
      <label htmlFor={`ft-${id}`} className="block text-sm font-medium text-slate-800 mb-1">
        {prompt}
      </label>
      <ProtectedTextarea
        id={`ft-${id}`}
        value={value}
        maxLength={maxChars}
        placeholder={placeholder ?? strings.widgets.freeText.placeholder}
        aria-describedby={helpId}
        aria-invalid={tooShort || undefined}
        onChange={(e) => setWidgetValue(id, e.target.value)}
      />
      <div id={helpId} aria-live="polite" className="contents">
        {tooShort && <p className="mt-1 text-xs text-amber-700">{tooShortText}</p>}
        {keywordMode && matchResult && (
          <p className="mt-1 text-xs text-slate-600">
            {format(keywordsFoundLabel ?? strings.widgets.freeText.keywordsFound, {
              n: foundCount,
              t: matchResult.total,
            })}
          </p>
        )}
        {typeof maxChars === 'number' && (
          <div className="mt-1 text-xs text-slate-500 text-right">
            {value.length} / {maxChars}
          </div>
        )}
      </div>
    </div>
  );
}
