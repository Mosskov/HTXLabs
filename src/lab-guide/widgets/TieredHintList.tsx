// Passive bullet-list renderer used as the body of HintPopup. Takes a
// pre-resolved list of entries (misconceptions at the top, then revealed
// criterion / cell tiers, then reveal text if any). The consumer owns the
// resolution + dedup; this component just paints.
//
// No inline rendering inside VariableTable cells — VariableTable surfaces
// revealed tiers through HintPopup. RubricResponse renders its own panel
// inline (it doesn't use this component).
import type { HintPopupEntry } from './HintPopup';

interface Props {
  entries: HintPopupEntry[];
}

export function TieredHintList({ entries }: Props) {
  if (entries.length === 0) return null;
  // Group consecutive entries with the same `group` under one header. Pure
  // mirror of HintPopup's grouping so the two stay visually consistent.
  const groups: { header?: string; items: HintPopupEntry[] }[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.header === e.group) {
      last.items.push(e);
    } else {
      groups.push({ header: e.group, items: [e] });
    }
  }
  return (
    <>
      {groups.map((g, gi) => (
        <div
          key={`${g.header ?? ''}-${gi}-${g.items[0]?.key ?? ''}`}
          className={gi > 0 ? 'mt-2' : undefined}
        >
          {g.header && (
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {g.header}
            </div>
          )}
          {/* Bullets are a flat dash glyph that takes the same per-tone
              colour as the body text — markers recede, text leads. The
              project-wide `.prose ul > li::before` blue-dot would otherwise
              paint on top of the dash; it's suppressed by a scoped override
              in globals.css that targets `.hint-popup ul > li`. */}
          <ul className="space-y-1">
            {g.items.map((item) => {
              const toneClass =
                item.tone === 'misconception' ? 'text-orange-800' : 'text-slate-700';
              return (
                <li key={item.key} className={`flex items-start gap-2 ${toneClass}`}>
                  <span aria-hidden="true" className="select-none leading-snug">
                    –
                  </span>
                  <span>{item.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}
