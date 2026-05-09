import { useEffect } from 'react';
import { useRunner } from '../RunnerContext';

interface Item {
  id: string;
  label: string;
}

interface Props {
  id: string;
  items: Item[];
}

/** Generic checklist. Each item has an id and a label; the widget value is a
 * record `{ [itemId]: boolean }`. Gate via
 * `{ type: 'all-checked', widgetIds: [...] }`. */
export function Checklist({ id, items }: Props) {
  const { state, setWidgetValue, registerWidgetState } = useRunner();
  const ticks = (state.widgetValues[id] as Record<string, boolean> | undefined) ?? {};
  const allChecked = items.length > 0 && items.every((it) => ticks[it.id]);

  // No unmount cleanup: the registered state must outlive a phase change so the
  // gate stays satisfied when the student navigates away and back.
  useEffect(() => {
    registerWidgetState(id, { kind: 'checked', allChecked });
  }, [id, allChecked, registerWidgetState]);

  function toggle(itemId: string) {
    setWidgetValue(id, { ...ticks, [itemId]: !ticks[itemId] });
  }

  return (
    <ul className="my-4 space-y-2">
      {items.map((it) => (
        <li key={it.id}>
          <label className="inline-flex items-center gap-2 text-slate-800">
            <input type="checkbox" checked={!!ticks[it.id]} onChange={() => toggle(it.id)} />
            <span>{it.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
