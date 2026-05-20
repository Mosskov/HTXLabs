// useRegisteredWidgetCheck: register/unregister a widget check in the runner.
import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { useRegisteredWidgetCheck } from '@/lab-guide/useRegisteredWidgetCheck';
import type { WidgetCheck } from '@/lab-guide/widgetCheck';
import type { Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';

const phase: Phase = { id: 'p', title: 'P', gate: { type: 'always' } };

/** Probe widget: registers a stable check object under `id`. */
function Probe({ id, enabled, revision }: { id: string; enabled: boolean; revision: number }) {
  const checkRef = useRef<WidgetCheck>({
    label: 'L',
    run: () => {},
    disabled: false,
    pending: false,
  });
  useRegisteredWidgetCheck(id, enabled, checkRef, revision);
  return null;
}

/** Consumer: reads the runner's `widgetChecks` registry. */
function Registry() {
  const { widgetChecks } = useRunner();
  const keys = Object.keys(widgetChecks).sort().join(',');
  return (
    <>
      <div data-testid="keys">{keys}</div>
      <div data-testid="w-label">{widgetChecks.w?.label ?? '(none)'}</div>
    </>
  );
}

function Harness({
  experimentId,
  mounted,
  enabled,
  revision,
}: {
  experimentId: string;
  mounted: boolean;
  enabled: boolean;
  revision: number;
}) {
  return (
    <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[phase]}>
      {mounted && <Probe id="w" enabled={enabled} revision={revision} />}
      <Registry />
    </RunnerProvider>
  );
}

describe('useRegisteredWidgetCheck', () => {
  it('registers the check on mount when enabled', () => {
    render(<Harness experimentId="wc/1" mounted enabled revision={0} />);
    expect(screen.getByTestId('keys')).toHaveTextContent('w');
    expect(screen.getByTestId('w-label')).toHaveTextContent('L');
  });

  it('does not register when enabled is false', () => {
    render(<Harness experimentId="wc/2" mounted enabled={false} revision={0} />);
    expect(screen.getByTestId('keys')).toHaveTextContent('');
    expect(screen.getByTestId('w-label')).toHaveTextContent('(none)');
  });

  it('unregisters the check on unmount', () => {
    const { rerender } = render(
      <Harness experimentId="wc/3" mounted enabled revision={0} />,
    );
    expect(screen.getByTestId('keys')).toHaveTextContent('w');
    // Unmount the probe — the deliberate unmount cleanup must drop the entry.
    rerender(<Harness experimentId="wc/3" mounted={false} enabled revision={0} />);
    expect(screen.getByTestId('keys')).toHaveTextContent('');
  });

  it('keeps the check registered across a revision bump (idempotent re-fire)', () => {
    const { rerender } = render(
      <Harness experimentId="wc/4" mounted enabled revision={0} />,
    );
    expect(screen.getByTestId('keys')).toHaveTextContent('w');
    rerender(<Harness experimentId="wc/4" mounted enabled revision={1} />);
    expect(screen.getByTestId('keys')).toHaveTextContent('w');
  });
});
