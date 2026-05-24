import { emptyState, load, save } from '@/lab-guide/runner';
import type { Phase } from '@/lib/schema';
import { afterEach, describe, expect, it } from 'vitest';

const phases: Phase[] = [{ id: 'planlaeg', title: 'Planlæg' }];

afterEach(() => {
  localStorage.clear();
});

describe('runner save/load', () => {
  it('round-trips simulationState through localStorage', () => {
    const s = emptyState('t/sim', 1, phases);
    const payload = { measurements: [{ x: 3, y: 5 }], reviewed: true };
    save({ ...s, simulationState: payload });
    const loaded = load('t/sim');
    expect(loaded?.simulationState).toEqual(payload);
  });

  it('defaults simulationState to null when absent on legacy saves', () => {
    // Pre-feature save: serialized blob with no `simulationState` key.
    const legacy = {
      experimentId: 't/legacy',
      experimentVersion: 1,
      mode: 'guided',
      labMode: 'virtual',
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: ['planlaeg'],
      firedMilestones: {},
      dataPointCount: {},
      widgetValues: {},
      dataTables: {},
      attemptCounts: {},
    };
    localStorage.setItem('htxlabs:state:t/legacy', JSON.stringify(legacy));
    const loaded = load('t/legacy');
    expect(loaded?.simulationState).toBeNull();
  });

  it('emptyState seeds simulationState to null', () => {
    expect(emptyState('t/fresh', 1, phases).simulationState).toBeNull();
  });

  it('round-trips rubricHintTiers through localStorage', () => {
    const s = emptyState('t/tiers', 1, phases);
    const tiers = { hypothesis: { iv: 2, dv: 1 } };
    save({ ...s, rubricHintTiers: tiers });
    const loaded = load('t/tiers');
    expect(loaded?.rubricHintTiers).toEqual(tiers);
  });

  it('defaults rubricHintTiers to {} on legacy saves', () => {
    const legacy = {
      experimentId: 't/legacy-tiers',
      experimentVersion: 1,
      mode: 'guided',
      labMode: 'virtual',
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: ['planlaeg'],
      firedMilestones: {},
      dataPointCount: {},
      widgetValues: {},
      dataTables: {},
      attemptCounts: {},
      simulationState: null,
    };
    localStorage.setItem('htxlabs:state:t/legacy-tiers', JSON.stringify(legacy));
    const loaded = load('t/legacy-tiers');
    expect(loaded?.rubricHintTiers).toEqual({});
  });

  it('emptyState seeds rubricHintTiers to {}', () => {
    expect(emptyState('t/fresh-tiers', 1, phases).rubricHintTiers).toEqual({});
  });

  it('emptyState seeds variableTableLocks to {}', () => {
    expect(emptyState('t/fresh-locks', 1, phases).variableTableLocks).toEqual({});
  });

  it('round-trips variableTableLocks through localStorage', () => {
    const s = emptyState('t/locks', 1, phases);
    const locks = { variables: { 'iv.0.symbol': true as const, 'dv.0.symbol': true as const } };
    save({ ...s, variableTableLocks: locks });
    const loaded = load('t/locks');
    expect(loaded?.variableTableLocks).toEqual(locks);
  });

  it('defaults variableTableLocks to {} on legacy saves with no key', () => {
    const legacy = {
      experimentId: 't/legacy-locks',
      experimentVersion: 1,
      mode: 'guided',
      labMode: 'virtual',
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: ['planlaeg'],
      firedMilestones: {},
      dataPointCount: {},
      widgetValues: {},
      dataTables: {},
      attemptCounts: {},
      simulationState: null,
      rubricHintTiers: {},
      variableTableHintTiers: {},
      variableTableLastChecked: {},
    };
    localStorage.setItem('htxlabs:state:t/legacy-locks', JSON.stringify(legacy));
    const loaded = load('t/legacy-locks');
    expect(loaded?.variableTableLocks).toEqual({});
  });
});
