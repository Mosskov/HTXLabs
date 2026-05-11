# HTXLabs audit — remaining items (consolidated 2026-05-10)

Consolidated from two earlier audit files (`audit-2026-05-10.md` bug/gap punch list + `refactor-audit-2026-05-10.md` 28 refactor opportunities) — the originals are gone but their commits live in git history. Resolved and verified-good entries dropped; bug+refactor entries that point at the same code are merged into one entry but keep both origin ids (e.g. `A-3 / R-B2`) so chat-history references stay valid.

**Refreshed 2026-05-11** — cluster sweep (commits `a250a40`, `eac2beb`, `03a8789`, `1d3a358`, `a878a21`) + engine/schema cluster (`a2087b2`) + S3 polish (`6291cce`) entries struck through; suggested order and summary recounted.

**Severity** — S1: high-leverage, clear win, low effort. S2: real improvement, not blocking. S3: polish / marginal.

## Summary

| Severity | Count |
| -------- | ----- |
| S1       | 0     |
| S2       | 0     |
| S3       | 3     |

Decision pending before reference lab: 0.

---

## 1. Engine & schema

### ~~R-F1~~ [S1, resolved 2026-05-11] Gate handler map
Commit `a250a40` (Cluster 1). `GATE_HANDLERS` in [src/lab-guide/gates.ts:44-101](src/lab-guide/gates.ts) drives both `isGateSatisfied` and `gateMessage`; `GATE_KINDS` is derived from its keys. Adding a 9th gate is one entry.

### ~~A-2~~ [S2, resolved 2026-05-11] `Phase.id` soft enum
Commit `a250a40`. `CANONICAL_PHASE_IDS` exported from [src/lib/schema.ts:42-50](src/lib/schema.ts); non-canonical ids on non-`test` labs are warned via `validateAuthorableGates`.

### ~~R-A2~~ [S2, resolved 2026-05-11] `SimulationMeta.milestones` cross-checked
Commit `a250a40` (Cluster 1) — same commit that added `validateAuthorableGates`. `validateSimGateRefs` in [src/lib/content.ts:62-81](src/lib/content.ts) throws when a `milestone` gate references an id the resolved sim doesn't declare; sim metas eagerly indexed by `import.meta.glob` at [content.ts:121-127](src/lib/content.ts). The audit punch list just missed it.

### ~~R-A3~~ [S2, resolved 2026-05-11] `simulationOverrides.paramSchema` declared but unread
Commit `213963a` (Audit cleanup). Field dropped from `simulationOverrides` Zod schema — chose "drop, reintroduce when a lab needs it" over wiring it through `LabGuide.tsx`.

### ~~R-A6~~ [S3, resolved 2026-05-11] `SimulationProps.onParamChange` narrowed out
Chose narrow over wire — no sim has internal param controls today, and CLAUDE.md "Simplicity First" rejects keeping a field for hypothetical future use. Removed from `SimulationProps` in [src/sim-contract/index.ts](src/sim-contract/index.ts); dropped the `_onParamChange` destructure in `dynamometer-g/index.tsx` and the `onParamChange={setParams}` pass-through in `routes/simulationer.tsx`; updated both `new-simulation` templates, the SKILL.md prop list, and SPEC §the sim-contract code block. `paused` survives (testbed honors it).

### ~~R-E2~~ [S3, resolved 2026-05-11] `Mode` and `LabMode` as Zod enums
Commit `a2087b2`. Both promoted to Zod enums in [src/lib/schema.ts:4-8](src/lib/schema.ts); `parseModeParam` now uses `safeParse`.

### ~~R-E3~~ [S3, resolved 2026-05-11] `DataRow` alias is now multi-file
Effectively resolved by `10e8c5c` (useReducer migration). `DataRow` is now imported by [src/lab-guide/runnerReducer.ts:4](src/lab-guide/runnerReducer.ts) and [src/lab-guide/RunnerContext.tsx:17](src/lab-guide/RunnerContext.tsx) — the alias earns its keep.

### ~~R-F2~~ [S3, resolved 2026-05-11] `inquiryFreeAdvance` one-liner
Commit `a2087b2`. Helper inlined at the single call site in `gates.ts`.

### ~~R-F3~~ [S3, resolved 2026-05-11] Silent fallback in `LabGuide.tsx:33`
Commit `a2087b2`. Mode mismatch now traces via `console.info`, matching the version-mismatch log in `RunnerContext.tsx`.

---

## 2. Widgets & MDX surface

### ~~R-B1~~ [S1, resolved 2026-05-11] `useRegisteredWidgetState` hook
Commit `eac2beb` (Cluster 2). Hook lives in `src/lab-guide/useRegisteredWidgetState.ts`; Checklist, FreeTextResponse, and Quiz all consume it. The load-bearing comment lives once.

### ~~B-1 / R-G1~~ [S2, resolved 2026-05-11] Quiz "Tjek" + widget-strings rule
Commit `eac2beb`. "Tjek" lifted to `strings.widgets.quiz.checkLabel` with a `checkLabel` override prop; widget-strings rule documented in [src/lab-guide/CLAUDE.md](src/lab-guide/CLAUDE.md) ("Widget conventions").

### ~~C-5~~ [S2, resolved 2026-05-11] Widget a11y gaps
Commit `eac2beb`. `aria-live` / `aria-describedby` / explicit roles added across Quiz, FreeTextResponse, and Checklist.

### ~~R-A5~~ [S3, resolved 2026-05-11] `regressionThroughOrigin` no callers
Commit `213963a`. Removed from `src/lib/regression.ts`; easy to reintroduce when dynamometer-g's analysis phase actually wants forced-origin OLS.

### ~~A-4 / R-E4~~ [S3, resolved 2026-05-11] `NO_SIMULATION` constant
Commits `213963a` / `a878a21`. Exported from [src/sim-contract/index.ts:6](src/sim-contract/index.ts); consumed by `loadSimulation` in [src/lib/simulations.ts:1,16](src/lib/simulations.ts) and referenced from `LabGuide.tsx`.

### D-5 [S3] Single TODO in src/
[src/lab-guide/widgets/Quiz.tsx:78](src/lab-guide/widgets/Quiz.tsx) — "TODO(SPEC §13): migrate to phase-footer button registration when runner API lands." Known; resolve when the phase-footer button registration API is built.

---

## 3. App chrome & i18n

### ~~C-2~~ [S2, resolved 2026-05-11] `App.tsx` hardcoded Danish
Commit `03a8789` (Cluster 3). "HTX Labs" / "Forsiden" / "Emner" now read from `strings.brand`, `strings.nav.home`, `strings.nav.topics` in [src/App.tsx:14-26](src/App.tsx).

### ~~C-3~~ [S2, resolved 2026-05-11] `routes/home.tsx` hardcoded Danish
Commit `03a8789`. Heading and splash intro lifted to `strings`.

### ~~C-4~~ [S2, resolved 2026-05-11] `routes/topic.tsx` breadcrumb
Commit `03a8789`. "← Forsiden" now uses `strings.nav.backToHome`.

### ~~R-B3~~ [S2, resolved 2026-05-11] Extract `<LabCardLink>`
Commit `03a8789`. Shared component now consumed by home + topic routes; lab-card styling lives in one place.

### ~~C-6~~ [S3, resolved 2026-05-11] Dead ternary in `routes/home.tsx`
Commit `03a8789`. `'forsøg' : 'forsøg'` ternary dropped.

### ~~C-7~~ [S3, resolved 2026-05-11] `routes/playground.tsx` hardcoded Danish
All 13 strings lifted into `strings.playground` namespace ([src/lab-guide/strings.da.ts](src/lab-guide/strings.da.ts)). Parameterised entries (`unknownSim`, `titleWithSim`, `eventLog`) use the existing `format()` helper.

### ~~R-B5~~ [S3, resolved 2026-05-11] `routes/experiment.tsx` imperative `phaseBodies` build
Replaced the imperative loop with a `useMemo` over `Object.fromEntries`, keyed on `loaded.phaseBodies` identity. Hoisted above the early-return; closure handles `loaded === null` and the error variant by returning `{}`. `<Body key={id} />` keeps Biome happy.

### R-B6 [S3] `App.tsx` header + nav inline
[src/App.tsx:12-28](src/App.tsx) — header chrome inside the Router. Fine today; if a third top-level page joins, extract `<SiteLayout>{children}</SiteLayout>`. Deferred until that third page exists.

### R-D4 [S3] `routes/simulationer.tsx` is 273 lines, mixed responsibilities
Index route, harness, param controls, event log, and payload formatter all in one file. Split into `src/routes/simulationer/{index,Harness,ParamControl,EventLog}.tsx`. Only worth it if you anticipate growing the playground further. (Route was renamed `/playground` → `/simulationer` in commit `5a1a375`.)

---

## 4. Conventions & boundaries

### ~~D-1 / D-2 / R-G3~~ [S2 / S3, resolved 2026-05-11] Module-purpose headers + codify rule
Commit `a878a21` (Cluster 5). Headers added to load-bearing + lower-traffic files; rule codified in root `CLAUDE.md` ("Conventions" → "Module-purpose headers").

### ~~R-D5~~ [S3, resolved 2026-05-11] Mechanical three-seam rule
Commit `a878a21`. Biome `noRestrictedImports` rule blocks `@/lab-guide/*` and `../lab-guide/*` from `src/simulations/**` and `src/sim-contract/**`. Future drift needs a deliberate `// biome-ignore`.

### ~~B-3 / R-G2~~ [S2, resolved 2026-05-11] Sim-Danish convention
Commit `1d3a358` (Cluster 4). Chose option (b): `meta.locale.da.title` slot in [src/sim-contract/index.ts:47-67](src/sim-contract/index.ts) + `simTitleDa()` helper. Sims own their own chrome.

---

## Suggested execution order

1. **D-5** [S3] — Quiz TODO. Blocked until phase-footer button-registration API exists; tracked, not actionable.
2. **R-B6** [S3] — deferred until a third top-level page joins.
3. **R-D4** [S3] — deferred unless the playground grows further.
