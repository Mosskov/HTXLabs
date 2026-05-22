// Tests for InstructionBox: legacy string-step rendering vs the object-step
// checklist tracker, and per-step done/active/locked projection from the widget
// registry.
import { InstructionBox } from '@/lab-guide/InstructionBox';
import { RunnerProvider } from '@/lab-guide/RunnerContext';
import type { WidgetState } from '@/lab-guide/gates';
import { strings } from '@/lab-guide/strings.da';
import { useRegisteredWidgetState } from '@/lab-guide/useRegisteredWidgetState';
import type { Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/** Registers a widget state into the runner registry so InstructionBox can
 *  read it — stands in for the real widgets. */
function RegisterWidget({ id, state }: { id: string; state: WidgetState }) {
  useRegisteredWidgetState(id, state, [JSON.stringify(state)]);
  return null;
}

function Harness({
  phase,
  children,
}: {
  phase: Phase;
  children?: React.ReactNode;
}) {
  return (
    <RunnerProvider experimentId="ib/test" experimentVersion={1} phases={[phase]}>
      {children}
      <InstructionBox phase={phase} phaseNumber={1} />
    </RunnerProvider>
  );
}

const trackedPhase: Phase = {
  id: 'planlaeg',
  title: 'Planlæg',
  gate: { type: 'always' },
  steps: [
    { text: 'IV-linje', widgetId: 'variables', section: 'iv' },
    { text: 'DV-linje', widgetId: 'variables', section: 'dv' },
    { text: 'Konstant-linje', widgetId: 'variables', section: 'constants' },
    { text: 'Hypotese-linje', widgetId: 'hypotese' },
  ],
};

describe('InstructionBox — object-step checklist tracker', () => {
  it('renders the auto "Fase N – title:" header', () => {
    render(<Harness phase={trackedPhase} />);
    expect(screen.getByText('Fase 1 – Planlæg:')).toBeInTheDocument();
  });

  it('section steps reflect the parent table sections facet (done vs active)', () => {
    const variables: WidgetState = {
      kind: 'filled',
      filled: false,
      sections: { iv: true, dv: false, constants: false },
    };
    render(
      <Harness phase={trackedPhase}>
        <RegisterWidget id="variables" state={variables} />
      </Harness>,
    );
    const items = screen.getAllByRole('listitem');
    // IV satisfied → done (✓ + "fuldført" suffix).
    expect(items[0].textContent).toContain('✓');
    expect(items[0].textContent).toContain('fuldført');
    // DV / constants not satisfied → active (no ✓, no suffix).
    expect(items[1].textContent).not.toContain('✓');
    expect(items[1].textContent).not.toContain('fuldført');
    expect(items[2].textContent).not.toContain('✓');
  });

  it('section steps are never locked — even when the table is absent', () => {
    render(<Harness phase={trackedPhase} />);
    const items = screen.getAllByRole('listitem');
    // No `variables` registered, yet the three section lines stay active.
    expect(items[0].textContent).not.toContain('låst');
    expect(items[1].textContent).not.toContain('låst');
    expect(items[2].textContent).not.toContain('låst');
  });

  it('a whole-widget step is locked while its widget is absent', () => {
    render(<Harness phase={trackedPhase} />);
    // `hypotese` not registered → the hypothesis line is locked.
    const hypotese = screen.getAllByRole('listitem')[3];
    expect(hypotese.textContent).toContain('låst');
    expect(hypotese.textContent).not.toContain('✓');
  });

  it('a whole-widget step is done once its widget is strict-satisfied', () => {
    render(
      <Harness phase={trackedPhase}>
        <RegisterWidget id="hypotese" state={{ kind: 'rubric', satisfied: true }} />
      </Harness>,
    );
    const hypotese = screen.getAllByRole('listitem')[3];
    expect(hypotese.textContent).toContain('✓');
    expect(hypotese.textContent).toContain('fuldført');
  });

  it('a whole-widget step is active when present but unsatisfied', () => {
    render(
      <Harness phase={trackedPhase}>
        <RegisterWidget id="hypotese" state={{ kind: 'rubric', satisfied: false }} />
      </Harness>,
    );
    const hypotese = screen.getAllByRole('listitem')[3];
    expect(hypotese.textContent).not.toContain('✓');
    expect(hypotese.textContent).not.toContain('låst');
  });

  it('a presence-only filled widget (no `correct` facet) reads done once filled', () => {
    // FreeTextResponse / DataTable register `kind:'filled'` without `correct` —
    // a strict projection would leave such a step active forever.
    render(
      <Harness phase={trackedPhase}>
        <RegisterWidget id="hypotese" state={{ kind: 'filled', filled: true }} />
      </Harness>,
    );
    const hypotese = screen.getAllByRole('listitem')[3];
    expect(hypotese.textContent).toContain('✓');
    expect(hypotese.textContent).toContain('fuldført');
  });

  it('a filled widget that publishes `correct:false` stays active (not done)', () => {
    render(
      <Harness phase={trackedPhase}>
        <RegisterWidget id="hypotese" state={{ kind: 'filled', filled: true, correct: false }} />
      </Harness>,
    );
    const hypotese = screen.getAllByRole('listitem')[3];
    expect(hypotese.textContent).not.toContain('✓');
    expect(hypotese.textContent).not.toContain('låst');
  });
});

describe('InstructionBox — locked-step tooltip', () => {
  const phaseWithLockedHint: Phase = {
    id: 'planlaeg',
    title: 'Planlæg',
    gate: { type: 'always' },
    steps: [{ text: 'Hypotese-linje', widgetId: 'hypotese', lockedHint: 'Egen forklaring.' }],
  };

  it('a locked step shows the generic stepLockedHint when none is authored', () => {
    // trackedPhase: only the hypothesis line (widgetId hypotese, absent) locks.
    render(<Harness phase={trackedPhase} />);
    expect(screen.getByRole('tooltip')).toHaveTextContent(strings.instructionBox.stepLockedHint);
  });

  it('a locked step shows the authored lockedHint when provided', () => {
    render(<Harness phase={phaseWithLockedHint} />);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Egen forklaring.');
  });

  it('done and active steps render no tooltip and no focusable trigger', () => {
    // hypotese satisfied → step 4 done; the 3 section steps are active. No step
    // is locked, so no tooltip and no tabindex'd trigger exist.
    const { container } = render(
      <Harness phase={trackedPhase}>
        <RegisterWidget id="hypotese" state={{ kind: 'rubric', satisfied: true }} />
      </Harness>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(container.querySelector('[tabindex]')).toBeNull();
  });
});

describe('InstructionBox — legacy rendering', () => {
  it('a string-only multi-step phase renders the lettered <ol>', () => {
    const phase: Phase = {
      id: 'opstil',
      title: 'Opstil',
      gate: { type: 'always' },
      steps: ['Første trin.', 'Andet trin.'],
    };
    const { container } = render(<Harness phase={phase} />);
    expect(container.querySelector('ol')).not.toBeNull();
    expect(container.querySelector('ul')).toBeNull();
    expect(screen.getByText('Første trin.')).toBeInTheDocument();
  });

  it('a single string step renders a plain paragraph (no list)', () => {
    const phase: Phase = {
      id: 'maal',
      title: 'Mål',
      gate: { type: 'always' },
      steps: ['Kun ét trin.'],
    };
    render(<Harness phase={phase} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('Kun ét trin.')).toBeInTheDocument();
  });

  it('an intro phase renders the sentence with no header', () => {
    const phase: Phase = {
      id: 'maal',
      title: 'Mål',
      gate: { type: 'always' },
      intro: 'En enkelt sætning.',
    };
    render(<Harness phase={phase} />);
    expect(screen.getByText('En enkelt sætning.')).toBeInTheDocument();
    expect(screen.queryByText(/Fase 1/)).not.toBeInTheDocument();
  });
});
