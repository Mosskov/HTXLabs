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
          {/* Bullets are an explicit amber span matching the cell-side idle
              dot in VariableTable verbatim (h-1.5 w-1.5 rounded-full
              bg-amber-400) so the popup reads as continuous with its
              trigger. Body text stays per-tone so misconception (orange) /
              reveal (emerald) / paid hint (slate) still differentiate. The
              project-wide `.prose ul > li::before` blue-dot would otherwise
              paint on top of the amber span — it's suppressed by a scoped
              override in globals.css that targets `.hint-popup ul > li`. */}
          <ul className="space-y-1">
            {g.items.map((item) => (
              <li key={item.key} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-[0.45rem] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                />
                <span
                  className={
                    item.tone === 'misconception'
                      ? 'text-orange-800'
                      : item.tone === 'reveal'
                        ? 'text-emerald-800'
                        : 'text-slate-700'
                  }
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
