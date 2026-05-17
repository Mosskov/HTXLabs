import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { RevealWhen } from '@/lab-guide/widgets/RevealWhen';
import type { Phase } from '@/lib/schema';
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

const phase: Phase = { id: 'p', title: 'P', gate: { type: 'always' } };

/** Test-only widget that registers a `filled` state via the runner API.
 *  Lets each test stage widget state without rendering a real widget. */
function FakeWidget({ id, filled }: { id: string; filled: boolean }) {
  const { registerWidgetState } = useRunner();
  useEffect(() => {
    registerWidgetState(id, { kind: 'filled', filled });
  }, [id, filled, registerWidgetState]);
  return null;
}

function Registry({ id }: { id: string }) {
  const { gateCtx } = useRunner();
  const w = gateCtx.widgets[id];
  return <div data-testid={`reg-${id}`}>{w ? 'present' : 'absent'}</div>;
}

function Harness({
  experimentId,
  children,
}: {
  experimentId: string;
  children: React.ReactNode;
}) {
  return (
    <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[phase]}>
      {children}
    </RunnerProvider>
  );
}

describe('RevealWhen', () => {
  it('hides children when the watched widget is absent', () => {
    render(
      <Harness experimentId="rw/1">
        <RevealWhen widgetIds={['variables']}>
          <div data-testid="child">child</div>
        </RevealWhen>
      </Harness>,
    );
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('hides children when the watched widget reports filled=false', () => {
    render(
      <Harness experimentId="rw/2">
        <FakeWidget id="variables" filled={false} />
        <RevealWhen widgetIds={['variables']}>
          <div data-testid="child">child</div>
        </RevealWhen>
      </Harness>,
    );
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('reveals children when the watched widget reports filled=true', () => {
    render(
      <Harness experimentId="rw/3">
        <FakeWidget id="variables" filled={true} />
        <RevealWhen widgetIds={['variables']}>
          <div data-testid="child">child</div>
        </RevealWhen>
      </Harness>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('re-hides when the watched widget flips back to unsatisfied', () => {
    function Switch({ filled }: { filled: boolean }) {
      return (
        <Harness experimentId="rw/4">
          <FakeWidget id="variables" filled={filled} />
          <RevealWhen widgetIds={['variables']}>
            <div data-testid="child">child</div>
          </RevealWhen>
        </Harness>
      );
    }
    const { rerender } = render(<Switch filled={true} />);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    rerender(<Switch filled={false} />);
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('requires ALL listed widgets to be satisfied (multi-id AND)', () => {
    render(
      <Harness experimentId="rw/5">
        <FakeWidget id="a" filled={true} />
        <FakeWidget id="b" filled={false} />
        <RevealWhen widgetIds={['a', 'b']}>
          <div data-testid="child">child</div>
        </RevealWhen>
      </Harness>,
    );
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('clearOnHide removes the listed widget ids from the registry on the visible→hidden edge', () => {
    function Setup({ filled }: { filled: boolean }) {
      const { registerWidgetState } = useRunner();
      useEffect(() => {
        // Stage a dependent widget that previously published satisfied:true.
        registerWidgetState('dependent', { kind: 'rubric', satisfied: true });
      }, [registerWidgetState]);
      return (
        <>
          <FakeWidget id="variables" filled={filled} />
          <RevealWhen widgetIds={['variables']} clearOnHide={['dependent']}>
            <div data-testid="child">child</div>
          </RevealWhen>
          <Registry id="dependent" />
        </>
      );
    }

    function Wrapper({ filled }: { filled: boolean }) {
      return (
        <Harness experimentId="rw/6">
          <Setup filled={filled} />
        </Harness>
      );
    }

    const { rerender } = render(<Wrapper filled={true} />);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('reg-dependent')).toHaveTextContent('present');

    // Flip variables to unsatisfied → reveal hides → dependent must be cleared.
    act(() => {
      rerender(<Wrapper filled={false} />);
    });
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.getByTestId('reg-dependent')).toHaveTextContent('absent');
  });

  it('does not clear dependents when starting hidden (no false transition)', () => {
    function Setup() {
      const { registerWidgetState } = useRunner();
      useEffect(() => {
        registerWidgetState('dependent', { kind: 'rubric', satisfied: true });
      }, [registerWidgetState]);
      return (
        <>
          <FakeWidget id="variables" filled={false} />
          <RevealWhen widgetIds={['variables']} clearOnHide={['dependent']}>
            <div data-testid="child">child</div>
          </RevealWhen>
          <Registry id="dependent" />
        </>
      );
    }
    render(
      <Harness experimentId="rw/7">
        <Setup />
      </Harness>,
    );
    // First render starts hidden — clearOnHide must not fire because there was
    // no visible→hidden transition.
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.getByTestId('reg-dependent')).toHaveTextContent('present');
  });

  it('projection stays presence-only for kind:filled — correct:false does not hide', () => {
    // RevealWhen now imports widgetSatisfied from gates.ts. This test guards
    // against a future accidental projection change (e.g., projecting
    // correct ?? filled for 'filled' kind): a widget that publishes
    // filled:true but correct:false must STILL reveal its children, because
    // RevealWhen mirrors the all-satisfied gate's presence-only contract.
    function FakeWidgetWithCorrect({ id }: { id: string }) {
      const { registerWidgetState } = useRunner();
      useEffect(() => {
        registerWidgetState(id, { kind: 'filled', filled: true, correct: false });
      }, [id, registerWidgetState]);
      return null;
    }
    render(
      <Harness experimentId="rw/8">
        <FakeWidgetWithCorrect id="variables" />
        <RevealWhen widgetIds={['variables']}>
          <div data-testid="child">child</div>
        </RevealWhen>
      </Harness>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('strict mode: does NOT reveal when filled:true but correct:false', () => {
    function FakeWidgetWithCorrect({ id, correct }: { id: string; correct: boolean }) {
      const { registerWidgetState } = useRunner();
      useEffect(() => {
        registerWidgetState(id, { kind: 'filled', filled: true, correct });
      }, [id, correct, registerWidgetState]);
      return null;
    }
    render(
      <Harness experimentId="rw/9">
        <FakeWidgetWithCorrect id="variables" correct={false} />
        <RevealWhen widgetIds={['variables']} strict>
          <div data-testid="child">child</div>
        </RevealWhen>
      </Harness>,
    );
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('strict mode: reveals when filled:true AND correct:true', () => {
    function FakeWidgetWithCorrect({ id }: { id: string }) {
      const { registerWidgetState } = useRunner();
      useEffect(() => {
        registerWidgetState(id, { kind: 'filled', filled: true, correct: true });
      }, [id, registerWidgetState]);
      return null;
    }
    render(
      <Harness experimentId="rw/10">
        <FakeWidgetWithCorrect id="variables" />
        <RevealWhen widgetIds={['variables']} strict>
          <div data-testid="child">child</div>
        </RevealWhen>
      </Harness>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('strict mode: fails when correct is undefined (no expected configured)', () => {
    function FakeWidgetWithoutCorrect({ id }: { id: string }) {
      const { registerWidgetState } = useRunner();
      useEffect(() => {
        registerWidgetState(id, { kind: 'filled', filled: true });
      }, [id, registerWidgetState]);
      return null;
    }
    render(
      <Harness experimentId="rw/11">
        <FakeWidgetWithoutCorrect id="variables" />
        <RevealWhen widgetIds={['variables']} strict>
          <div data-testid="child">child</div>
        </RevealWhen>
      </Harness>,
    );
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });
});
