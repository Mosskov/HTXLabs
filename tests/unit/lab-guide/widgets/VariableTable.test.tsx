import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied } from '@/lab-guide/gates';
import {
  VariableTable,
  type VariableTableValues,
} from '@/lab-guide/widgets/VariableTable';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

const gate: Gate = { type: 'all-filled', widgetIds: ['variables'] };
const phase: Phase = { id: 'p', title: 'P', gate };

function GateProbe() {
  const { state, gateCtx } = useRunner();
  const passed = isGateSatisfied(gate, state, undefined, gateCtx, phase.id);
  return <div data-testid="gate">{passed ? 'pass' : 'fail'}</div>;
}

function ValuesProbe() {
  const { gateCtx } = useRunner();
  const w = gateCtx.widgets['variables'];
  const values = w?.kind === 'filled' ? (w.values as VariableTableValues | undefined) : undefined;
  return <div data-testid="values">{JSON.stringify(values?.iv ?? null)}</div>;
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
      <GateProbe />
      <ValuesProbe />
    </RunnerProvider>
  );
}

describe('VariableTable', () => {
  it('renders IV, DV, and Konstanter section headers', () => {
    render(
      <Harness experimentId="vt/1">
        <VariableTable id="variables" />
      </Harness>,
    );
    expect(screen.getByText('Uafhængig variabel')).toBeInTheDocument();
    expect(screen.getByText('Afhængig variabel')).toBeInTheDocument();
    expect(screen.getByText('Konstanter')).toBeInTheDocument();
  });

  it('reports filled=false on mount with empty cells', () => {
    render(
      <Harness experimentId="vt/2">
        <VariableTable id="variables" />
      </Harness>,
    );
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('flips to filled=true once IV and DV name+symbol are filled (units optional)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/3">
        <VariableTable id="variables" />
      </Harness>,
    );
    // Fill IV name + symbol; leave unit empty.
    const ivName = document.getElementById('variables-iv-name') as HTMLInputElement;
    const ivSym = document.getElementById('variables-iv-symbol') as HTMLInputElement;
    const dvName = document.getElementById('variables-dv-name') as HTMLInputElement;
    const dvSym = document.getElementById('variables-dv-symbol') as HTMLInputElement;
    await user.type(ivName, 'kraft');
    await user.type(ivSym, 'F');
    await user.type(dvName, 'acceleration');
    await user.type(dvSym, 'a');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('does NOT flip to filled when only IV is filled', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/4">
        <VariableTable id="variables" />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv-symbol') as HTMLInputElement, 'F');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('publishes the entered IV symbol on the values facet', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/5">
        <VariableTable id="variables" />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv-symbol') as HTMLInputElement, 'F');
    await user.type(document.getElementById('variables-iv-unit') as HTMLInputElement, 'N');
    expect(screen.getByTestId('values')).toHaveTextContent('"symbol":"F"');
    expect(screen.getByTestId('values')).toHaveTextContent('"unit":"N"');
  });

  it('with requireUnits=true, blocks filled until the unit cells are filled', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/6">
        <VariableTable id="variables" requireUnits />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv-symbol') as HTMLInputElement, 'F');
    await user.type(document.getElementById('variables-dv-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-dv-symbol') as HTMLInputElement, 'a');
    // Units still empty.
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    await user.type(document.getElementById('variables-iv-unit') as HTMLInputElement, 'N');
    await user.type(document.getElementById('variables-dv-unit') as HTMLInputElement, 'm/s²');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('flips back to filled=false when an IV cell is cleared', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/7">
        <VariableTable id="variables" />
      </Harness>,
    );
    const ivSym = document.getElementById('variables-iv-symbol') as HTMLInputElement;
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(ivSym, 'F');
    await user.type(document.getElementById('variables-dv-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-dv-symbol') as HTMLInputElement, 'a');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
    await user.clear(ivSym);
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('adds and removes constants without disturbing IV/DV satisfaction', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/8">
        <VariableTable id="variables" />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv-symbol') as HTMLInputElement, 'F');
    await user.type(document.getElementById('variables-dv-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-dv-symbol') as HTMLInputElement, 'a');

    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    expect(document.getElementById('variables-c0-name')).not.toBeNull();
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');

    await user.click(screen.getByRole('button', { name: /fjern konstant/i }));
    expect(document.getElementById('variables-c0-name')).toBeNull();
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });
});
