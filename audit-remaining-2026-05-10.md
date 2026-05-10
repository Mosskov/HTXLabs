# HTXLabs audit — remaining items (consolidated 2026-05-10)

Consolidated from two earlier audit files (`audit-2026-05-10.md` bug/gap punch list + `refactor-audit-2026-05-10.md` 28 refactor opportunities) — the originals are gone but their commits live in git history. Resolved and verified-good entries dropped; bug+refactor entries that point at the same code are merged into one entry but keep both origin ids (e.g. `A-3 / R-B2`) so chat-history references stay valid.

**Severity** — S1: high-leverage, clear win, low effort. S2: real improvement, not blocking. S3: polish / marginal.

## Summary

| Severity | Count |
| -------- | ----- |
| S1       | 2     |
| S2       | 11    |
| S3       | 14    |

Decision pending before reference lab: 1 (B-3 / R-G2).

---

## Pending decision

### B-3 / R-G2 — sim-Danish convention
Sim chrome is currently a free-for-all: [src/simulations/dynamometer-g/meta.ts:6](src/simulations/dynamometer-g/meta.ts) hardcodes Danish title; [src/simulations/testbed/meta.ts:5](src/simulations/testbed/meta.ts) is English; in-sim Danish UI lives in [src/simulations/testbed/index.tsx:22-50](src/simulations/testbed/index.tsx). **Pick one before writing the reference lab and `/new-lab` skill** so the example exhibits the rule:
- (a) funnel sim chrome through `strings.da.ts` (`simulations.<id>.{title, controls, …}` namespace), OR
- (b) document "sim chrome lives in the sim folder" — add a `meta.locale?: { da: { … } }` slot in `sim-contract`.

---

## 1. Engine & schema

### R-F1 [S1] Gate handler map (subsumes A-3 / R-B2)
[src/lab-guide/gates.ts:28-61,96-115](src/lab-guide/gates.ts) — two parallel switch-on-`gate.type` blocks (`isGateSatisfied` and `gateMessage`), 8 cases each, kept in lock-step by hand. The same 8 kinds are also enumerated in the Zod `Gate` union ([src/lib/schema.ts:3-28](src/lib/schema.ts)) and `AUTHORABLE_GATE_KINDS` ([src/lib/content.ts:13-19](src/lib/content.ts)).
**Refactor:** single handler map keyed by gate type with `{ check, message }` per kind; derive `AUTHORABLE_GATE_KINDS` from `Gate['type']` minus a denylist. Adding a 9th gate becomes one entry, not four. The 60-test gate suite stays as-is.

### A-2 [S2] `Phase.id` is unconstrained `z.string()`
[src/lib/schema.ts:31-37](src/lib/schema.ts). The 7 canonical phase ids from SPEC §2 (memory `feedback_phase_ids`) aren't enforced — a typo like `udforsk` would load. A soft enum-with-warning for non-`test`-tagged labs would catch typos without breaking the testbed.

### R-A2 [S2] `SimulationMeta.milestones` field is unread
[src/sim-contract/index.ts:45](src/sim-contract/index.ts). Populated by sims (testbed `['m1']`, dynamometer-g `[]`); read by nothing. Either wire it into `validateAuthorableGates` so lab `milestone` gates must reference a declared sim milestone (catches typos), or drop the field.

### R-A3 [S2] `simulationOverrides.paramSchema` is declared but unread
[src/lib/schema.ts:48](src/lib/schema.ts) — Zod field exists, but [src/lab-guide/LabGuide.tsx:62-65](src/lab-guide/LabGuide.tsx) only consumes `defaultParams`. An author tightening a sim's range via `paramSchema` gets nothing — silently. Pass the merged schema down, or drop the field.

### R-A6 [S3] Half-dead `SimulationProps.paused` and `onParamChange`
[src/sim-contract/index.ts:13,15](src/sim-contract/index.ts). `playground.tsx` reads them; no sim acts on `paused`, no sim fires `onParamChange`. Either narrow the contract to what flows in the wild, or wire one sim (e.g. testbed) to demonstrate honoring `paused`.

### R-E2 [S3] Promote `Mode` and `LabMode` to Zod enums
TS literal types in [src/lab-guide/runner.ts:3-4](src/lab-guide/runner.ts), parsed by hand in [src/lib/url.ts:5-7](src/lib/url.ts). With Zod enums in `schema.ts`, validation + types live in one place and `parseModeParam` becomes `Mode.safeParse(raw).data ?? 'guided'`.

### R-E3 [S3] `DataRow` alias unused outside its file
[src/lab-guide/runner.ts:6-8](src/lab-guide/runner.ts) — `DataRow = Record<string, string>` is only used as the value type of `dataTables` *within the same file*. Inline it (`Record<string, Record<string, string>[]>`) or export and consume from at least one other module.

### R-F2 [S3] `inquiryFreeAdvance` is a one-line single-use function
[src/lab-guide/gates.ts:18,26](src/lab-guide/gates.ts). Inline at the call site, or rename and export so test files can refer to the concept. As-is, it's pseudo-abstraction.

### R-F3 [S3] Silent fallback in `LabGuide.tsx:33`
`experiment.modes[mode]?.phases ?? experiment.modes.guided.phases` — when a URL says `?mode=open` but the lab declares only `guided`, the user gets guided phases without notice. Schema enforces `guided` exists, so the fallback is safe but silent. Add a `console.info('[htxlabs] mode … not declared by lab — falling back to guided')`, matching the version-mismatch trace at [RunnerContext.tsx:75](src/lab-guide/RunnerContext.tsx).

---

## 2. Widgets & MDX surface

### R-B1 [S1] Extract `useRegisteredWidgetState` hook
[src/lab-guide/widgets/Checklist.tsx:24-26](src/lab-guide/widgets/Checklist.tsx), [src/lab-guide/widgets/FreeTextResponse.tsx:65-71](src/lab-guide/widgets/FreeTextResponse.tsx), [src/lab-guide/widgets/Quiz.tsx:38-44](src/lab-guide/widgets/Quiz.tsx) — three widgets register state via near-identical `useEffect`, sharing the same load-bearing comment ("No unmount cleanup: the registered state must outlive a phase change…"). Extract `useRegisteredWidgetState(id, deriveState)` in `lab-guide/`. The comment lives once; future widgets get the contract for free.

### B-1 / R-G1 [S2] Quiz "Tjek" hardcoded + codify widget-strings rule
[src/lab-guide/widgets/Quiz.tsx:82](src/lab-guide/widgets/Quiz.tsx) — "Tjek" button label is hardcoded Danish; should live in `strings.da.ts` (e.g. `widgets.quiz.checkLabel`) and accept an override prop, matching the `correctMessage`/`incorrectMessage` convention (SPEC §17, memory `feedback_author_flexibility`). **Refactor angle:** lift it AND write the rule into CLAUDE.md so the next widget can't quietly create a new violation.

### C-5 [S2] a11y gaps in author-facing widgets
[src/lab-guide/widgets/Quiz.tsx](src/lab-guide/widgets/Quiz.tsx), [src/lab-guide/widgets/FreeTextResponse.tsx](src/lab-guide/widgets/FreeTextResponse.tsx), [src/lab-guide/widgets/Checklist.tsx](src/lab-guide/widgets/Checklist.tsx) have no `aria-describedby` for hint text, no `aria-live` for correctness feedback, no explicit roles. `PhaseStepper`, `SimulationPanel`, `ToastContext` are properly annotated; the widget layer is the gap.

### R-A5 [S3] `regressionThroughOrigin` has no callers
[src/lib/regression.ts:33](src/lib/regression.ts). Speculative API. Remove until a lab needs it — easy to reintroduce when the dynamometer-g analysis phase actually wants forced-origin OLS.

### A-4 / R-E4 [S3] Extract `NO_SIMULATION = '__none'` constant
Magic string appears in [src/lib/simulations.ts:16](src/lib/simulations.ts), [src/lab-guide/LabGuide.tsx:17](src/lab-guide/LabGuide.tsx) (doc comment), and inline in any theory-only lab's frontmatter. Export `NO_SIMULATION` from `sim-contract`; replace the three sites. Single symbol you can rename if the chosen sentinel ever changes.

### D-5 [S3] Single TODO in src/
[src/lab-guide/widgets/Quiz.tsx:75](src/lab-guide/widgets/Quiz.tsx) — "TODO(SPEC §13): migrate to phase-footer button registration when runner API lands." Known; resolve when the phase-footer button registration API is built.

---

## 3. App chrome & i18n

### C-2 [S2] `App.tsx` hardcoded Danish
[src/App.tsx:14,19,22](src/App.tsx) — "HTX Labs", "Forsiden", "Emner" hardcoded. `strings.brand`, `strings.nav.home`, `strings.nav.topics` already exist in [src/lab-guide/strings.da.ts:7-12](src/lab-guide/strings.da.ts).

### C-3 [S2] `routes/home.tsx` hardcoded Danish
[src/routes/home.tsx:8,10](src/routes/home.tsx) — "HTX Labs" heading and the splash intro hardcoded. Lift to `strings`.

### C-4 [S2] `routes/topic.tsx` breadcrumb hardcoded
[src/routes/topic.tsx:13](src/routes/topic.tsx) — "← Forsiden" hardcoded. The file already imports `strings`; add e.g. `strings.nav.backToHome`.

### R-B3 [S2] Extract `<LabCardLink>` for lab cards
[src/routes/home.tsx:13-29](src/routes/home.tsx) and [src/routes/topic.tsx:17-35](src/routes/topic.tsx) — same `lab-card` Tailwind structure with `<Link>` + heading + subtitle + body. Extract `<LabCardLink to title subtitle body />`. Saves ~30 lines and gives one place to update card styling. Pairs naturally with C-3/C-4.

### C-6 [S3] `routes/home.tsx:24` dead ternary
`t.experiments.length === 1 ? 'forsøg' : 'forsøg'`. Both branches identical (Danish "forsøg" is uncountable). Drop the ternary, or write the real plural if a different label was intended.

### C-7 [S3] `routes/playground.tsx` hardcoded Danish
Many strings ("Playground", "Generic harness…", "Indlæser…", "Måler størrelse…", "Parametre", "Pause", "Reset", "Event log", "Clear log", "Ingen events endnu.", "Ukendt simulation:"). Lower priority — dev tool. Awareness only.

### R-B5 [S3] `routes/experiment.tsx:53-56` imperative `phaseBodies` build
Replace the imperative `for` loop with `Object.fromEntries(Object.entries(loaded.phaseBodies).map(([id, Body]) => [id, <Body />]))`. Or — since this builds a new object every render — memoize on `loaded.phaseBodies` identity.

### R-B6 [S3] `App.tsx` header + nav inline
[src/App.tsx:12-26](src/App.tsx) — 14 lines of layout chrome inside the Router. Fine today; if a third top-level page joins, extract `<SiteLayout>{children}</SiteLayout>`. Deferred until that third page exists.

### R-D4 [S3] `routes/playground.tsx` is 260 lines, mixed responsibilities
Index route, harness, param controls, event log, and payload formatter all in one file. Split into `src/routes/playground/{index,Harness,ParamControl,EventLog}.tsx`. Only worth it if you anticipate growing the playground further.

---

## 4. Conventions & boundaries

### D-1 / D-2 / R-G3 [S2 / S3] Module-purpose headers + codify the rule
**Load-bearing files (S2):** [src/lab-guide/runner.ts](src/lab-guide/runner.ts), [src/lab-guide/gates.ts](src/lab-guide/gates.ts), [src/lab-guide/RunnerContext.tsx](src/lab-guide/RunnerContext.tsx), [src/lab-guide/LabGuide.tsx](src/lab-guide/LabGuide.tsx), [src/lib/schema.ts](src/lib/schema.ts) — the five files a new contributor opens first.
**Lower-traffic (S3):** [src/lab-guide/PhaseStepper.tsx](src/lab-guide/PhaseStepper.tsx), [src/lab-guide/PhaseFooter.tsx](src/lab-guide/PhaseFooter.tsx), [src/lab-guide/widgets/ProtectedInput.tsx](src/lab-guide/widgets/ProtectedInput.tsx), [src/lab-guide/widgets/ToastContext.tsx](src/lab-guide/widgets/ToastContext.tsx), [src/lib/url.ts](src/lib/url.ts), [src/App.tsx](src/App.tsx), `src/routes/*.tsx`, [src/simulations/testbed/index.tsx](src/simulations/testbed/index.tsx).
**Codify (R-G3):** add a CLAUDE.md note "every module starts with one line stating its role," or a `/scripts/check-headers.ts` that fails CI on any `src/**/*.{ts,tsx}` whose first line isn't `// ` or `/**`. Cheap if done now, painful to retrofit at 100 files.

### R-D5 [S3] Make the three-seam rule mechanical
CLAUDE.md says "three seams — do not cross"; [src/simulations/dynamometer-g/physics.ts:4](src/simulations/dynamometer-g/physics.ts) repeats it as a code comment. Currently zero violations. Add a Biome `noRestrictedImports` rule blocking `@/lab-guide/*` and `../lab-guide/*` from `src/simulations/**` and `src/sim-contract/**`. Future drift becomes impossible without a deliberate `// biome-ignore`.

---

## Suggested execution order

1. **R-B1** (S1, ~30 min) — widget hook extraction
2. **R-F1** (S1, ~30 min) — gate handler map (subsumes A-3 / R-B2)
3. **B-1 / R-G1** (S2, ~30 min) — i18n cluster start, codify the rule while at it
4. **C-2 + C-3 + C-4 + C-6 + R-B3** (S2/S3, ~45 min batched) — app-chrome i18n cluster, extract `LabCardLink` while touching home/topic
5. **C-5** (S2, 1–2 h) — a11y pass on the three widgets
6. **R-A2 / R-A3 / R-A5 / R-A6** — decide-then-prune (15 min decide each, then implement-or-remove)
7. **A-2** (S2, ~30 min) — phase id soft enum
8. **A-4 / R-E4** (S3, ~10 min) — `NO_SIMULATION` constant
9. **D-1 / D-2 / R-G3** (~1 h) — module-purpose headers + codify rule
10. **R-D5** (S3, ~30 min) — Biome import rule for the three-seam boundary
11. Everything else (R-E2, R-E3, R-F2, R-F3, R-B5, R-B6, R-D4, C-7, D-5): opportunistic, when touching the file anyway.

**Decision still pending before the reference lab:** B-3 / R-G2 (sim-Danish convention).
