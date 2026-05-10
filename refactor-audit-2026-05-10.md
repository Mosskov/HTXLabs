# HTXLabs refactor audit — 2026-05-10

Companion to [audit-2026-05-10.md](audit-2026-05-10.md). That audit catalogues *bugs and gaps*; this one catalogues *refactor opportunities* — code that works today but could be cleaner, smaller, or more honest. Re-covers the codebase fresh, so some items overlap with bug-audit findings (re-framed from a refactor angle).

**Scope** — cleanup + small architectural (hours, not days). No big rewrites; no "what I'd do if starting over." Behavior-preserving unless flagged.

**Severity** — S1: high-leverage, clear win, low effort. S2: worthwhile improvement. S3: polish / marginal.

---

## Summary

| Category | Findings |
| -------- | -------- |
| R-A — Dead code & dead schema fields | 6 |
| R-B — DRY / dedupe | 6 |
| R-C — State machine consolidation | 1 |
| R-D — File / folder boundaries | 5 |
| R-E — API surface trim | 4 |
| R-F — Switch / branch consolidation | 3 |
| R-G — Convention hygiene (overlaps with bug audit) | 3 |
| **Total** | **28** |

| Severity | Count |
| -------- | ----- |
| S1 | 5 |
| S2 | 13 |
| S3 | 10 |

---

## R-A — Dead code & dead schema fields

### R-A1 [S2] `__reset__` milestone is fired but never read
[src/lab-guide/RunnerContext.tsx:142-145](src/lab-guide/RunnerContext.tsx) — on every sim `reset` event, the runner fires `fireMilestone('__reset__')`. No gate, no widget, and no test reads `firedMilestones.has('__reset__')`. The milestone permanently pollutes `state.firedMilestones` after the first reset and surfaces in GateDebug.
**Refactor:** delete the line and its comment. If reset-as-pedagogical-marker is wanted later, design it then.

### R-A2 [S2] `SimulationMeta.milestones` field is unread
[src/sim-contract/index.ts:45](src/sim-contract/index.ts) declares `milestones: string[]`. [src/simulations/testbed/meta.ts:9](src/simulations/testbed/meta.ts) populates it as `['m1']`; [src/simulations/dynamometer-g/meta.ts:19](src/simulations/dynamometer-g/meta.ts) as `[]`. Nothing reads it.
**Refactor:** either wire it up (e.g. `validateAuthorableGates` checks that lab `milestone` gates reference a declared sim milestone — would catch typos), or remove the field from the contract.

### R-A3 [S2] `simulationOverrides.paramSchema` is declared but unread
[src/lib/schema.ts:48](src/lib/schema.ts) — Zod field exists, but [src/lab-guide/LabGuide.tsx:62-65](src/lab-guide/LabGuide.tsx) only consumes `defaultParams`. An author who tightens a sim's range via `simulationOverrides.paramSchema` gets nothing — silently.
**Refactor:** either pass the merged schema down to the sim (or playground), or drop the field.

### R-A4 [S2] `runner.ts:70` `serialize` is unused outside its file
Only consumer is `save()` at [src/lab-guide/runner.ts:91](src/lab-guide/runner.ts). No test imports it (verified). `deserialize` is already private.
**Refactor:** drop `export`. Symmetric with `deserialize`. Cuts the public surface.

### R-A5 [S3] `regression.ts:33` `regressionThroughOrigin` has no callers
[src/lib/regression.ts:33](src/lib/regression.ts). Speculative API.
**Refactor:** remove until a lab needs it. Easy to reintroduce when the dynamometer-g analysis phase actually wants forced-origin OLS.

### R-A6 [S3] Half-dead `SimulationProps.paused` and `onParamChange`
[src/sim-contract/index.ts:13,15](src/sim-contract/index.ts). `playground.tsx` reads them; no sim acts on `paused`, no sim fires `onParamChange`. The contract advertises capabilities the sims don't honor.
**Refactor:** either narrow the contract to what flows in the wild, or wire one sim (e.g. testbed) to demonstrate honoring `paused`.

---

## R-B — DRY / dedupe

### R-B1 [S1] Three widgets register state via near-identical `useEffect`
[src/lab-guide/widgets/Checklist.tsx:24-26](src/lab-guide/widgets/Checklist.tsx), [src/lab-guide/widgets/FreeTextResponse.tsx:65-71](src/lab-guide/widgets/FreeTextResponse.tsx), [src/lab-guide/widgets/Quiz.tsx:38-44](src/lab-guide/widgets/Quiz.tsx) — same shape, same load-bearing comment ("No unmount cleanup: the registered state must outlive a phase change…").
**Refactor:** extract `useRegisteredWidgetState(id, deriveState)` hook in `lab-guide/`. The comment lives once. Future widgets get the contract for free.
```ts
function useRegisteredWidgetState(id: string, ws: WidgetState | null) {
  const { registerWidgetState } = useRunner();
  useEffect(() => { registerWidgetState(id, ws); }, [id, ws, registerWidgetState]);
}
```

### R-B2 [S2] Gate-kind enumeration duplicated three times
[src/lib/schema.ts:3-28](src/lib/schema.ts) Zod union, [src/lib/content.ts:13-19](src/lib/content.ts) `AUTHORABLE_GATE_KINDS`, [src/lab-guide/gates.ts:28-61,96-115](src/lab-guide/gates.ts) two switch statements.
**Refactor:** derive `AUTHORABLE_GATE_KINDS` from `Gate['type']` minus a denylist `['milestone', 'data-points', 'predicate']`. Combined with R-F1 (single handler map for the two switches), gate-kind knowledge lives in two places instead of four.

### R-B3 [S2] `home.tsx` and `topic.tsx` repeat the lab-card link pattern
[src/routes/home.tsx:13-29](src/routes/home.tsx) and [src/routes/topic.tsx:17-35](src/routes/topic.tsx) — same `lab-card` Tailwind structure with `<Link>` + heading + subtitle + body.
**Refactor:** extract `<LabCardLink to title subtitle body />`. Saves ~30 lines and gives one place to update card styling.

### R-B4 [S2] `RunnerContext.tsx` `api` `useMemo` lists every callback twice
[src/lab-guide/RunnerContext.tsx:178-215](src/lab-guide/RunnerContext.tsx) — every `useCallback` already stable, but `useMemo` re-lists 14 deps to re-create the api object. The Provider re-renders consumers any time `state` changes anyway (because `state` is in the deps).
**Refactor:** drop the `useMemo`. Construct `api` inline. Saves ~40 lines, identical behavior. Pairs naturally with R-C1 (useReducer makes `dispatch` referentially stable, removing every `useCallback` too).

### R-B5 [S3] `routes/experiment.tsx:53-56` imperative `phaseBodies` build
```ts
const phaseBodies: Record<string, React.ReactNode> = {};
for (const [id, Body] of Object.entries(loaded.phaseBodies)) {
  phaseBodies[id] = <Body />;
}
```
**Refactor:** `Object.fromEntries(Object.entries(loaded.phaseBodies).map(([id, Body]) => [id, <Body />]))`. Or — since this builds a new object every render — memoize on `loaded.phaseBodies` identity.

### R-B6 [S3] `App.tsx` header + nav inline
[src/App.tsx:12-26](src/App.tsx) — 14 lines of layout chrome inside the Router. Fine today; if a third top-level page joins, extract `<SiteLayout>{children}</SiteLayout>`.

---

## R-C — State machine consolidation

### R-C1 [S1] Convert `RunnerContext` setState fan-out to `useReducer`
[src/lab-guide/RunnerContext.tsx](src/lab-guide/RunnerContext.tsx) currently has 8 callbacks each doing `setState((s) => ({...s, ...}))`. The transitions form a small finite state machine: `SET_PHASE | SET_MODE | SET_LAB_MODE | SET_WIDGET_VALUE | SET_DATA_TABLE | BUMP_ATTEMPTS | FIRE_MILESTONE | INCREMENT_DATA_POINTS | RESET`.

**Refactor:** `useReducer(runnerReducer, initialState)`. Wins:
- Each callback shrinks to one `dispatch({...})` call.
- Transitions are centralised, named, and unit-testable as pure functions.
- `dispatch` is referentially stable, so most `useCallback`s disappear.
- Pairs with R-B4 — `api` becomes a thin object with no memoization.

Hours of work, big readability gain in a 225-line file. Tests in [tests/unit/lab-guide/](tests/unit/lab-guide/) should pass with no behavior change; if they don't, the reducer reveals an untested transition.

---

## R-D — File / folder boundaries

### R-D1 [S1] Move `GateDebug` and (probably) `ResetButton` out of `widgets/`
[src/lab-guide/widgets/GateDebug.tsx](src/lab-guide/widgets/GateDebug.tsx) is testbed-only and explicitly excluded from `widgets/index.ts`. [src/lab-guide/widgets/ResetButton.tsx](src/lab-guide/widgets/ResetButton.tsx)'s comment says "Testbed-only widget" though it's exported and registered in `mdxComponents`.
**Refactor:** create `src/lab-guide/dev/`. Move `GateDebug.tsx` there. Decide on `ResetButton`: if it's truly testbed-only, move it too and de-register; if authors should be able to drop a reset button into a real lab, update the comment. Either way, `widgets/` ends up as the unambiguous "MDX-author surface" — easier to scaffold `/new-lab` against.

### R-D2 [S2] `widgets/index.ts` re-exports framework-internal helpers
[src/lab-guide/widgets/index.ts](src/lab-guide/widgets/index.ts) exports `ToastContext`, `ToastProvider`, `ProtectedInput`, `ProtectedTextarea`. None are author-callable in any sane MDX flow. They're all internal plumbing for the LabGuide layer.
**Refactor:** trim to `Checklist`, `FreeTextResponse`, `KeyEquation`, `Quiz` (and `ResetButton` if it stays public). Internal helpers import directly from their files. The `/new-lab` skill's widget catalog becomes self-explaining.

### R-D3 [S2] Move `mdxComponents` out of `routes/experiment.tsx`
[src/routes/experiment.tsx:12-18](src/routes/experiment.tsx) — the route knows which widgets are author-callable. That's a widget-folder concern.
**Refactor:** create `src/lab-guide/widgets/mdx.ts` exporting the `mdxComponents` map. Routes import the map. Adding/removing an MDX widget becomes a single-file change.

### R-D4 [S3] `routes/playground.tsx` is 260 lines, mixed responsibilities
[src/routes/playground.tsx](src/routes/playground.tsx) — index route, harness, param controls, event log, and payload formatter all in one file.
**Refactor:** split into `src/routes/playground/{index,Harness,ParamControl,EventLog}.tsx`. Small architectural; only worth it if you anticipate growing the playground further.

### R-D5 [S3] Make the three-seam rule mechanical, not social
CLAUDE.md says "three seams — do not cross"; [src/simulations/dynamometer-g/physics.ts:4](src/simulations/dynamometer-g/physics.ts) repeats it as a code comment. Currently zero violations exist.
**Refactor:** add a Biome `noRestrictedImports` rule blocking `@/lab-guide/*` and `../lab-guide/*` from `src/simulations/**` and `src/sim-contract/**`. The rule encodes the architecture; the social comments become redundant. Future drift is impossible without a deliberate `// biome-ignore`.

---

## R-E — API surface trim

### R-E1 [S1] Drop `frontmatter.topic` field
[src/lib/schema.ts:42](src/lib/schema.ts). Bug audit A-1 noted it's never validated against the folder slug. Refactor angle: the folder slug is *already* the single source of truth — adding a validator would just cost code. **Drop the field.** The `/new-lab` skill no longer has to teach "remember to match the folder name to the topic field." `validExperimentsForTopic()` already groups by `topicSlug`.

### R-E2 [S3] Promote `Mode` and `LabMode` to Zod enums
Today: TS literal types in [src/lab-guide/runner.ts:3-4](src/lab-guide/runner.ts), parsed by hand in [src/lib/url.ts:5-7](src/lib/url.ts). With Zod enums in `schema.ts`, validation + types live in one place, and `parseModeParam` becomes `Mode.safeParse(raw).data ?? 'guided'`.

### R-E3 [S3] `runner.ts` `DataRow` alias is unused at the type level
[src/lab-guide/runner.ts:6-8](src/lab-guide/runner.ts) — `DataRow = Record<string, string>`. Only used as the value type of `dataTables` *within the same file*. No external imports.
**Refactor:** inline it (`Record<string, Record<string, string>[]>`) or export and consume from at least one other module. Tiny.

### R-E4 [S3] Extract `NO_SIMULATION = '__none'` constant
Refactor angle on bug audit A-4 — add the constant to `sim-contract`, replace the three string-literal sites. Single symbol you can rename if "__none" stops being the chosen sentinel.

---

## R-F — Switch / branch consolidation

### R-F1 [S1] Two parallel switch-on-`gate.type` blocks in `gates.ts`
[src/lab-guide/gates.ts:28-61](src/lab-guide/gates.ts) (`isGateSatisfied`) and [src/lab-guide/gates.ts:96-115](src/lab-guide/gates.ts) (`gateMessage`) — 8 cases each, kept in lock-step by hand.
**Refactor:** single handler map keyed by gate type:
```ts
const gateHandlers: { [K in Gate['type']]: {
  check: (g: Gate & {type: K}, s: RunnerState, m: SimulationModule | undefined, ctx: GateCtx) => boolean,
  message: (g: Gate & {type: K}) => string,
}} = {
  always:    { check: () => true, message: () => '' },
  milestone: { check: (g, s) => s.firedMilestones.has(g.requires), message: () => strings.gates.milestone },
  // …
};
```
Adding a 9th gate is one entry, not two switch updates. The 60-test gate suite stays as-is.

### R-F2 [S3] `inquiryFreeAdvance` is a one-line single-use function
[src/lab-guide/gates.ts:18,26](src/lab-guide/gates.ts).
**Refactor:** inline at the call site, or rename and export so test files can refer to the concept. As-is, it's pseudo-abstraction.

### R-F3 [S3] Silent fallback in `LabGuide.tsx:33`
`experiment.modes[mode]?.phases ?? experiment.modes.guided.phases` — when a URL says `?mode=open` but the lab declares only `guided`, the user gets guided phases without notice. Schema enforces `guided` exists, so the fallback is safe — but silent.
**Refactor:** add a `console.info('[htxlabs] mode "open" not declared by lab — falling back to guided')` on the fallback path, matching the version-mismatch trace at [RunnerContext.tsx:75](src/lab-guide/RunnerContext.tsx).

---

## R-G — Convention hygiene (overlap with bug audit, refactor framing)

### R-G1 [S2] Codify "all widget UI strings flow through `strings.da.ts`"
Bug audit B-1 flagged the lone violation ([Quiz.tsx:82](src/lab-guide/widgets/Quiz.tsx) "Tjek"). Refactor angle: lift it AND write the rule into CLAUDE.md so the next widget can't quietly create a new one. Optionally: a Biome rule against bare Danish strings in `widgets/` (regex on common words) — heuristic but cheap.

### R-G2 [S2] Encode the sim-Danish convention in the contract
Bug audit B-3 flagged the open question (sim-meta + in-sim Danish UI). Refactor framing:
- If the rule is "sim chrome in `strings.da.ts`": add `simulations.<id>.{title, controls, …}` namespace; sims read via `format()`.
- If the rule is "sim chrome in sim folder": add `meta.locale?: { da: { title, … } }` slot; document the rule in the sim-contract.

Either move encodes the choice in code, not just docs. Pick before writing the reference lab so the example exhibits the rule.

### R-G3 [S3] One-line module-purpose headers as a rule
Bug audit D-1 listed five missing headers. Refactor framing: turn it into a checked convention. Either a `/scripts/check-headers.ts` that fails CI on any `src/**/*.{ts,tsx}` whose first line isn't `// ` or `/**`, or just a CLAUDE.md note "every module starts with one line stating its role." Cheap if done now, painful to retrofit at 100 files.

---

## Verified-fine (considered, not flagged)

- **`runner.ts` ↔ `RunnerContext.tsx` cleavage** — pure types/persistence vs React state machine. Clean separation; don't merge.
- **Sibling-key trick `${id}:checked` in Quiz** — fragile-looking but documented at [runner.ts:19-23](src/lab-guide/runner.ts). Better to leave with the comment than invent a typed sub-record for one widget.
- **Eager-rendered hidden phases** in [LabGuide.tsx:99-104](src/lab-guide/LabGuide.tsx) — necessary for state preservation. Phase MDX is dumb React, no expensive work.
- **`gateCtx` `useMemo` with biome-ignore** at [RunnerContext.tsx:172-176](src/lab-guide/RunnerContext.tsx) — the biome-ignore is correct (refs don't need deps); a custom hook would just move the comment.
- **`simulationStateRef` indirection in `gateCtx`** — predicate gates need fresh state reads; the ref is the right primitive.
- **`Mode` URL-wins-over-persisted-mode logic** at [RunnerContext.tsx:69-72](src/lab-guide/RunnerContext.tsx) — explicit and intentional, comment explains. Don't simplify.
- **Numbers / regression / textMatch / hash utilities** — short, pure, well-commented. Don't touch.
- **`emptyState`'s phase-zero `Set([firstPhase.id])`** — first phase is always visited from initial state. Subtle but correct.

---

## Suggested execution order (if working through this)

If you want maximum readability gain per hour:

1. **R-A1** delete `__reset__` (5 min)
2. **R-A4** un-export `serialize` (2 min)
3. **R-E1** drop `frontmatter.topic` (15 min — touches schema + content + any test fixture)
4. **R-D1** move `GateDebug` to `dev/` (15 min)
5. **R-B1** extract `useRegisteredWidgetState` (30 min — 3 widgets + 1 hook + tests)
6. **R-F1** gate handler map (30 min — gates.ts rewrite + tests stay)
7. **R-C1** runner reducer migration (2-3 hours — biggest item, biggest payoff)
8. **R-A2 / R-A3** decide milestones / paramSchema fate (each: 15 min decide + 30 min implement-or-remove)
9. Everything else: opportunistic, when touching the file anyway.

The first six together are roughly an evening; they leave the codebase noticeably tidier without changing any visible behavior.
