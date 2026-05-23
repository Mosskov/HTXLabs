import { HintSpendProvider, useHintSpend } from '@/lab-guide/HintSpendContext';
import { RunnerProvider } from '@/lab-guide/RunnerContext';
import { HintLightbulb } from '@/lab-guide/widgets/HintLightbulb';
import type { Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const phase: Phase = { id: 'p', title: 'P', gate: { type: 'always' } };

// Arms spend mode via a button click so the click happens AFTER HintSpendProvider's
// initial-IDLE effect — mirroring the production sequence where the bucket-click
// is the only way to arm.
function ArmButton({ phaseId }: { phaseId: string }) {
  const { enterSpendMode } = useHintSpend();
  return (
    <button type="button" data-testid="arm" onClick={() => enterSpendMode(phaseId)}>
      arm
    </button>
  );
}

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <RunnerProvider experimentId="lb-test" experimentVersion={1} phases={[phase]}>
      <HintSpendProvider>
        <ArmButton phaseId="p" />
        {children}
      </HintSpendProvider>
    </RunnerProvider>
  );
}

describe('HintLightbulb', () => {
  it('renders nothing while spend mode is idle', () => {
    render(
      <Harness>
        <HintLightbulb variant="normal" nextTier={1} cap={3} onSpend={() => {}} />
      </Harness>,
    );
    // Only the arm button — the lightbulb itself returns null.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByLabelText(/få et hint/i)).not.toBeInTheDocument();
  });

  it('renders and calls onSpend exactly once on double-click while armed', async () => {
    const onSpend = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness>
        <HintLightbulb variant="normal" nextTier={1} cap={3} onSpend={onSpend} />
      </Harness>,
    );
    await user.click(screen.getByTestId('arm'));
    const lightbulb = screen.getByLabelText(/få et hint/i);
    // First click fires onSpend AND exits spend mode → the lightbulb unmounts.
    // A naive second click can't hit it; the behavioural guarantee is at most
    // one tier per arm.
    await user.click(lightbulb);
    expect(onSpend).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText(/få et hint/i)).not.toBeInTheDocument();
  });

  it('reveal variant: disabled state suppresses onSpend', async () => {
    const onSpend = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness>
        <HintLightbulb variant="reveal" cost={2} disabled onSpend={onSpend} />
      </Harness>,
    );
    await user.click(screen.getByTestId('arm'));
    const pill = screen.getByLabelText(/brug 2 hints for at se svaret/i);
    await user.click(pill);
    expect(onSpend).not.toHaveBeenCalled();
  });
});
