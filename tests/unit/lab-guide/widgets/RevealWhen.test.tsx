import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { RevealWhen } from '@/lab-guide/widgets/RevealWhen';
import type { Phase } from '@/lib/schema';
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('RevealWhen — scrollOnReveal', () => {
  // The global tests/setup.ts stubs window.matchMedia (matches:false) and a
  // no-op Element.prototype.scrollIntoView. These tests spy / override locally
  // for call-count and reduced-motion assertions; restoreAllMocks puts the
  // global stubs back.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function Switch({
    experimentId,
    filled,
    scroll,
  }: {
    experimentId: string;
    filled: boolean;
    scroll?: boolean;
  }) {
    return (
      <Harness experimentId={experimentId}>
        <FakeWidget id="variables" filled={filled} />
        <RevealWhen widgetIds={['variables']} scrollOnReveal={scroll}>
          <div data-testid="child">child</div>
        </RevealWhen>
      </Harness>
    );
  }

  it('scrolls and focuses the revealed content on a user-action reveal', () => {
    // The watched widget registers unsatisfied first (present across renders),
    // then flips to satisfied — the genuine user-action path.
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { rerender } = render(<Switch experimentId="rw/scroll-user" filled={false} scroll />);
    expect(scrollSpy).not.toHaveBeenCalled();
    rerender(<Switch experimentId="rw/scroll-user" filled={true} scroll />);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    // Focus lands on the tabIndex=-1 wrapper that holds the children.
    expect(screen.getByTestId('child').parentElement).toHaveFocus();
  });

  it('does NOT scroll on a cold reload (watched widget registers absent→satisfied)', () => {
    // FakeWidget filled=true from the start → the widget goes absent→satisfied
    // in one registration step, exactly the persisted-correct reload path.
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<Switch experimentId="rw/scroll-reload" filled={true} scroll />);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('does NOT scroll on an in-SPA phase remount (registry already populated)', () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    function Tree({ mountReveal }: { mountReveal: boolean }) {
      return (
        <Harness experimentId="rw/scroll-remount">
          <FakeWidget id="variables" filled={true} />
          {mountReveal && (
            <RevealWhen widgetIds={['variables']} scrollOnReveal>
              <div data-testid="child">child</div>
            </RevealWhen>
          )}
        </Harness>
      );
    }
    const { rerender } = render(<Tree mountReveal={true} />);
    expect(scrollSpy).not.toHaveBeenCalled(); // first mount is the reload path
    // Unmount then remount RevealWhen while `variables` stays registered — it
    // is satisfied on the remount's first render, so no transition fires.
    rerender(<Tree mountReveal={false} />);
    rerender(<Tree mountReveal={true} />);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('without scrollOnReveal: no scroll and no tabIndex wrapper', () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { rerender } = render(<Switch experimentId="rw/no-scroll" filled={false} />);
    rerender(<Switch experimentId="rw/no-scroll" filled={true} />);
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[tabindex="-1"]')).toBeNull();
  });

  it('uses smooth scroll by default', () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { rerender } = render(<Switch experimentId="rw/smooth" filled={false} scroll />);
    rerender(<Switch experimentId="rw/smooth" filled={true} scroll />);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('honors prefers-reduced-motion with an instant scroll', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { rerender } = render(<Switch experimentId="rw/reduced" filled={false} scroll />);
    rerender(<Switch experimentId="rw/reduced" filled={true} scroll />);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('scrolls again on each hide→reveal cycle', () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    const id = 'rw/scroll-cycle';
    const { rerender } = render(<Switch experimentId={id} filled={false} scroll />);
    rerender(<Switch experimentId={id} filled={true} scroll />); // reveal 1
    rerender(<Switch experimentId={id} filled={false} scroll />); // hide
    rerender(<Switch experimentId={id} filled={true} scroll />); // reveal 2
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });
});
