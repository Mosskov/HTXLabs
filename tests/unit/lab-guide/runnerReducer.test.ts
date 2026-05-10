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
    firedMilestones: new Set(),
    dataPointCount: 0,
    widgetValues: {},
    dataTables: {},
    attemptCounts: {},
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
    it('adds a new milestone', () => {
      const next = runnerReducer(makeState(), { type: 'FIRE_MILESTONE', id: 'm1' });
      expect(next.firedMilestones.has('m1')).toBe(true);
    });

    it('returns the same state ref when already fired (idempotent)', () => {
      const s = makeState({ firedMilestones: new Set(['m1']) });
      const next = runnerReducer(s, { type: 'FIRE_MILESTONE', id: 'm1' });
      expect(next).toBe(s);
    });
  });

  describe('INCREMENT_DATA_POINTS', () => {
    it('adds the count to dataPointCount', () => {
      const s = makeState({ dataPointCount: 4 });
      const next = runnerReducer(s, { type: 'INCREMENT_DATA_POINTS', count: 3 });
      expect(next.dataPointCount).toBe(7);
    });
  });

  describe('RESET', () => {
    it('returns the provided nextState verbatim', () => {
      const s = makeState({ dataPointCount: 99, attemptCounts: { q1: 5 } });
      const fresh = makeState();
      const next = runnerReducer(s, { type: 'RESET', nextState: fresh });
      expect(next).toBe(fresh);
    });
  });

  describe('determinism', () => {
    it('does not mutate the input state for any action', () => {
      const s = makeState({
        widgetValues: { a: 1 },
        firedMilestones: new Set(['m0']),
        attemptCounts: { q1: 1 },
      });
      const snapshot = {
        widgetValues: { ...s.widgetValues },
        firedMilestones: new Set(s.firedMilestones),
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
      expect(s.firedMilestones).toEqual(snapshot.firedMilestones);
      expect(s.attemptCounts).toEqual(snapshot.attemptCounts);
    });
  });
});
