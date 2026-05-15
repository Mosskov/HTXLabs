import {
  type GateCtx,
  type WidgetState,
  canAdvanceTo,
  gateMessage,
  isGateSatisfied,
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
    firedMilestones: {},
    dataPointCount: {},
    widgetValues: {},
    dataTables: {},
    attemptCounts: {},
    simulationState: null,
    ...overrides,
  };
}

function makeCtx(widgets: Record<string, WidgetState> = {}): GateCtx {
  return {
    widgets,
    simulationStateRef: { current: null },
  };
}

/** Default phaseId for single-phase tests — most fixtures live in `planlaeg`. */
const PHASE = 'planlaeg';

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
    expect(isGateSatisfied(alwaysGate, makeState(), undefined, makeCtx(), PHASE)).toBe(true);
  });

  it('gateMessage returns empty string', () => {
    expect(gateMessage(alwaysGate)).toBe('');
  });

  it('open mode also satisfies', () => {
    expect(
      isGateSatisfied(alwaysGate, makeState({ mode: 'open' }), undefined, makeCtx(), PHASE),
    ).toBe(true);
  });
});

describe('all-filled gate', () => {
  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(allFilledGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns false when at least one listed widget reports filled=false', () => {
    const ctx = makeCtx({
      hypotese: { kind: 'filled', filled: true },
      detail: { kind: 'filled', filled: false },
    });
    expect(isGateSatisfied(allFilledGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('returns true when every listed widget reports filled=true', () => {
    const ctx = makeCtx({
      hypotese: { kind: 'filled', filled: true },
      detail: { kind: 'filled', filled: true },
    });
    expect(isGateSatisfied(allFilledGate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('returns false when a listed widget reports the wrong kind', () => {
    const ctx = makeCtx({
      hypotese: { kind: 'correct', correct: true },
      detail: { kind: 'filled', filled: true },
    });
    expect(isGateSatisfied(allFilledGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('gateMessage returns the canonical Danish prompt', () => {
    expect(gateMessage(allFilledGate)).toBe('Besvar alle spørgsmål for at fortsætte.');
  });

  it('open mode bypasses even with no widgets registered', () => {
    expect(
      isGateSatisfied(allFilledGate, makeState({ mode: 'open' }), undefined, makeCtx(), PHASE),
    ).toBe(true);
  });
});

describe('data-points gate', () => {
  const dataPointsGate: Gate = { type: 'data-points', min: 4 };

  it('returns false when the phase bucket is below the minimum', () => {
    const state = makeState({ dataPointCount: { [PHASE]: 3 } });
    expect(isGateSatisfied(dataPointsGate, state, undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns true when the phase bucket meets the minimum', () => {
    const state = makeState({ dataPointCount: { [PHASE]: 4 } });
    expect(isGateSatisfied(dataPointsGate, state, undefined, makeCtx(), PHASE)).toBe(true);
  });

  it('open mode bypasses the count requirement', () => {
    const state = makeState({ mode: 'open', dataPointCount: {} });
    expect(isGateSatisfied(dataPointsGate, state, undefined, makeCtx(), PHASE)).toBe(true);
  });

  it('points collected in another phase do NOT satisfy this phase', () => {
    // Pedagogical guarantee: free-play exploration on phase A can't pre-tick
    // a data-points gate on phase B.
    const state = makeState({ dataPointCount: { 'other-phase': 10 } });
    expect(isGateSatisfied(dataPointsGate, state, undefined, makeCtx(), PHASE)).toBe(false);
  });

  describe('with widgetId — reads the named widget count instead of the phase bucket', () => {
    const widgetGate: Gate = { type: 'data-points', min: 3, widgetId: 'malinger' };

    it('returns true when the widget reports count >= min', () => {
      const ctx = makeCtx({ malinger: { kind: 'filled', filled: false, count: 3 } });
      expect(isGateSatisfied(widgetGate, makeState(), undefined, ctx, PHASE)).toBe(true);
    });

    it('returns false when the widget reports count < min', () => {
      const ctx = makeCtx({ malinger: { kind: 'filled', filled: false, count: 2 } });
      expect(isGateSatisfied(widgetGate, makeState(), undefined, ctx, PHASE)).toBe(false);
    });

    it('returns false when the widget is not registered', () => {
      expect(isGateSatisfied(widgetGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
    });

    it('returns false when the widget is registered but missing the count facet', () => {
      const ctx = makeCtx({ malinger: { kind: 'filled', filled: true } });
      expect(isGateSatisfied(widgetGate, makeState(), undefined, ctx, PHASE)).toBe(false);
    });

    it('ignores the phase bucket — the widget count alone decides', () => {
      // Even with 100 points in the phase bucket, the gate is locked if the
      // named widget doesn't report enough.
      const state = makeState({ dataPointCount: { [PHASE]: 100 } });
      const ctx = makeCtx({ malinger: { kind: 'filled', filled: false, count: 1 } });
      expect(isGateSatisfied(widgetGate, state, undefined, ctx, PHASE)).toBe(false);
    });
  });
});

describe('milestone gate', () => {
  const milestoneGate: Gate = { type: 'milestone', requires: 'first-run' };

  it('returns false when no milestone bucket exists for the phase', () => {
    expect(isGateSatisfied(milestoneGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns true when the milestone is in the phase bucket', () => {
    const state = makeState({ firedMilestones: { [PHASE]: new Set(['first-run']) } });
    expect(isGateSatisfied(milestoneGate, state, undefined, makeCtx(), PHASE)).toBe(true);
  });

  it('ignores unrelated milestones in the same phase', () => {
    const state = makeState({
      firedMilestones: { [PHASE]: new Set(['unrelated', 'also-unrelated']) },
    });
    expect(isGateSatisfied(milestoneGate, state, undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('gateMessage returns the canonical Danish prompt', () => {
    expect(gateMessage(milestoneGate)).toBe(
      'Du skal gennemføre forsøget mindst én gang for at fortsætte.',
    );
  });

  it('open mode bypasses without the milestone', () => {
    const state = makeState({ mode: 'open' });
    expect(isGateSatisfied(milestoneGate, state, undefined, makeCtx(), PHASE)).toBe(true);
  });

  it('a milestone fired in another phase does NOT satisfy this phase', () => {
    // Pedagogical guarantee: free-play firing of `first-run` on phase A can't
    // satisfy a milestone gate on phase B.
    const state = makeState({
      firedMilestones: { 'other-phase': new Set(['first-run']) },
    });
    expect(isGateSatisfied(milestoneGate, state, undefined, makeCtx(), PHASE)).toBe(false);
  });
});

describe('all-correct gate', () => {
  const allCorrectGate: Gate = { type: 'all-correct', widgetIds: ['q1', 'q2'] };

  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(allCorrectGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns false when one widget reports correct=false', () => {
    const ctx = makeCtx({
      q1: { kind: 'correct', correct: true },
      q2: { kind: 'correct', correct: false },
    });
    expect(isGateSatisfied(allCorrectGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('returns true when every listed widget reports correct=true', () => {
    const ctx = makeCtx({
      q1: { kind: 'correct', correct: true },
      q2: { kind: 'correct', correct: true },
    });
    expect(isGateSatisfied(allCorrectGate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('returns false when a listed widget reports the wrong kind', () => {
    const ctx = makeCtx({
      q1: { kind: 'filled', filled: true },
      q2: { kind: 'correct', correct: true },
    });
    expect(isGateSatisfied(allCorrectGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('gateMessage returns the canonical Danish prompt', () => {
    expect(gateMessage(allCorrectGate)).toBe("Klik 'Tjek' og opnå alle korrekte svar.");
  });

  it('open mode bypasses without correct widgets', () => {
    expect(
      isGateSatisfied(allCorrectGate, makeState({ mode: 'open' }), undefined, makeCtx(), PHASE),
    ).toBe(true);
  });
});

describe('all-checked gate', () => {
  const allCheckedGate: Gate = { type: 'all-checked', widgetIds: ['list1', 'list2'] };

  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(allCheckedGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns false when one list reports allChecked=false', () => {
    const ctx = makeCtx({
      list1: { kind: 'checked', allChecked: true },
      list2: { kind: 'checked', allChecked: false },
    });
    expect(isGateSatisfied(allCheckedGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('returns true when every listed widget reports allChecked=true', () => {
    const ctx = makeCtx({
      list1: { kind: 'checked', allChecked: true },
      list2: { kind: 'checked', allChecked: true },
    });
    expect(isGateSatisfied(allCheckedGate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('returns false when a listed widget reports the wrong kind', () => {
    const ctx = makeCtx({
      list1: { kind: 'correct', correct: true },
      list2: { kind: 'checked', allChecked: true },
    });
    expect(isGateSatisfied(allCheckedGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('gateMessage returns the canonical Danish prompt', () => {
    expect(gateMessage(allCheckedGate)).toBe('Sæt flueben ved alle punkter på tjeklisten.');
  });

  it('open mode bypasses without checked widgets', () => {
    expect(
      isGateSatisfied(allCheckedGate, makeState({ mode: 'open' }), undefined, makeCtx(), PHASE),
    ).toBe(true);
  });
});

describe('keyword-count gate (numeric min — partial credit)', () => {
  const keywordGate: Gate = { type: 'keyword-count', widgetId: 'hyp', min: 2 };

  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(keywordGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns false when foundCount is below the minimum', () => {
    const ctx = makeCtx({ hyp: { kind: 'keywords', foundCount: 1, total: 3 } });
    expect(isGateSatisfied(keywordGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('returns true when foundCount meets the minimum', () => {
    const ctx = makeCtx({ hyp: { kind: 'keywords', foundCount: 2, total: 3 } });
    expect(isGateSatisfied(keywordGate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('returns true when foundCount exceeds the minimum', () => {
    const ctx = makeCtx({ hyp: { kind: 'keywords', foundCount: 5, total: 5 } });
    expect(isGateSatisfied(keywordGate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('returns false when the widget reports the wrong kind', () => {
    const ctx = makeCtx({ hyp: { kind: 'filled', filled: true } });
    expect(isGateSatisfied(keywordGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('gateMessage substitutes the min into the Danish prompt', () => {
    expect(gateMessage(keywordGate)).toBe('Find mindst 2 nøgleord.');
  });

  it('open mode bypasses without any keywords', () => {
    expect(
      isGateSatisfied(keywordGate, makeState({ mode: 'open' }), undefined, makeCtx(), PHASE),
    ).toBe(true);
  });
});

describe("keyword-count gate (min: 'all' — every group required)", () => {
  const allGate: Gate = { type: 'keyword-count', widgetId: 'hyp', min: 'all' };

  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(allGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns false when foundCount is below total', () => {
    const ctx = makeCtx({ hyp: { kind: 'keywords', foundCount: 1, total: 2 } });
    expect(isGateSatisfied(allGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('returns true when foundCount equals total', () => {
    const ctx = makeCtx({ hyp: { kind: 'keywords', foundCount: 2, total: 2 } });
    expect(isGateSatisfied(allGate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('decouples min from group count — adding a 3rd group keeps gate honest', () => {
    // Author bumps groups in MDX from 2 to 3. With min:'all', the gate
    // automatically requires foundCount===3; no frontmatter edit needed.
    const ctxBefore = makeCtx({ hyp: { kind: 'keywords', foundCount: 2, total: 2 } });
    expect(isGateSatisfied(allGate, makeState(), undefined, ctxBefore, PHASE)).toBe(true);
    const ctxAfter = makeCtx({ hyp: { kind: 'keywords', foundCount: 2, total: 3 } });
    expect(isGateSatisfied(allGate, makeState(), undefined, ctxAfter, PHASE)).toBe(false);
  });

  it('returns true vacuously when total is 0 (no groups configured)', () => {
    // foundCount===total holds when both are 0. This is a defensible default —
    // an author who removes all groups but leaves the gate has no requirement.
    const ctx = makeCtx({ hyp: { kind: 'keywords', foundCount: 0, total: 0 } });
    expect(isGateSatisfied(allGate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it("gateMessage returns the dedicated 'all' Danish prompt", () => {
    expect(gateMessage(allGate)).toBe('Brug nøgleord fra alle krav for at fortsætte.');
  });

  it('open mode bypasses without any keywords', () => {
    expect(
      isGateSatisfied(allGate, makeState({ mode: 'open' }), undefined, makeCtx(), PHASE),
    ).toBe(true);
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
    expect(isGateSatisfied(predicateGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns false when the named predicate is missing', () => {
    const gate: Gate = { type: 'predicate', name: 'does-not-exist' };
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, makeCtx(), PHASE)).toBe(false);
  });

  it('returns true when the named predicate returns true', () => {
    expect(isGateSatisfied(predicateGate, makeState(), moduleWithGates, makeCtx(), PHASE)).toBe(
      true,
    );
  });

  it('returns false when the named predicate returns false', () => {
    const gate: Gate = { type: 'predicate', name: 'failing' };
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, makeCtx(), PHASE)).toBe(false);
  });

  it('passes simulationStateRef.current to the predicate', () => {
    const gate: Gate = { type: 'predicate', name: 'reads_state' };
    const ctx: GateCtx = { widgets: {}, simulationStateRef: { current: { ok: true } } };
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, ctx, PHASE)).toBe(true);
    const ctxBad: GateCtx = { widgets: {}, simulationStateRef: { current: { ok: false } } };
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, ctxBad, PHASE)).toBe(false);
  });

  it('gateMessage falls back to the generic Danish prompt when no author message is set', () => {
    expect(gateMessage(predicateGate)).toBe(
      'Forsøget skal opfylde et bestemt kriterium for at fortsætte.',
    );
  });

  it('gateMessage returns the author-provided message when set (SPEC §27)', () => {
    const gate: Gate = {
      type: 'predicate',
      name: 'passing',
      message: 'Træk loddet helt op til 1,5 m før du fortsætter.',
    };
    expect(gateMessage(gate)).toBe('Træk loddet helt op til 1,5 m før du fortsætter.');
  });

  it('open mode bypasses even when the predicate would return false', () => {
    const gate: Gate = { type: 'predicate', name: 'failing' };
    expect(
      isGateSatisfied(gate, makeState({ mode: 'open' }), moduleWithGates, makeCtx(), PHASE),
    ).toBe(true);
  });

  it('predicate is phase-agnostic — same sim state satisfies any phaseId', () => {
    // Pedagogical scope of phase-isolation is limited to *history* gates
    // (milestone, data-points). Predicate reads instantaneous sim state and
    // intentionally remains global.
    const gate: Gate = { type: 'predicate', name: 'passing' };
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, makeCtx(), 'phase-a')).toBe(true);
    expect(isGateSatisfied(gate, makeState(), moduleWithGates, makeCtx(), 'phase-b')).toBe(true);
  });
});

describe('rubric-required gate', () => {
  const rubricGate: Gate = { type: 'rubric-required', widgetIds: ['hypotese'] };

  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(rubricGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns false when the widget reports satisfied:false', () => {
    const ctx = makeCtx({ hypotese: { kind: 'rubric', satisfied: false } });
    expect(isGateSatisfied(rubricGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('returns true when the widget reports satisfied:true', () => {
    const ctx = makeCtx({ hypotese: { kind: 'rubric', satisfied: true } });
    expect(isGateSatisfied(rubricGate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('returns false when a listed widget reports the wrong kind', () => {
    const ctx = makeCtx({ hypotese: { kind: 'filled', filled: true } });
    expect(isGateSatisfied(rubricGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('multi-widget: any one satisfied:false closes the gate', () => {
    const multi: Gate = { type: 'rubric-required', widgetIds: ['a', 'b', 'c'] };
    const ctx = makeCtx({
      a: { kind: 'rubric', satisfied: true },
      b: { kind: 'rubric', satisfied: false },
      c: { kind: 'rubric', satisfied: true },
    });
    expect(isGateSatisfied(multi, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('multi-widget: all satisfied opens the gate', () => {
    const multi: Gate = { type: 'rubric-required', widgetIds: ['a', 'b'] };
    const ctx = makeCtx({
      a: { kind: 'rubric', satisfied: true },
      b: { kind: 'rubric', satisfied: true },
    });
    expect(isGateSatisfied(multi, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('gateMessage returns the canonical Danish prompt', () => {
    expect(gateMessage(rubricGate)).toBe(
      'Skriv et svar og tryk Tjek mit svar — alle krav skal være opfyldt.',
    );
  });

  it('open mode bypasses without rubric widgets', () => {
    expect(
      isGateSatisfied(rubricGate, makeState({ mode: 'open' }), undefined, makeCtx(), PHASE),
    ).toBe(true);
  });
});

describe('all-satisfied gate', () => {
  const allSatGate: Gate = { type: 'all-satisfied', widgetIds: ['variables', 'hypotese'] };

  it('returns false when no widget state is registered', () => {
    expect(isGateSatisfied(allSatGate, makeState(), undefined, makeCtx(), PHASE)).toBe(false);
  });

  it('returns false when any listed widget is unsatisfied', () => {
    const ctx = makeCtx({
      variables: { kind: 'filled', filled: true },
      hypotese: { kind: 'rubric', satisfied: false },
    });
    expect(isGateSatisfied(allSatGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('returns true when every listed widget projects satisfied', () => {
    const ctx = makeCtx({
      variables: { kind: 'filled', filled: true },
      hypotese: { kind: 'rubric', satisfied: true },
    });
    expect(isGateSatisfied(allSatGate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('projects correctly across all widget kinds', () => {
    const gate: Gate = { type: 'all-satisfied', widgetIds: ['a', 'b', 'c', 'd', 'e'] };
    const ctx = makeCtx({
      a: { kind: 'correct', correct: true },
      b: { kind: 'checked', allChecked: true },
      c: { kind: 'filled', filled: true },
      d: { kind: 'rubric', satisfied: true },
      e: { kind: 'keywords', foundCount: 3, total: 3 },
    });
    expect(isGateSatisfied(gate, makeState(), undefined, ctx, PHASE)).toBe(true);
  });

  it('returns false when a keyword widget has not hit all groups', () => {
    const gate: Gate = { type: 'all-satisfied', widgetIds: ['a', 'b'] };
    const ctx = makeCtx({
      a: { kind: 'rubric', satisfied: true },
      b: { kind: 'keywords', foundCount: 2, total: 3 },
    });
    expect(isGateSatisfied(gate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('an absent registration counts as unsatisfied', () => {
    const ctx = makeCtx({ variables: { kind: 'filled', filled: true } });
    expect(isGateSatisfied(allSatGate, makeState(), undefined, ctx, PHASE)).toBe(false);
  });

  it('gateMessage names the participating widget ids', () => {
    expect(gateMessage(allSatGate)).toBe(
      'Fuldfør alle delopgaver for at fortsætte (variables, hypotese).',
    );
  });

  it('open mode bypasses without satisfied widgets', () => {
    expect(
      isGateSatisfied(allSatGate, makeState({ mode: 'open' }), undefined, makeCtx(), PHASE),
    ).toBe(true);
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

  it('routes each gate to its own phase bucket when walking forward', () => {
    // Sim-driven gates on two consecutive phases. The student has fired
    // milestone `m1` only in phase `a`, and collected only `b`-phase points.
    // The forward walk must check phase `a`'s gate against `a`'s milestones
    // and phase `b`'s gate against `b`'s data-point bucket — not the other
    // way around. This is the per-call-site fix that the phaseId thread-through
    // exists to enable.
    const simPhases: Phase[] = [
      { id: 'a', title: 'A', gate: { type: 'milestone', requires: 'm1' } },
      { id: 'b', title: 'B', gate: { type: 'data-points', min: 2 } },
      { id: 'c', title: 'C', gate: alwaysGate },
    ];
    const state = makeState({
      currentPhaseId: 'a',
      visitedPhaseIds: new Set(['a']),
      firedMilestones: { a: new Set(['m1']) },
      dataPointCount: { b: 2 },
    });
    // a's gate passes (m1 in a), b's gate passes (2 points in b) → c reachable.
    // Without phaseId thread-through this would silently confuse the buckets.
    expect(canAdvanceTo('c', simPhases, state, undefined, makeCtx())).toBe(false); // c unvisited, no leap
    expect(canAdvanceTo('b', simPhases, state, undefined, makeCtx())).toBe(true);
  });
});
