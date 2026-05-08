import {
  canAdvanceTo,
  type GateCtx,
  gateMessage,
  isGateSatisfied,
  type WidgetState,
} from '@/lab-guide/gates';
import type { RunnerState } from '@/lab-guide/runner';
import type { Gate, Phase } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
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

describe('milestone gate', () => {
  const milestoneGate: Gate = { type: 'milestone', requires: 'first-run' };

  it('returns false when the milestone has not fired', () => {
    expect(isGateSatisfied(milestoneGate, makeState(), undefined, makeCtx())).toBe(false);
  });

  it('returns true when the milestone is in firedMilestones', () => {
    const state = makeState({ firedMilestones: new Set(['first-run']) });
    expect(isGateSatisfied(milestoneGate, state, undefined, makeCtx())).toBe(true);
  });

  it('ignores unrelated milestones', () => {
    const state = makeState({ firedMilestones: new Set(['unrelated', 'also-unrelated']) });
    expect(isGateSatisfied(milestoneGate, state, undefined, makeCtx())).toBe(false);
  });

  it('gateMessage returns the canonical Danish prompt', () => {
    expect(gateMessage(milestoneGate)).toBe(
      'Du skal gennemføre forsøget mindst én gang for at fortsætte.',
    );
  });

  it('open mode bypasses without the milestone', () => {
    const state = makeState({ mode: 'open' });
    expect(isGateSatisfied(milestoneGate, state, undefined, makeCtx())).toBe(true);
  });
});

describe('all-correct gate', () => {
  const allCorrectGate: Gate = { type: 'all-correct', widgetIds: ['q1', 'q2'] };

  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(allCorrectGate, makeState(), undefined, makeCtx())).toBe(false);
  });

  it('returns false when one widget reports correct=false', () => {
    const ctx = makeCtx({
      q1: { kind: 'correct', correct: true },
      q2: { kind: 'correct', correct: false },
    });
    expect(isGateSatisfied(allCorrectGate, makeState(), undefined, ctx)).toBe(false);
  });

  it('returns true when every listed widget reports correct=true', () => {
    const ctx = makeCtx({
      q1: { kind: 'correct', correct: true },
      q2: { kind: 'correct', correct: true },
    });
    expect(isGateSatisfied(allCorrectGate, makeState(), undefined, ctx)).toBe(true);
  });

  it('returns false when a listed widget reports the wrong kind', () => {
    const ctx = makeCtx({
      q1: { kind: 'filled', filled: true },
      q2: { kind: 'correct', correct: true },
    });
    expect(isGateSatisfied(allCorrectGate, makeState(), undefined, ctx)).toBe(false);
  });

  it('gateMessage returns the canonical Danish prompt', () => {
    expect(gateMessage(allCorrectGate)).toBe("Klik 'Tjek' og opnå alle korrekte svar.");
  });

  it('open mode bypasses without correct widgets', () => {
    expect(
      isGateSatisfied(allCorrectGate, makeState({ mode: 'open' }), undefined, makeCtx()),
    ).toBe(true);
  });
});

describe('all-checked gate', () => {
  const allCheckedGate: Gate = { type: 'all-checked', widgetIds: ['list1', 'list2'] };

  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(allCheckedGate, makeState(), undefined, makeCtx())).toBe(false);
  });

  it('returns false when one list reports allChecked=false', () => {
    const ctx = makeCtx({
      list1: { kind: 'checked', allChecked: true },
      list2: { kind: 'checked', allChecked: false },
    });
    expect(isGateSatisfied(allCheckedGate, makeState(), undefined, ctx)).toBe(false);
  });

  it('returns true when every listed widget reports allChecked=true', () => {
    const ctx = makeCtx({
      list1: { kind: 'checked', allChecked: true },
      list2: { kind: 'checked', allChecked: true },
    });
    expect(isGateSatisfied(allCheckedGate, makeState(), undefined, ctx)).toBe(true);
  });

  it('returns false when a listed widget reports the wrong kind', () => {
    const ctx = makeCtx({
      list1: { kind: 'correct', correct: true },
      list2: { kind: 'checked', allChecked: true },
    });
    expect(isGateSatisfied(allCheckedGate, makeState(), undefined, ctx)).toBe(false);
  });

  it('gateMessage returns the canonical Danish prompt', () => {
    expect(gateMessage(allCheckedGate)).toBe('Sæt flueben ved alle punkter på tjeklisten.');
  });

  it('open mode bypasses without checked widgets', () => {
    expect(
      isGateSatisfied(allCheckedGate, makeState({ mode: 'open' }), undefined, makeCtx()),
    ).toBe(true);
  });
});

describe('keyword-count gate', () => {
  const keywordGate: Gate = { type: 'keyword-count', widgetId: 'hyp', min: 2 };

  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(keywordGate, makeState(), undefined, makeCtx())).toBe(false);
  });

  it('returns false when foundCount is below the minimum', () => {
    const ctx = makeCtx({ hyp: { kind: 'keywords', foundCount: 1 } });
    expect(isGateSatisfied(keywordGate, makeState(), undefined, ctx)).toBe(false);
  });

  it('returns true when foundCount meets the minimum', () => {
    const ctx = makeCtx({ hyp: { kind: 'keywords', foundCount: 2 } });
    expect(isGateSatisfied(keywordGate, makeState(), undefined, ctx)).toBe(true);
  });

  it('returns true when foundCount exceeds the minimum', () => {
    const ctx = makeCtx({ hyp: { kind: 'keywords', foundCount: 5 } });
    expect(isGateSatisfied(keywordGate, makeState(), undefined, ctx)).toBe(true);
  });

  it('returns false when the widget reports the wrong kind', () => {
    const ctx = makeCtx({ hyp: { kind: 'filled', filled: true } });
    expect(isGateSatisfied(keywordGate, makeState(), undefined, ctx)).toBe(false);
  });

  it('gateMessage substitutes the min into the Danish prompt', () => {
    expect(gateMessage(keywordGate)).toBe('Find mindst 2 nøgleord.');
  });

  it('open mode bypasses without any keywords', () => {
    expect(isGateSatisfied(keywordGate, makeState({ mode: 'open' }), undefined, makeCtx())).toBe(
      true,
    );
  });
});

describe('predicate gate', () => {
  const predicateGate: Gate = { type: 'predicate', name: 'passing' };

  // Minimal SimulationModule stub — only the `gates` map is exercised by the
  // predicate path. `default` and `meta` aren't read by isGateSatisfied.
  const moduleWithGates = {
    gates: {
      passing: () => true,
      failing: () => false,
      reads_state: (state: unknown) => (state as { ok?: boolean })?.ok === true,
    },
  } as unknown as SimulationModule;

  it('returns false when module is undefined', () => {
    expect(isGateSatisfied(predicateGate, makeState(), undefined, makeCtx())).toBe(false);
  });

  it('returns false when the named predicate is missing', () => {
    const gate: Gate = { type: 'predicate', name: 'does-not-exist' };
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, makeCtx())).toBe(false);
  });

  it('returns true when the named predicate returns true', () => {
    expect(isGateSatisfied(predicateGate, makeState(), moduleWithGates, makeCtx())).toBe(true);
  });

  it('returns false when the named predicate returns false', () => {
    const gate: Gate = { type: 'predicate', name: 'failing' };
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, makeCtx())).toBe(false);
  });

  it('passes simulationStateRef.current to the predicate', () => {
    const gate: Gate = { type: 'predicate', name: 'reads_state' };
    const ctx: GateCtx = { widgets: {}, simulationStateRef: { current: { ok: true } } };
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, ctx)).toBe(true);
    const ctxBad: GateCtx = { widgets: {}, simulationStateRef: { current: { ok: false } } };
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, ctxBad)).toBe(false);
  });

  // B7 (audit): gateMessage returns a generic Danish string for every predicate
  // gate; SPEC §27 says the message is "author-provided in frontmatter" but the
  // schema for predicate is { type, name } only. Test the current behaviour;
  // B7 will be addressed in a separate schema change.
  it('gateMessage returns the generic Danish prompt (B7 — author override not yet supported)', () => {
    expect(gateMessage(predicateGate)).toBe(
      'Forsøget skal opfylde et bestemt kriterium for at fortsætte.',
    );
  });

  it('open mode bypasses even when the predicate would return false', () => {
    const gate: Gate = { type: 'predicate', name: 'failing' };
    expect(isGateSatisfied(gate, makeState({ mode: 'open' }), moduleWithGates, makeCtx())).toBe(
      true,
    );
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

  it('blocks a leap past a visited future phase whose gate is now broken', () => {
    // 4-phase setup: middle phase (`maal`) is all-checked. Student visited
    // through to `konkluder`, returned to `maal`, broke its gate (unchecked an
    // item), then stepped backward to `opstil` (always-gate). From there,
    // jumping forward to `konkluder` must be blocked even though `konkluder`
    // is in visitedPhaseIds — the broken intermediate gate must be honoured.
    const fourPhases: Phase[] = [
      { id: 'planlaeg', title: 'Planlæg', gate: { type: 'all-filled', widgetIds: ['hyp'] } },
      { id: 'opstil', title: 'Opstil', gate: alwaysGate },
      { id: 'maal', title: 'Mål', gate: { type: 'all-checked', widgetIds: ['materialer'] } },
      { id: 'konkluder', title: 'Konkludér', gate: { type: 'all-filled', widgetIds: ['konk'] } },
    ];
    const state = makeState({
      currentPhaseId: 'opstil',
      visitedPhaseIds: new Set(['planlaeg', 'opstil', 'maal', 'konkluder']),
    });
    // hyp filled, materialer NOT all-checked (the bug scenario).
    const ctx = makeCtx({
      hyp: { kind: 'filled', filled: true },
      materialer: { kind: 'checked', allChecked: false },
    });
    expect(canAdvanceTo('konkluder', fourPhases, state, undefined, ctx)).toBe(false);
    // And the immediate next phase (maal) is still reachable — student must
    // pass through it to fix the gate.
    expect(canAdvanceTo('maal', fourPhases, state, undefined, ctx)).toBe(true);
  });

  it('open mode bypasses the gate for forward navigation', () => {
    const state = makeState({ mode: 'open' });
    expect(canAdvanceTo('opstil', phases, state, undefined, makeCtx())).toBe(true);
  });

  it('returns false for an unknown phase id', () => {
    expect(canAdvanceTo('not-a-phase', phases, makeState(), undefined, makeCtx())).toBe(false);
  });
});
