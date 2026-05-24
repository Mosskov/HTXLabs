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
    rubricHintTiers: {},
    variableTableHintTiers: {},
    variableTableHintReveals: {},
    variableTableLastChecked: {},
    variableTableLocks: {},
    hintTokens: {},
    hintLastReplenishAt: {},
    hintUsageTotal: 0,
    hintUsageByPhase: {},
    hintUsageByTarget: {},
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

  describe('SPEND_AND_REVEAL_RUBRIC_TIER', () => {
    it('first spend on a fresh phase decrements from poolCap (absent === full)', () => {
      const next = runnerReducer(makeState(), {
        type: 'SPEND_AND_REVEAL_RUBRIC_TIER',
        phaseId: 'planlaeg',
        widgetId: 'w1',
        criterionId: 'c1',
        op: { kind: 'tier' },
        hintCap: 3,
        poolCap: 3,
        now: 1_000,
      });
      expect(next.rubricHintTiers.w1?.c1).toBe(1);
      expect(next.hintTokens.planlaeg).toBe(2);
      expect(next.hintLastReplenishAt.planlaeg).toBe(1_000);
      expect(next.hintUsageTotal).toBe(1);
      expect(next.hintUsageByPhase.planlaeg).toBe(1);
      expect(next.hintUsageByTarget['w1::c1']).toBe(1);
    });

    it('is a no-op when the tier ceiling is already reached', () => {
      const s = makeState({
        rubricHintTiers: { w1: { c1: 3 } },
        hintTokens: { planlaeg: 2 },
      });
      const next = runnerReducer(s, {
        type: 'SPEND_AND_REVEAL_RUBRIC_TIER',
        phaseId: 'planlaeg',
        widgetId: 'w1',
        criterionId: 'c1',
        op: { kind: 'tier' },
        hintCap: 3,
        poolCap: 3,
        now: 2_000,
      });
      expect(next).toBe(s);
    });

    it('is a no-op when tokens are insufficient (atomic re-validation)', () => {
      const s = makeState({ hintTokens: { planlaeg: 0 } });
      const next = runnerReducer(s, {
        type: 'SPEND_AND_REVEAL_RUBRIC_TIER',
        phaseId: 'planlaeg',
        widgetId: 'w1',
        criterionId: 'c1',
        op: { kind: 'tier' },
        hintCap: 3,
        poolCap: 3,
        now: 1_000,
      });
      expect(next).toBe(s);
    });

    it('rapid double-click reveals exactly one tier and decrements once', () => {
      // Same stale snapshot, two dispatches in a row: the reducer re-reads
      // state on the second action and refuses because the ceiling moved.
      let s = makeState();
      const action = {
        type: 'SPEND_AND_REVEAL_RUBRIC_TIER' as const,
        phaseId: 'planlaeg',
        widgetId: 'w1',
        criterionId: 'c1',
        op: { kind: 'tier' as const },
        hintCap: 1,
        poolCap: 3,
        now: 1_000,
      };
      s = runnerReducer(s, action);
      s = runnerReducer(s, action);
      expect(s.rubricHintTiers.w1?.c1).toBe(1);
      expect(s.hintTokens.planlaeg).toBe(2);
    });

    it('reveal moves tier from hintCap to hintCap + 1 and costs `op.cost`', () => {
      const s = makeState({
        rubricHintTiers: { w1: { c1: 3 } },
        hintTokens: { planlaeg: 3 },
      });
      const next = runnerReducer(s, {
        type: 'SPEND_AND_REVEAL_RUBRIC_TIER',
        phaseId: 'planlaeg',
        widgetId: 'w1',
        criterionId: 'c1',
        op: { kind: 'reveal', cost: 2 },
        hintCap: 3,
        poolCap: 3,
        now: 5_000,
      });
      expect(next.rubricHintTiers.w1?.c1).toBe(4);
      expect(next.hintTokens.planlaeg).toBe(1);
      expect(next.hintUsageTotal).toBe(2);
    });

    it('reveal fails when prior tier < hintCap (must finish ladder first)', () => {
      const s = makeState({
        rubricHintTiers: { w1: { c1: 1 } },
        hintTokens: { planlaeg: 3 },
      });
      const next = runnerReducer(s, {
        type: 'SPEND_AND_REVEAL_RUBRIC_TIER',
        phaseId: 'planlaeg',
        widgetId: 'w1',
        criterionId: 'c1',
        op: { kind: 'reveal', cost: 2 },
        hintCap: 3,
        poolCap: 3,
        now: 5_000,
      });
      expect(next).toBe(s);
    });

    it('insufficient-token reveal is a no-op', () => {
      const s = makeState({
        rubricHintTiers: { w1: { c1: 3 } },
        hintTokens: { planlaeg: 1 },
      });
      const next = runnerReducer(s, {
        type: 'SPEND_AND_REVEAL_RUBRIC_TIER',
        phaseId: 'planlaeg',
        widgetId: 'w1',
        criterionId: 'c1',
        op: { kind: 'reveal', cost: 2 },
        hintCap: 3,
        poolCap: 3,
        now: 5_000,
      });
      expect(next).toBe(s);
    });
  });

  describe('SPEND_AND_REVEAL_VT_TIER', () => {
    it('bumps the per-cell tier counter, appends the revealed string, and decrements one token', () => {
      const next = runnerReducer(makeState(), {
        type: 'SPEND_AND_REVEAL_VT_TIER',
        phaseId: 'planlaeg',
        widgetId: 'vars',
        cellKey: 'iv.0.symbol',
        revealedText: 'paid tier 1 text',
        hintCap: 3,
        poolCap: 3,
        now: 1_000,
      });
      expect(next.variableTableHintTiers.vars?.['iv.0.symbol']).toBe(1);
      expect(next.variableTableHintReveals.vars?.['iv.0.symbol']).toEqual(['paid tier 1 text']);
      expect(next.hintTokens.planlaeg).toBe(2);
      expect(next.hintUsageByTarget['vars::iv.0.symbol']).toBe(1);
    });

    it('caps at hintCap (idempotent at cap)', () => {
      const s = makeState({
        variableTableHintTiers: { vars: { 'iv.0.symbol': 2 } },
        hintTokens: { planlaeg: 3 },
      });
      const next = runnerReducer(s, {
        type: 'SPEND_AND_REVEAL_VT_TIER',
        phaseId: 'planlaeg',
        widgetId: 'vars',
        cellKey: 'iv.0.symbol',
        revealedText: 'ignored — at cap',
        hintCap: 2,
        poolCap: 3,
        now: 1_000,
      });
      expect(next).toBe(s);
    });
  });

  describe('LAZY_REPLENISH', () => {
    it('grants tokens when the anchor matches', () => {
      const s = makeState({
        hintTokens: { planlaeg: 1 },
        hintLastReplenishAt: { planlaeg: 1_000 },
      });
      const next = runnerReducer(s, {
        type: 'LAZY_REPLENISH',
        phaseId: 'planlaeg',
        fromLastReplenishAt: 1_000,
        newLastReplenishAt: 121_000,
        grants: 1,
        poolCap: 3,
      });
      expect(next.hintTokens.planlaeg).toBe(2);
      expect(next.hintLastReplenishAt.planlaeg).toBe(121_000);
    });

    it('is a no-op when the anchor has moved (idempotency guard)', () => {
      const s = makeState({
        hintTokens: { planlaeg: 1 },
        hintLastReplenishAt: { planlaeg: 2_000 },
      });
      const next = runnerReducer(s, {
        type: 'LAZY_REPLENISH',
        phaseId: 'planlaeg',
        fromLastReplenishAt: 1_000, // stale snapshot
        newLastReplenishAt: 121_000,
        grants: 1,
        poolCap: 3,
      });
      expect(next).toBe(s);
    });

    it('caps grants at poolCap', () => {
      const s = makeState({
        hintTokens: { planlaeg: 2 },
        hintLastReplenishAt: { planlaeg: 1_000 },
      });
      const next = runnerReducer(s, {
        type: 'LAZY_REPLENISH',
        phaseId: 'planlaeg',
        fromLastReplenishAt: 1_000,
        newLastReplenishAt: 360_000,
        grants: 5,
        poolCap: 3,
      });
      // hintTokens caps at poolCap regardless of inflated grants.
      expect(next.hintTokens.planlaeg).toBe(3);
    });
  });

  describe('ANCHOR_HINT_TIMER', () => {
    it('anchors a partial bucket on phase entry', () => {
      const s = makeState({
        hintTokens: { planlaeg: 2 },
        hintLastReplenishAt: { planlaeg: 0 },
      });
      const next = runnerReducer(s, {
        type: 'ANCHOR_HINT_TIMER',
        phaseId: 'planlaeg',
        now: 9_999,
        poolCap: 3,
      });
      expect(next.hintLastReplenishAt.planlaeg).toBe(9_999);
    });

    it('is a no-op when the bucket is full', () => {
      const s = makeState({ hintTokens: { planlaeg: 3 } });
      const next = runnerReducer(s, {
        type: 'ANCHOR_HINT_TIMER',
        phaseId: 'planlaeg',
        now: 9_999,
        poolCap: 3,
      });
      expect(next).toBe(s);
    });

    it('is a no-op when the bucket is absent (fresh phase, never spent)', () => {
      const s = makeState();
      const next = runnerReducer(s, {
        type: 'ANCHOR_HINT_TIMER',
        phaseId: 'planlaeg',
        now: 9_999,
        poolCap: 3,
      });
      expect(next).toBe(s);
    });
  });

  describe('LOCK_VT_CELLS', () => {
    it('seeds the per-widget map with the supplied cell keys', () => {
      const next = runnerReducer(makeState(), {
        type: 'LOCK_VT_CELLS',
        widgetId: 'vars',
        cellKeys: ['iv.0.symbol', 'iv.0.unit'],
      });
      expect(next.variableTableLocks.vars).toEqual({
        'iv.0.symbol': true,
        'iv.0.unit': true,
      });
    });

    it('merges into an existing widget map without clobbering prior locks', () => {
      const s = makeState({ variableTableLocks: { vars: { 'iv.0.symbol': true } } });
      const next = runnerReducer(s, {
        type: 'LOCK_VT_CELLS',
        widgetId: 'vars',
        cellKeys: ['dv.0.symbol'],
      });
      expect(next.variableTableLocks.vars).toEqual({
        'iv.0.symbol': true,
        'dv.0.symbol': true,
      });
    });

    it('is idempotent when every supplied key is already locked (same state ref)', () => {
      const s = makeState({ variableTableLocks: { vars: { 'iv.0.symbol': true } } });
      const next = runnerReducer(s, {
        type: 'LOCK_VT_CELLS',
        widgetId: 'vars',
        cellKeys: ['iv.0.symbol'],
      });
      expect(next).toBe(s);
    });

    it('returns the same state ref on an empty cellKeys payload', () => {
      const s = makeState();
      const next = runnerReducer(s, {
        type: 'LOCK_VT_CELLS',
        widgetId: 'vars',
        cellKeys: [],
      });
      expect(next).toBe(s);
    });
  });

  describe('UNLOCK_VT_CELL', () => {
    it('removes a single key from the per-widget map', () => {
      const s = makeState({
        variableTableLocks: { vars: { 'iv.0.symbol': true, 'iv.0.unit': true } },
      });
      const next = runnerReducer(s, {
        type: 'UNLOCK_VT_CELL',
        widgetId: 'vars',
        cellKey: 'iv.0.symbol',
      });
      expect(next.variableTableLocks.vars).toEqual({ 'iv.0.unit': true });
    });

    it('drops the widget entry entirely when the last key is removed (compactness)', () => {
      const s = makeState({ variableTableLocks: { vars: { 'iv.0.symbol': true } } });
      const next = runnerReducer(s, {
        type: 'UNLOCK_VT_CELL',
        widgetId: 'vars',
        cellKey: 'iv.0.symbol',
      });
      expect(next.variableTableLocks).toEqual({});
    });

    it('is a no-op for an unknown widget id (same state ref)', () => {
      const s = makeState();
      const next = runnerReducer(s, {
        type: 'UNLOCK_VT_CELL',
        widgetId: 'no-such-widget',
        cellKey: 'iv.0.symbol',
      });
      expect(next).toBe(s);
    });

    it('is a no-op for an unknown cell key in a known widget (same state ref)', () => {
      const s = makeState({ variableTableLocks: { vars: { 'iv.0.symbol': true } } });
      const next = runnerReducer(s, {
        type: 'UNLOCK_VT_CELL',
        widgetId: 'vars',
        cellKey: 'dv.0.symbol',
      });
      expect(next).toBe(s);
    });
  });

  describe('SET_VARIABLE_TABLE_LAST_CHECKED', () => {
    it('stores the array-shaped values snapshot for the widget', () => {
      const snapshot = {
        iv: [{ name: 'højde', symbol: 'h', unit: 'm' }],
        dv: [{ name: 'tid', symbol: 't', unit: 's' }],
        constants: [{ name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' }],
      };
      const next = runnerReducer(makeState(), {
        type: 'SET_VARIABLE_TABLE_LAST_CHECKED',
        widgetId: 'vars',
        values: snapshot,
      });
      expect(next.variableTableLastChecked.vars).toEqual(snapshot);
    });

    it('overwrites the prior snapshot for the same widget id', () => {
      const v1 = { iv: [{ name: 'a', symbol: 'a', unit: '' }], dv: [], constants: [] };
      const v2 = { iv: [{ name: 'b', symbol: 'b', unit: '' }], dv: [], constants: [] };
      let s = runnerReducer(makeState(), {
        type: 'SET_VARIABLE_TABLE_LAST_CHECKED',
        widgetId: 'vars',
        values: v1,
      });
      s = runnerReducer(s, {
        type: 'SET_VARIABLE_TABLE_LAST_CHECKED',
        widgetId: 'vars',
        values: v2,
      });
      expect(s.variableTableLastChecked.vars).toEqual(v2);
    });
  });
});
