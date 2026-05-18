import type { ProgressEvent } from '@/sim-contract';
import TemplateSim, { gates } from '@/simulations/template-sim';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

function setup() {
  const onProgress = vi.fn<(e: ProgressEvent) => void>();
  const onState = vi.fn<(s: unknown) => void>();
  render(<TemplateSim width={400} height={300} onProgress={onProgress} onState={onState} />);
  return { onProgress, onState };
}

describe('template-sim component', () => {
  it('emits data-collected and the first-measurement milestone on the first add', async () => {
    const user = userEvent.setup();
    const { onProgress } = setup();

    await user.click(screen.getByRole('button', { name: /tilføj måling/i }));

    const events = onProgress.mock.calls.map((c) => c[0]);
    expect(events).toContainEqual({ type: 'data-collected', count: 1 });
    expect(events).toContainEqual({ type: 'milestone', id: 'first-measurement' });
  });

  it('only fires the first-measurement milestone once across multiple adds', async () => {
    const user = userEvent.setup();
    const { onProgress } = setup();

    const addBtn = screen.getByRole('button', { name: /tilføj måling/i });
    await user.click(addBtn);
    await user.click(addBtn);
    await user.click(addBtn);

    const milestones = onProgress.mock.calls
      .map((c) => c[0])
      .filter((e) => e.type === 'milestone' && e.id === 'first-measurement');
    expect(milestones).toHaveLength(1);
  });

  it('fires the review-completed milestone exactly once', async () => {
    const user = userEvent.setup();
    const { onProgress } = setup();

    const reviewBtn = screen.getByRole('button', { name: /markér rapport gennemset/i });
    await user.click(reviewBtn);
    expect(reviewBtn).toBeDisabled();

    const milestones = onProgress.mock.calls
      .map((c) => c[0])
      .filter((e) => e.type === 'milestone' && e.id === 'review-completed');
    expect(milestones).toHaveLength(1);
  });

  it('publishes measurements via onState', async () => {
    const user = userEvent.setup();
    const { onState } = setup();

    await user.click(screen.getByRole('button', { name: /tilføj måling/i }));

    const last = onState.mock.calls.at(-1)?.[0] as {
      measurements: Array<{ x: number; y: number }>;
    };
    expect(last.measurements).toHaveLength(1);
    expect(last.measurements[0]).toMatchObject({ x: 5 });
  });
});

describe('template-sim gates.wide-range predicate', () => {
  it('false when no published state', () => {
    expect(gates['wide-range'](null)).toBe(false);
  });

  it('false when measurements are bunched in the middle', () => {
    expect(
      gates['wide-range']({
        measurements: [
          { x: 5, y: 1 },
          { x: 6, y: 2 },
        ],
      }),
    ).toBe(false);
  });

  it('true when measurements span the slider', () => {
    expect(
      gates['wide-range']({
        measurements: [
          { x: 1, y: 0 },
          { x: 9, y: 0 },
        ],
      }),
    ).toBe(true);
  });
});
