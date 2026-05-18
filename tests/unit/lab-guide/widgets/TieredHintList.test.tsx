import { TieredHintList } from '@/lab-guide/widgets/TieredHintList';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('TieredHintList — list variant (default)', () => {
  it('renders nothing when given no hints and no bonus', () => {
    const { container } = render(<TieredHintList failedHints={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the failed hints as a bulleted list', () => {
    render(
      <TieredHintList
        failedHints={[
          { key: 'a', text: 'tip A' },
          { key: 'b', text: 'tip B' },
        ]}
      />,
    );
    expect(screen.getByText('tip A')).toBeInTheDocument();
    expect(screen.getByText('tip B')).toBeInTheDocument();
  });

  it('caller supplies dedupe — each unique key renders once', () => {
    // The component itself does not deduplicate; first-producer-wins is
    // enforced by the upstream `failedHints` builder.
    render(
      <TieredHintList
        failedHints={[
          { key: 'a', text: 'shared tip' },
          { key: 'b', text: 'unique tip' },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders misconceptions with orange styling alongside hints', () => {
    render(
      <TieredHintList
        failedHints={[{ key: 'a', text: 'tip' }]}
        misconceptions={[{ key: 'm', text: 'misconception text' }]}
      />,
    );
    const mis = screen.getByText('misconception text');
    expect(mis).toBeInTheDocument();
    // Misconception entries carry the orange color class.
    expect(mis.className).toContain('text-orange-800');
  });

  it('renders the bonus panel only when bonusHints is non-empty', () => {
    const { rerender } = render(
      <TieredHintList failedHints={[{ key: 'a', text: 'tip' }]} bonusHints={[]} />,
    );
    // No bonus heading on first render.
    expect(screen.queryByText(/Vil du gøre svaret stærkere/)).not.toBeInTheDocument();

    rerender(
      <TieredHintList
        failedHints={[{ key: 'a', text: 'tip' }]}
        bonusHints={[{ key: 'b1', text: 'bonus item' }]}
      />,
    );
    expect(screen.getByText('bonus item')).toBeInTheDocument();
  });

  it('honors a custom bonusTitle', () => {
    render(
      <TieredHintList
        failedHints={[]}
        bonusHints={[{ key: 'b', text: 'b' }]}
        bonusTitle="Tilføj dette"
      />,
    );
    expect(screen.getByText('Tilføj dette')).toBeInTheDocument();
  });
});

describe('TieredHintList — inline variant', () => {
  it('renders the first hint as a paragraph (no <ul>)', () => {
    render(<TieredHintList variant="inline" failedHints={[{ key: 'a', text: 'inline tip' }]} />);
    const p = screen.getByText('inline tip');
    expect(p.tagName).toBe('P');
    expect(p.className).toContain('text-slate-600');
  });

  it('renders nothing when failedHints is empty', () => {
    const { container } = render(<TieredHintList variant="inline" failedHints={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('ignores misconceptions and bonusHints', () => {
    render(
      <TieredHintList
        variant="inline"
        failedHints={[{ key: 'a', text: 'just this' }]}
        misconceptions={[{ key: 'm', text: 'misconception (ignored)' }]}
        bonusHints={[{ key: 'b', text: 'bonus (ignored)' }]}
      />,
    );
    expect(screen.getByText('just this')).toBeInTheDocument();
    expect(screen.queryByText('misconception (ignored)')).not.toBeInTheDocument();
    expect(screen.queryByText('bonus (ignored)')).not.toBeInTheDocument();
  });
});
