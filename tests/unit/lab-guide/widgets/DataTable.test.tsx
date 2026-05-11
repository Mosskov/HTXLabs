import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied } from '@/lab-guide/gates';
import * as Mod from '@/lab-guide/widgets/DataTable';
import { DataTable } from '@/lab-guide/widgets/DataTable';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

const phase: Phase = {
  id: 'p',
  title: 'P',
  gate: { type: 'all-filled', widgetIds: ['m'] },
};
const gate: Gate = phase.gate;

const columns = [
  { label: 'masse', symbol: 'm', unit: 'kg' },
  { label: 'kraft', symbol: 'F', unit: 'N' },
];

function GateProbe() {
  const { state, gateCtx } = useRunner();
  const passed = isGateSatisfied(gate, state, undefined, gateCtx, 'p');
  return <div data-testid="gate">{passed ? 'pass' : 'fail'}</div>;
}

function Harness({ experimentId, children }: { experimentId: string; children: React.ReactNode }) {
  return (
    <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[phase]}>
      {children}
      <GateProbe />
    </RunnerProvider>
  );
}

describe('DataTable', () => {
  it('exports the component', () => {
    expect(Mod.DataTable).toBeDefined();
    expect(typeof Mod.DataTable).toBe('function');
  });

  it('renders the default caption and N empty rows with column headers', () => {
    render(
      <Harness experimentId="dt/render">
        <DataTable id="m" columns={columns} rows={3} minRows={2} />
      </Harness>,
    );
    expect(screen.getByText('Målinger:')).toBeInTheDocument();
    expect(screen.getByText('masse')).toBeInTheDocument();
    expect(screen.getByText('kraft')).toBeInTheDocument();
    // 3 rows × 2 columns = 6 cell inputs.
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('blocks non-numeric keystrokes', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="dt/numeric">
        <DataTable id="m" columns={columns} rows={2} minRows={1} />
      </Harness>,
    );
    const cell = screen.getByLabelText('masse række 1') as HTMLInputElement;
    await user.type(cell, 'a1b,5c');
    expect(cell.value).toBe('1,5');
  });

  it('satisfies the gate once minRows rows have every column filled with valid numbers', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="dt/gate">
        <DataTable id="m" columns={columns} rows={3} minRows={2} />
      </Harness>,
    );
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');

    // Fill row 1 fully — still 1/2.
    await user.type(screen.getByLabelText('masse række 1'), '0,1');
    await user.type(screen.getByLabelText('kraft række 1'), '1,0');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');

    // Fill row 2 partially — still 1/2.
    await user.type(screen.getByLabelText('masse række 2'), '0,2');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');

    // Complete row 2 — 2/2, gate passes.
    await user.type(screen.getByLabelText('kraft række 2'), '2,0');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('appends a row when "Tilføj række" is clicked, preserving existing data', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="dt/add">
        <DataTable id="m" columns={columns} rows={2} minRows={1} />
      </Harness>,
    );
    await user.type(screen.getByLabelText('masse række 1'), '0,5');
    await user.click(screen.getByRole('button', { name: /tilføj række/i }));

    // Now 3 rows × 2 columns = 6 inputs.
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    expect((screen.getByLabelText('masse række 1') as HTMLInputElement).value).toBe('0,5');
    expect((screen.getByLabelText('masse række 3') as HTMLInputElement).value).toBe('');
  });

  it('deletes the targeted row when above the initial-rows floor', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="dt/delete">
        <DataTable id="m" columns={columns} rows={2} minRows={1} />
      </Harness>,
    );
    await user.type(screen.getByLabelText('masse række 1'), '0,1');
    await user.type(screen.getByLabelText('kraft række 1'), '1,0');

    // Add a 3rd row (above floor of 2) and put data in it.
    await user.click(screen.getByRole('button', { name: /tilføj række/i }));
    await user.type(screen.getByLabelText('masse række 3'), '0,3');

    // Now 3 rows; deletion of row 1 should be allowed. Row 2's empty data
    // shifts up; row 3's data shifts to row 2. Total drops to 2 (the floor).
    const deleteButtons = screen.getAllByRole('button', { name: /slet række/i });
    await user.click(deleteButtons[0]);

    expect(screen.getAllByRole('textbox')).toHaveLength(4); // 2 rows × 2 cols
    expect((screen.getByLabelText('masse række 1') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('masse række 2') as HTMLInputElement).value).toBe('0,3');
  });

  it('disables × at the initial-rows floor', () => {
    render(
      <Harness experimentId="dt/floor">
        <DataTable id="m" columns={columns} rows={3} minRows={1} />
      </Harness>,
    );
    const deleteButtons = screen.getAllByRole('button', { name: /slet række/i });
    expect(deleteButtons).toHaveLength(3);
    for (const btn of deleteButtons) {
      expect(btn).toBeDisabled();
    }
  });

  it('rehydrates persisted rows from localStorage on remount', () => {
    const seeded = {
      experimentId: 'dt/persist',
      experimentVersion: 1,
      mode: 'guided',
      labMode: 'virtual',
      currentPhaseId: 'p',
      visitedPhaseIds: ['p'],
      firedMilestones: {},
      dataPointCount: {},
      widgetValues: {},
      dataTables: {
        m: [
          { masse: '0,1', kraft: '1,0' },
          { masse: '0,2', kraft: '2,0' },
        ],
      },
      attemptCounts: {},
    };
    localStorage.setItem('htxlabs:state:dt/persist', JSON.stringify(seeded));

    render(
      <Harness experimentId="dt/persist">
        <DataTable id="m" columns={columns} rows={3} minRows={2} />
      </Harness>,
    );
    expect((screen.getByLabelText('masse række 1') as HTMLInputElement).value).toBe('0,1');
    expect((screen.getByLabelText('kraft række 2') as HTMLInputElement).value).toBe('2,0');
    // Seeded data has 2 fully-filled rows ≥ minRows=2 → gate passes immediately.
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });
});
