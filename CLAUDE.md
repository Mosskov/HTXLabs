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
npm run verify       # lint + one-shot tests + production build
```

CI (`.github/workflows/deploy.yml`) runs `lint` → `test -- --run` → `build` and deploys `dist/` to GitHub Pages. The workflow is **manual-only** (`workflow_dispatch`) — trigger it from the Actions tab when you want to deploy. The build sets `BASE_URL=/<repo>/` for project pages; clear it (and add `public/CNAME`) for a custom domain.

## Architecture

The codebase is a **framework + content** split. Authors add labs as MDX content; the framework renders them.

### Three seams — do not cross

1. **`src/lab-guide/`** — the LabGuide framework: state shape + persistence (`runner.ts`), pure transitions (`runnerReducer.ts`), gate evaluation (`gates.ts`), React context (`RunnerContext.tsx`), top-level component (`LabGuide.tsx`), phase stepper/footer, MDX widgets (`widgets/`). This is the only thing routes mount.
2. **`src/sim-contract/index.ts`** — the only module a simulation may import from outside its own folder. Defines `SimulationProps`, `SimulationModule`, `ProgressEvent`, `SimulationMeta`. **Simulations must not import from `lab-guide/`.** This isolation is what lets sims be developed and tested independently.
3. **`src/content/`** — pure content. Each experiment is `experiments/<topic>/<slug>/index.ts` exporting `frontmatter` (validated against `ExperimentFrontmatter` from `src/lib/schema.ts`), `Theory` (the theory MDX), and `phaseBodies` (a record of phase id → MDX component). Topics are `topics/<slug>.ts`.

Content is auto-discovered at build time via `import.meta.glob` in `src/lib/content.ts` — adding a new lab requires no registry edits. Frontmatter is Zod-validated at module-load; a malformed lab fails dev startup, not runtime.

### Simulation registry

`src/lib/simulations.ts` maps `simulationId` → lazy importer. Each sim ships as its own JS chunk, dynamic-imported when its lab opens. The sentinel id `NO_SIMULATION` (`'__none'`, exported from `sim-contract`) means "no simulation" (used by content scaffolds and `Hej, Verden`). Per-lab `simulationOverrides.defaultParams` in frontmatter let a teacher tweak the sim's starting values without forking the sim source.

### Seam-specific rules

Detailed rules for each seam live in nested `CLAUDE.md` files and load on demand when you open files under that path:

- [src/lab-guide/CLAUDE.md](./src/lab-guide/CLAUDE.md) — lab page anatomy, state/persistence/gates, widget conventions (Danish strings, copy/paste protection).
- [src/sim-contract/CLAUDE.md](./src/sim-contract/CLAUDE.md) — the contract lock.
- [src/simulations/CLAUDE.md](./src/simulations/CLAUDE.md) — sim-Danish convention.
- [src/content/CLAUDE.md](./src/content/CLAUDE.md) — adding-a-new-lab checklist.

## Conventions

- **Author profile** (SPEC §24): solo physics teacher, intermediate frontend, AI-pair-programming as the working mode. Prefer explicit, plain code over clever abstractions. Flag — don't silently introduce — new patterns, libraries, or framework concepts; the maintainer (a colleague or school IT) needs to be able to read the result without learning a custom DSL.
- **Module-purpose headers**: every `src/**/*.{ts,tsx}` starts with one `//` comment line stating its role (e.g. `// Pure gate evaluation: GATE_HANDLERS, isGateSatisfied, canAdvanceTo.`). Mechanical, not prose; if removing the line wouldn't confuse a reader, the header was redundant — rewrite or drop. No CI check; convention enforced by review.
- **Path alias**: `@/*` → `src/*` (configured in both `tsconfig.json` and `vite.config.ts`). Prefer it over relative paths.
- **Tailwind v3** + custom tokens (`max-w-lab`, `text-navy`, `text-accent`, `instruction-box`, `lab-heading`). Stay on v3 for stability — v4 migration is a config-file swap when the ecosystem catches up.
- **Numbers**: students enter Danish-formatted numbers (`,` decimal). Use `src/lib/numbers.ts` for parse/format; don't roll your own.
- **Regression**: hand-rolled OLS in `src/lib/regression.ts`. No new dependency for slope/intercept/R².
- **Keep CLAUDE.md in sync**: when a change renames a referenced file, alters a convention, or introduces a new pattern, update the matching `CLAUDE.md` (root for cross-cutting, nested for seam-specific) in the same commit. Stale rules are worse than missing ones.
