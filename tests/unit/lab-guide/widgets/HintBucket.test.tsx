import { HintSpendProvider, useHintSpend } from '@/lab-guide/HintSpendContext';
import { PhaseScopeProvider } from '@/lab-guide/PhaseScopeContext';
import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { useRegisteredHintEligibility } from '@/lab-guide/useRegisteredHintEligibility';
import { HintBucket } from '@/lab-guide/widgets/HintBucket';
import type { Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

const phase: Phase = { id: 'p', title: 'P', gate: { type: 'always' } };

function Eligible({ id, spendable = 1 }: { id: string; spendable?: number }) {
  useRegisteredHintEligibility(id, true, 'rubric');
  const { registerSpendableCount } = useRunner();
  useEffect(() => {
    registerSpendableCount(id, spendable);
    return () => registerSpendableCount(id, null);
  }, [id, spendable, registerSpendableCount]);
  return null;
}

function SpendModeProbe() {
  const { spendMode } = useHintSpend();
  return <span data-testid="mode">{spendMode.kind}</span>;
}

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <RunnerProvider experimentId="hb-test" experimentVersion={1} phases={[phase]}>
      <HintSpendProvider>
        <PhaseScopeProvider phaseId="p">{children}</PhaseScopeProvider>
        <SpendModeProbe />
      </HintSpendProvider>
    </RunnerProvider>
  );
}

describe('HintBucket', () => {
  it('renders nothing when no hint-eligible widgets are registered in the phase', () => {
    render(
      <Harness>
        <HintBucket placement="footer" />
      </Harness>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders and arms spend mode on click when an eligible widget is mounted', async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Eligible id="w1" />
        <HintBucket placement="footer" />
      </Harness>,
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('idle');
    const btn = screen.getByRole('button');
    await user.click(btn);
    expect(screen.getByTestId('mode')).toHaveTextContent('active');
    await user.click(btn);
    expect(screen.getByTestId('mode')).toHaveTextContent('idle');
  });

  it('renders the token count only — no /cap denominator on the visible button', () => {
    render(
      <Harness>
        <Eligible id="w1" />
        <HintBucket placement="footer" />
      </Harness>,
    );
    const btn = screen.getByRole('button');
    // The bucket button must NOT render the literal "/" separator — F3 removed
    // the visible "/cap" denominator. (The SVG icon also paints the count, so
    // we don't assert a single-digit textContent; absence of the slash is the
    // load-bearing claim.)
    expect(btn.textContent ?? '').not.toContain('/');
    // Aria-label still names both tokens and pool for screen readers.
    expect(btn).toHaveAccessibleName(/3.*3/);
  });

  it('renders aria-disabled and does not arm spend mode when the bucket is empty', async () => {
    function DrainOnMount() {
      const { spendAndRevealRubricTier } = useRunner();
      // biome-ignore lint/correctness/useExhaustiveDependencies: drain exactly once on mount
      useEffect(() => {
        for (let i = 0; i < 3; i++) {
          spendAndRevealRubricTier({
            widgetId: 'w1',
            criterionId: `c-${i}`,
            op: { kind: 'tier' },
            hintCap: 10,
          });
        }
      }, []);
      return null;
    }
    const user = userEvent.setup();
    render(
      <Harness>
        <Eligible id="w1" />
        <DrainOnMount />
        <HintBucket placement="footer" />
      </Harness>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    await user.click(btn);
    expect(screen.getByTestId('mode')).toHaveTextContent('idle');
  });
});
