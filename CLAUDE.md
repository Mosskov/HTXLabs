# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project

Static educational website for Danish HTX physics students. **Single source of truth is [SPEC.md](./SPEC.md)** — anything ambiguous in this file or [README.md](./README.md), defer to the spec. The full design (pedagogy, gates, widgets, simulation contract, accessibility, persistence) is documented there in detail.

## Commands

```sh
npm install
npm run dev          # Vite dev server with HMR
npm run build        # tsc -b && vite build → ./dist
npm run preview      # serve ./dist locally
npm test             # Vitest (watch); append `-- --run` for CI/one-shot (e.g. `npm test -- --run path/to/file.test.ts`)
npm run test:e2e     # Playwright
npm run lint         # Biome check (also runs in CI; must pass)
npm run format       # Biome format --write
```

CI (`.github/workflows/deploy.yml`) runs `lint` → `test -- --run` → `build` and deploys `dist/` to GitHub Pages. The workflow is **manual-only** (`workflow_dispatch`) — trigger it from the Actions tab when you want to deploy. The build sets `BASE_URL=/<repo>/` for project pages; clear it (and add `public/CNAME`) for a custom domain.

## Architecture

The codebase is a **framework + content** split. Authors add labs as MDX content; the framework renders them.

### Three seams — do not cross

1. **`src/lab-guide/`** — the LabGuide framework: state shape + persistence (`runner.ts`), pure transitions (`runnerReducer.ts`), gate evaluation (`gates.ts`), React context (`RunnerContext.tsx`), top-level component (`LabGuide.tsx`), phase stepper/footer, MDX widgets (`widgets/`). This is the only thing routes mount.
2. **`src/sim-contract/index.ts`** — the only module a simulation may import from outside its own folder. Defines `SimulationProps`, `SimulationModule`, `ProgressEvent`, `SimulationMeta`. **Simulations must not import from `lab-guide/`.** This isolation is what lets sims be developed and tested independently.
3. **`src/content/`** — pure content. Each experiment is `experiments/<topic>/<slug>/index.ts` exporting `frontmatter` (validated against `ExperimentFrontmatter` from `src/lib/schema.ts`), `Theory` (the theory MDX), and `phaseBodies` (a record of phase id → MDX component). Topics are `topics/<slug>.ts`.

Content is auto-discovered at build time via `import.meta.glob` in `src/lib/content.ts` — adding a new lab requires no registry edits. Frontmatter is Zod-validated at module-load; a malformed lab fails dev startup, not runtime.

### Lab page anatomy (`LabGuide.tsx`)

A lab page has three stacked sections: **Theory** (always visible) → **SimulationPanel** (collapsible, mounted once for the lab — visibility toggles, state preserved across phases) → **Laboratorieguide** (the gated 7-phase flow). Phase navigation uses URL hash; mode/labMode are query params.

### State, persistence, gates

- Runner state (`src/lab-guide/runner.ts`) is persisted to `localStorage['htxlabs:state:${experimentId}']` on every change.
- On mount, `isStateCompatible` checks saved `experimentVersion` against current frontmatter; mismatch → silent wipe + restart (no banner; `console.info` only). Bump `frontmatter.version` whenever phase ids or gate structure change.
- Gates are pure (`gates.ts`) — discriminated union over `always | milestone | data-points | all-correct | all-checked | all-filled | keyword-count | predicate`. **Open-mode advances are unconditional** (`inquiryFreeAdvance`); guided/semi-guided run the actual gate. Add a new gate kind: extend the Zod `Gate` union in `src/lib/schema.ts`, then handle it in `isGateSatisfied` and `gateMessage`.
- **Navigation is asymmetric by design**: forward advance is gate-checked, but completed/current phases are always reachable via the stepper (backward navigation is free). Don't symmetrize `canAdvanceTo` — `PhaseStepper.tsx` relies on the asymmetry to keep completed circles clickable.
- Widgets register live state (`registerWidgetState`) into a ref, not React state, so widget re-renders don't cascade through the runner. A `setTick` forces gate-evaluating subscribers to re-render after registration.

### Simulation registry

`src/lib/simulations.ts` maps `simulationId` → lazy importer. Each sim ships as its own JS chunk, dynamic-imported when its lab opens. The sentinel id `__none` means "no simulation" (used by content scaffolds and `Hej, Verden`). Per-lab `simulationOverrides` in frontmatter let a teacher tighten params without forking the sim source.

### Adding a new lab

1. `src/content/experiments/<topic>/<slug>/` with `theory.mdx`, one `phase-<id>.mdx` per phase, and `index.ts` exporting `{ frontmatter, Theory, phaseBodies }`.
2. New topic? Add `src/content/topics/<slug>.ts` with `frontmatter: TopicFrontmatter` (the `id` field must equal the folder name under `experiments/`).
3. New simulation? Add `src/simulations/<id>/` (default-exported component + `meta`) and register it in `src/lib/simulations.ts`.
4. New MDX widget? Implement in `src/lab-guide/widgets/`, export from `widgets/index.ts`, then add it to `mdxComponents` in `src/routes/experiment.tsx` so it's available without explicit imports.

## Conventions

- **Author profile** (SPEC §24): solo physics teacher, intermediate frontend, AI-pair-programming as the working mode. Prefer explicit, plain code over clever abstractions. Flag — don't silently introduce — new patterns, libraries, or framework concepts; the maintainer (a colleague or school IT) needs to be able to read the result without learning a custom DSL.
- **Path alias**: `@/*` → `src/*` (configured in both `tsconfig.json` and `vite.config.ts`). Prefer it over relative paths.
- **Tailwind v3** + custom tokens (`max-w-lab`, `text-navy`, `text-accent`, `instruction-box`, `lab-heading`). Stay on v3 for stability — v4 migration is a config-file swap when the ecosystem catches up.
- **Danish UI strings & author overrides** (SPEC §17): framework defaults live in `src/lab-guide/strings.da.ts` (templates use `{name}` placeholders, substitute via the exported `format()` helper). Widgets exposing student-facing chrome must accept an optional override prop (e.g. `placeholder`, `tooShortMessage`) — see the spec for the convention.
- **Copy/paste protection** is opt-out, not opt-in. Use `ProtectedInput` / `ProtectedTextarea` for student free-text. The escape hatch is per-lab `frontmatter.allowPaste: true` (SEN accommodation) — propagated as the `allowPaste` prop.
- **Numbers**: students enter Danish-formatted numbers (`,` decimal). Use `src/lib/numbers.ts` for parse/format; don't roll your own.
- **Regression**: hand-rolled OLS in `src/lib/regression.ts`. No new dependency for slope/intercept/R².
