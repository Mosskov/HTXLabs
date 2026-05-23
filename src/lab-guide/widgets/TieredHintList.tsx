// Passive bullet-list renderer used as the body of HintPopup. Takes a
// pre-resolved list of entries (misconceptions at the top, then revealed
// criterion / cell tiers, then reveal text if any). The consumer owns the
// resolution + dedup; this component just paints.
//
// No inline rendering elsewhere — the request-driven hint system surfaces all
// revealed tiers through HintPopup, never below a field or inside the widget.
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
          <ul className="list-disc space-y-1 pl-4">
            {g.items.map((item) => (
              <li
                key={item.key}
                className={
                  item.tone === 'misconception'
                    ? 'text-orange-800'
                    : item.tone === 'reveal'
                      ? 'text-emerald-800'
                      : 'text-slate-700'
                }
              >
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
