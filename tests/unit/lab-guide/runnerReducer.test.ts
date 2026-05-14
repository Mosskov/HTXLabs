import type { RunnerState } from '@/lab-guide/runner';
import { type RunnerAction, runnerReducer } from '@/lab-guide/runnerReducer';
// @vitest-environment node
import { describe, expect, it } from 'vitest';

function makeState(overrides: Partial<RunnerState> = {}): RunnerState {
  return {
    experimentId: 'test',
    experimentVersion: 1,
    mode: 'guided',
    labMode: 'virtual',
    currentPhaseId: 'planlaeg',
    visitedPhaseIds: new Set(['planlaeg']),
    firedMilestones: {},
    dataPointCount: {},
    widgetValues: {},
    dataTables: {},
    attemptCounts: {},
    simulationState: null,
    ...overrides,
  };
}

describe('runnerReducer', () => {
  describe('SET_CURRENT_PHASE', () => {
    it('updates currentPhaseId and adds to visitedPhaseIds', () => {
      const next = runnerReducer(makeState(), { type: 'SET_CURRENT_PHASE', id: 'undersoeg' });
      expect(next.currentPhaseId).toBe('undersoeg');
      expect(next.visitedPhaseIds.has('undersoeg')).toBe(true);
      expect(next.visitedPhaseIds.has('planlaeg')).toBe(true);
    });

    it('is idempotent on re-visit', () => {
      const s = makeState({ visitedPhaseIds: new Set(['planlaeg', 'undersoeg']) });
      const next = runnerReducer(s, { type: 'SET_CURRENT_PHASE', id: 'undersoeg' });
      expect(next.visitedPhaseIds.size).toBe(2);
      expect(next.currentPhaseId).toBe('undersoeg');
    });
  });

  describe('SET_MODE / SET_LAB_MODE', () => {
    it('replaces mode', () => {
      const next = runnerReducer(makeState(), { type: 'SET_MODE', mode: 'open' });
      expect(next.mode).toBe('open');
    });

    it('replaces labMode', () => {
      const next = runnerReducer(makeState(), { type: 'SET_LAB_MODE', labMode: 'real' });
      expect(next.labMode).toBe('real');
    });
  });

  describe('SET_WIDGET_VALUE', () => {
    it('upserts a widget value', () => {
      const next = runnerReducer(makeState(), {
        type: 'SET_WIDGET_VALUE',
        id: 'hypothesis',
        value: 'gravity is constant',
      });
      expect(next.widgetValues.hypothesis).toBe('gravity is constant');
    });

    it('handles sibling-key suffixes (Quiz pattern)', () => {
      const s = makeState({ widgetValues: { q1: 'opt-a' } });
      const next = runnerReducer(s, {
        type: 'SET_WIDGET_VALUE',
        id: 'q1:checked',
        value: 'opt-a',
      });
      expect(next.widgetValues.q1).toBe('opt-a');
      expect(next.widgetValues['q1:checked']).toBe('opt-a');
    });
  });

  describe('SET_DATA_TABLE', () => {
    it('replaces rows for the table id', () => {
      const next = runnerReducer(makeState(), {
        type: 'SET_DATA_TABLE',
        id: 'measurements',
        rows: [{ x: '1,5', y: '2,1' }],
      });
      expect(next.dataTables.measurements).toEqual([{ x: '1,5', y: '2,1' }]);
    });
  });

  describe('BUMP_ATTEMPTS', () => {
    it('starts at 1 for unseen ids', () => {
      const next = runnerReducer(makeState(), { type: 'BUMP_ATTEMPTS', id: 'q1' });
      expect(next.attemptCounts.q1).toBe(1);
    });

    it('increments existing counts', () => {
      const s = makeState({ attemptCounts: { q1: 2 } });
      const next = runnerReducer(s, { type: 'BUMP_ATTEMPTS', id: 'q1' });
      expect(next.attemptCounts.q1).toBe(3);
    });
  });

  describe('FIRE_MILESTONE', () => {
    it('adds a new milestone to the current phase bucket', () => {
      const next = runnerReducer(makeState(), { type: 'FIRE_MILESTONE', id: 'm1' });
      expect(next.firedMilestones.planlaeg?.has('m1')).toBe(true);
    });

    it('returns the same state ref when already fired in this phase (idempotent)', () => {
      const s = makeState({ firedMilestones: { planlaeg: new Set(['m1']) } });
      const next = runnerReducer(s, { type: 'FIRE_MILESTONE', id: 'm1' });
      expect(next).toBe(s);
    });

    it('re-firing the same id in a different phase records it under the new phase', () => {
      // Phase-scoped: the same milestone fired in phase B is a distinct event
      // from phase A, because gates evaluate against the active phase's bucket.
      const s = makeState({
        currentPhaseId: 'maal',
        firedMilestones: { planlaeg: new Set(['m1']) },
      });
      const next = runnerReducer(s, { type: 'FIRE_MILESTONE', id: 'm1' });
      expect(next.firedMilestones.planlaeg?.has('m1')).toBe(true);
      expect(next.firedMilestones.maal?.has('m1')).toBe(true);
    });

    it('does not mutate the previous phase bucket', () => {
      const planlaegBucket = new Set(['m0']);
      const s = makeState({
        currentPhaseId: 'maal',
        firedMilestones: { planlaeg: planlaegBucket },
      });
      runnerReducer(s, { type: 'FIRE_MILESTONE', id: 'm1' });
      expect(Array.from(planlaegBucket)).toEqual(['m0']);
    });
  });

  describe('INCREMENT_DATA_POINTS', () => {
    it('adds the count to the current phase bucket', () => {
      const s = makeState({ dataPointCount: { planlaeg: 4 } });
      const next = runnerReducer(s, { type: 'INCREMENT_DATA_POINTS', count: 3 });
      expect(next.dataPointCount.planlaeg).toBe(7);
    });

    it('initializes the bucket lazily for first-time phase increments', () => {
      const next = runnerReducer(makeState(), { type: 'INCREMENT_DATA_POINTS', count: 2 });
      expect(next.dataPointCount.planlaeg).toBe(2);
    });

    it('keeps phase buckets isolated', () => {
      // Pedagogical guarantee: collecting points in phase B does not bump
      // phase A's counter, so a gate on phase A requires fresh phase-A points.
      const s = makeState({
        currentPhaseId: 'maal',
        dataPointCount: { planlaeg: 3 },
      });
      const next = runnerReducer(s, { type: 'INCREMENT_DATA_POINTS', count: 1 });
      expect(next.dataPointCount.planlaeg).toBe(3);
      expect(next.dataPointCount.maal).toBe(1);
    });
  });

  describe('SET_SIMULATION_STATE', () => {
    it('stores the published payload as simulationState', () => {
      const payload = { measurements: [{ x: 1, y: 2 }], reviewed: true };
      const next = runnerReducer(makeState(), {
        type: 'SET_SIMULATION_STATE',
        state: payload,
      });
      expect(next.simulationState).toBe(payload);
    });

    it('returns the same state ref when the payload is referentially equal (idempotent)', () => {
      const payload = { measurements: [] };
      const s = makeState({ simulationState: payload });
      const next = runnerReducer(s, { type: 'SET_SIMULATION_STATE', state: payload });
      expect(next).toBe(s);
    });

    it('clears via null when the sim resets', () => {
      const s = makeState({ simulationState: { measurements: [{ x: 1, y: 2 }] } });
      const next = runnerReducer(s, { type: 'SET_SIMULATION_STATE', state: null });
      expect(next.simulationState).toBeNull();
    });
  });

  describe('RESET', () => {
    it('returns the provided nextState verbatim', () => {
      const s = makeState({ dataPointCount: { planlaeg: 99 }, attemptCounts: { q1: 5 } });
      const fresh = makeState();
      const next = runnerReducer(s, { type: 'RESET', nextState: fresh });
      expect(next).toBe(fresh);
    });
  });

  describe('determinism', () => {
    it('does not mutate the input state for any action', () => {
      const s = makeState({
        widgetValues: { a: 1 },
        firedMilestones: { planlaeg: new Set(['m0']) },
        attemptCounts: { q1: 1 },
      });
      const planlaegSnapshot = new Set(s.firedMilestones.planlaeg);
      const snapshot = {
        widgetValues: { ...s.widgetValues },
        firedMilestonesKeys: Object.keys(s.firedMilestones).sort(),
        attemptCounts: { ...s.attemptCounts },
      };
      const actions: RunnerAction[] = [
        { type: 'SET_WIDGET_VALUE', id: 'a', value: 2 },
        { type: 'FIRE_MILESTONE', id: 'm1' },
        { type: 'BUMP_ATTEMPTS', id: 'q1' },
        { type: 'SET_CURRENT_PHASE', id: 'analyser' },
      ];
      for (const a of actions) runnerReducer(s, a);
      expect(s.widgetValues).toEqual(snapshot.widgetValues);
      expect(Object.keys(s.firedMilestones).sort()).toEqual(snapshot.firedMilestonesKeys);
      expect(Array.from(s.firedMilestones.planlaeg ?? [])).toEqual(Array.from(planlaegSnapshot));
      expect(s.attemptCounts).toEqual(snapshot.attemptCounts);
    });
  });
});
