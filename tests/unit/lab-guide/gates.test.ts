import {
  canAdvanceTo,
  type GateCtx,
  gateMessage,
  isGateSatisfied,
  type WidgetState,
} from '@/lab-guide/gates';
import type { RunnerState } from '@/lab-guide/runner';
import type { Gate, Phase } from '@/lib/schema';
// @vitest-environment node
import { describe, expect, it } from 'vitest';

function makeState(overrides: Partial<RunnerState> = {}): RunnerState {
  return {
    experimentId: 'hej-verden',
    experimentVersion: 2,
    mode: 'guided',
    labMode: 'virtual',
    currentPhaseId: 'planlaeg',
    visitedPhaseIds: new Set(['planlaeg']),
    firedMilestones: new Set(),
    dataPointCount: 0,
    widgetValues: {},
    dataTables: {},
    attemptCounts: {},
    ...overrides,
  };
}

function makeCtx(widgets: Record<string, WidgetState> = {}): GateCtx {
  return {
    widgets,
    simulationStateRef: { current: null },
  };
}

const allFilledGate: Gate = { type: 'all-filled', widgetIds: ['hypotese', 'detail'] };
const alwaysGate: Gate = { type: 'always' };

// Mirror of hej-verden's three phases — used by canAdvanceTo tests.
const phases: Phase[] = [
  { id: 'planlaeg', title: 'Planlæg', gate: { type: 'all-filled', widgetIds: ['hypotese-test'] } },
  { id: 'opstil', title: 'Opstil', gate: alwaysGate },
  {
    id: 'konkluder',
    title: 'Konkludér',
    gate: { type: 'all-filled', widgetIds: ['konklusion-test'] },
  },
];

const filledHypotese = makeCtx({ 'hypotese-test': { kind: 'filled', filled: true } });

describe('always gate', () => {
  it('isGateSatisfied returns true regardless of state', () => {
    expect(isGateSatisfied(alwaysGate, makeState(), undefined, makeCtx())).toBe(true);
  });

  it('gateMessage returns empty string', () => {
    expect(gateMessage(alwaysGate)).toBe('');
  });

  it('open mode also satisfies', () => {
    expect(isGateSatisfied(alwaysGate, makeState({ mode: 'open' }), undefined, makeCtx())).toBe(
      true,
    );
  });
});

describe('all-filled gate', () => {
  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(allFilledGate, makeState(), undefined, makeCtx())).toBe(false);
  });

  it('returns false when at least one listed widget reports filled=false', () => {
    const ctx = makeCtx({
      hypotese: { kind: 'filled', filled: true },
      detail: { kind: 'filled', filled: false },
    });
    expect(isGateSatisfied(allFilledGate, makeState(), undefined, ctx)).toBe(false);
  });

  it('returns true when every listed widget reports filled=true', () => {
    const ctx = makeCtx({
      hypotese: { kind: 'filled', filled: true },
      detail: { kind: 'filled', filled: true },
    });
    expect(isGateSatisfied(allFilledGate, makeState(), undefined, ctx)).toBe(true);
  });

  it('returns false when a listed widget reports the wrong kind', () => {
    const ctx = makeCtx({
      hypotese: { kind: 'correct', correct: true },
      detail: { kind: 'filled', filled: true },
    });
    expect(isGateSatisfied(allFilledGate, makeState(), undefined, ctx)).toBe(false);
  });

  it('gateMessage returns the canonical Danish prompt', () => {
    expect(gateMessage(allFilledGate)).toBe('Besvar alle spørgsmål for at fortsætte.');
  });

  it('open mode bypasses even with no widgets registered', () => {
    expect(isGateSatisfied(allFilledGate, makeState({ mode: 'open' }), undefined, makeCtx())).toBe(
      true,
    );
  });
});

describe('data-points gate', () => {
  const dataPointsGate: Gate = { type: 'data-points', min: 4 };

  it('returns false when the runner counter is below the minimum', () => {
    const state = makeState({ dataPointCount: 3 });
    expect(isGateSatisfied(dataPointsGate, state, undefined, makeCtx())).toBe(false);
  });

  it('returns true when the runner counter meets the minimum', () => {
    const state = makeState({ dataPointCount: 4 });
    expect(isGateSatisfied(dataPointsGate, state, undefined, makeCtx())).toBe(true);
  });

  it('open mode bypasses the count requirement', () => {
    const state = makeState({ mode: 'open', dataPointCount: 0 });
    expect(isGateSatisfied(dataPointsGate, state, undefined, makeCtx())).toBe(true);
  });
});

describe('canAdvanceTo', () => {
  it('current phase is reachable from itself', () => {
    expect(canAdvanceTo('planlaeg', phases, makeState(), undefined, makeCtx())).toBe(true);
  });

  it('any earlier phase is reachable regardless of widget state', () => {
    const state = makeState({
      currentPhaseId: 'konkluder',
      visitedPhaseIds: new Set(['planlaeg', 'opstil', 'konkluder']),
    });
    // No widgets registered — backward navigation must not depend on gates.
    expect(canAdvanceTo('planlaeg', phases, state, undefined, makeCtx())).toBe(true);
    expect(canAdvanceTo('opstil', phases, state, undefined, makeCtx())).toBe(true);
  });

  it('forward by one to an unvisited phase requires the current gate to pass', () => {
    expect(canAdvanceTo('opstil', phases, makeState(), undefined, makeCtx())).toBe(false);
    expect(canAdvanceTo('opstil', phases, makeState(), undefined, filledHypotese)).toBe(true);
  });

  it('blocks leap-frogging past an unvisited intermediate phase', () => {
    // planlaeg gate satisfied, opstil is `always`, konkluder unvisited — but
    // the student has not yet visited opstil, so cannot jump straight to konkluder.
    expect(canAdvanceTo('konkluder', phases, makeState(), undefined, filledHypotese)).toBe(false);
  });

  it('forward to a visited future phase is allowed when the current gate passes', () => {
    const state = makeState({
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: new Set(['planlaeg', 'opstil', 'konkluder']),
    });
    // Student has visited up to konkluder, returned to planlaeg, answer still filled.
    expect(canAdvanceTo('opstil', phases, state, undefined, filledHypotese)).toBe(true);
    expect(canAdvanceTo('konkluder', phases, state, undefined, filledHypotese)).toBe(true);
  });

  it('forward to a visited future phase re-locks if the current gate fails', () => {
    // Same scenario as above, but the student emptied the answer in planlaeg.
    const state = makeState({
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: new Set(['planlaeg', 'opstil', 'konkluder']),
    });
    expect(canAdvanceTo('opstil', phases, state, undefined, makeCtx())).toBe(false);
    expect(canAdvanceTo('konkluder', phases, state, undefined, makeCtx())).toBe(false);
  });

  it('open mode bypasses the gate for forward navigation', () => {
    const state = makeState({ mode: 'open' });
    expect(canAdvanceTo('opstil', phases, state, undefined, makeCtx())).toBe(true);
  });

  it('returns false for an unknown phase id', () => {
    expect(canAdvanceTo('not-a-phase', phases, makeState(), undefined, makeCtx())).toBe(false);
  });
});
