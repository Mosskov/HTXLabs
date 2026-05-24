import type { HintPopupEntry } from '@/lab-guide/widgets/HintPopup';
import { TieredHintList } from '@/lab-guide/widgets/TieredHintList';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('TieredHintList', () => {
  it('renders nothing for an empty entries list', () => {
    const { container } = render(<TieredHintList entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders entries as a bulleted list', () => {
    const entries: HintPopupEntry[] = [
      { key: 'a', text: 'tip A', tone: 'hint' },
      { key: 'b', text: 'tip B', tone: 'hint' },
    ];
    render(<TieredHintList entries={entries} />);
    expect(screen.getByText('tip A')).toBeInTheDocument();
    expect(screen.getByText('tip B')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders misconception entries with orange styling', () => {
    const entries: HintPopupEntry[] = [
      { key: 'm', text: 'common misconception', tone: 'misconception' },
      { key: 'h', text: 'paid hint', tone: 'hint' },
    ];
    render(<TieredHintList entries={entries} />);
    // Tone class lives on the <li> so both the dash glyph and the text inherit it.
    const mis = screen.getByText('common misconception').closest('li');
    expect(mis?.className).toContain('text-orange-800');
  });

  it('renders reveal entries with distinct (emerald) styling', () => {
    const entries: HintPopupEntry[] = [
      { key: 'r', text: 'the full answer', tone: 'reveal' },
    ];
    render(<TieredHintList entries={entries} />);
    const reveal = screen.getByText('the full answer').closest('li');
    expect(reveal?.className).toContain('text-emerald-800');
  });

  it('groups consecutive entries with the same `group` under one header', () => {
    const entries: HintPopupEntry[] = [
      { key: 'a', text: 'tier 1', tone: 'hint', group: 'Criterion B' },
      { key: 'b', text: 'tier 2', tone: 'hint', group: 'Criterion B' },
      { key: 'c', text: 'tier 1', tone: 'hint', group: 'Criterion C' },
    ];
    render(<TieredHintList entries={entries} />);
    expect(screen.getAllByText('Criterion B')).toHaveLength(1);
    expect(screen.getAllByText('Criterion C')).toHaveLength(1);
  });

  it('does not render a header when entries have no group', () => {
    const entries: HintPopupEntry[] = [
      { key: 'a', text: 'one', tone: 'hint' },
      { key: 'b', text: 'two', tone: 'misconception' },
    ];
    const { container } = render(<TieredHintList entries={entries} />);
    // No uppercase-tracking header div.
    expect(container.querySelectorAll('.uppercase')).toHaveLength(0);
  });
});
