import { useRunner } from '../RunnerContext';
import { useRegisteredWidgetState } from '../useRegisteredWidgetState';

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
 * `{ type: 'all-checked', widgetIds: [...] }`. The wrapping `<ul>` is a
 * native list — surrounding MDX provides the visible/labelling heading. */
export function Checklist({ id, items }: Props) {
  const { state, setWidgetValue } = useRunner();
  const ticks = (state.widgetValues[id] as Record<string, boolean> | undefined) ?? {};
  const allChecked = items.length > 0 && items.every((it) => ticks[it.id]);

  useRegisteredWidgetState(id, { kind: 'checked', allChecked }, [allChecked]);

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
