---
name: new-simulation
description: Scaffold a new simulation under src/simulations/<id>/ — index.tsx (component), physics.ts (pure helpers), meta.ts (SimulationMeta), optional instruments.ts (apparatus catalogue), and matching Vitest stubs. Surfaces the registry one-liner for confirmation. Use when the user asks to create a simulation (e.g. "/new-simulation dynamometer-g", "scaffold a sim called pendulum").
---

# new-simulation

Scaffold a new simulation under `src/simulations/<id>/` with the canonical file split (component / physics / meta / physics test, optionally + instruments / instruments test).

This skill is **pure structure**. It writes the `SimulationProps`/`SimulationModule` contract and an empty physics module. It does not invent equations, milestones, or UI — those are TODOs.

## The hard rule — do not break the seam

A simulation may import only from:
- `@/sim-contract` (types)
- its own folder (`./physics`, `./meta`)
- `react`, standard libs

**It must not import from `@/lab-guide` or any widget.** This isolation is what lets sims be developed and tested independently (CLAUDE.md, "Three seams — do not cross"). All cross-talk happens through `props.onProgress` and `props.initialParams`. Templates already obey this; do not add a `lab-guide` import while adapting them.

## Inputs

The user types `/new-simulation <id>` where `<id>` is **kebab-case** (lowercase letters, digits, hyphens — e.g. `dynamometer-g`, `pendulum`, `rc-circuit`). If they don't supply an id, ask for it.

Validate: if the id contains uppercase, underscore, or anything else, ask for a kebab-case version. The id becomes the folder name AND the `simulationId` referenced from lab frontmatter — they must match.

After the id, ask **one** AskUserQuestion with four questions:

1. **Mode** (single-select) — written into `meta.mode`. **Default: `interactive`.** Display-only is the explicit exception; only pick it for a true read-only renderer.
   - `interactive` — the sim owns its controls (sliders, dropdowns, buttons) and drives its own animation if applicable. The lab-guide MDX focuses on observation widgets (NumericAnswer, MultipleChoice). This is the expected mode for new sims (pendul, projektil, RC-circuit, decay, induction, …).
   - `display` — read-only renderer driven entirely by `initialParams` from the lab guide. The lab guide owns the parameter controls. Static-lookup sims like dynamometer-g, where the apparatus just shows `m·g` for whatever mass the lab supplies. Rare — if you find yourself reaching for it more than once, raise it before continuing.

2. **Update model** (single-select) — how does the simulation's visual state advance?
   - `input-driven` — derived from params on input change only. No animation loop. Always the right choice for `mode: display` sims, and fine for interactive sims whose physics is instantaneous.
   - `animated` — runs a `requestAnimationFrame` loop integrating physics over time (pendulum, projectile, oscillator). Adds a `useEffect` rAF setup with `paused` prop wired up. Only meaningful for `mode: interactive`.

3. **Emits milestones?** (single-select) — does the sim fire `onProgress({ type: 'milestone', id })` events that gates can read?
   - `yes` — meta gets a populated `milestones: [...]` array with TODO entries; component has a `fireMilestone()` helper stub.
   - `no` — meta gets `milestones: []`; component still receives `onProgress` but doesn't call it.

4. **Apparatus catalogue?** (single-select) — does the sim pick from a fixed enum of named instruments / variants (e.g. `dynamometer-1N` / `dynamometer-5N` / …, or `surface-wood` / `surface-glass`)?
   - `yes` — scaffold a sibling `instruments.ts` holding a `Record<string, Spec>` table; `meta.ts` derives its enum `values` from `Object.keys(...)` so the two never drift.
   - `no` — omit `instruments.ts`. Pure continuous-param sims (e.g. a single-pendulum with length/mass/angle sliders) don't need it.

## Files to create

Use the templates in `templates/` and substitute `__ID__` (the kebab-case id) and `__TITLE__` (a Title-Cased Danish working title — derive from the id by replacing hyphens with spaces and Title-Casing, e.g. `dynamometer-g` → `Dynamometer G`. The user will rewrite this; keep it as a placeholder).

### 1. `src/simulations/<id>/index.tsx`
Use `templates/index-input-driven.tsx.template` or `templates/index-animated.tsx.template` based on Q2 (update model).

The component must:
- Default-export a function component typed `React.FC<SimulationProps>` (or accept `SimulationProps` directly).
- Read `initialParams`, merge with defaults from `meta.defaultParams`.
- Wire `onProgress` (and `onParamChange` if it changes params internally).
- Honour the `paused` prop in animated mode.

### 2. `src/simulations/<id>/physics.ts`
Use `templates/physics.ts.template`. Pure functions only — no React, no DOM, **no data tables**. This is the file that gets unit-tested.

Always export at least one placeholder function so the test has something to import (the template provides `noop` as a stand-in — replace with real physics later).

### 3. `src/simulations/<id>/instruments.ts` (only if Q4 was `yes`)
Use `templates/instruments.ts.template`. This file is the single source of truth for the apparatus enum — `meta.ts` imports `DYNAMOMETERS` (or whatever you rename it to) and derives `values: Object.keys(...)`, so the schema list and the data table can never drift.

Pattern: `as const satisfies Record<string, Spec>` — gives you a literal-typed map plus a derived `Id = keyof typeof ...` union. The template uses `INSTRUMENTS` / `InstrumentSpec` / `InstrumentId` as placeholder names; rename to the apparatus (e.g. `DYNAMOMETERS` / `DynamometerSpec` / `DynamometerId`).

Skip this file for pure continuous-param sims with no apparatus catalogue.

### 4. `src/simulations/<id>/meta.ts`
Use `templates/meta.ts.template`. Substitute `__ID__`, `__TITLE__`, and `__MODE__` (the Q1 answer — `'interactive'` or `'display'`).

If Q4 was `yes`, also import the instruments map and use `Object.keys(INSTRUMENTS)` for the enum's `values` — see the commented example in the template. Otherwise leave `paramSchema: {}` and `defaultParams: {}` as empty objects.

If Q3 was `yes`, leave `milestones: ['todo-rename-me']` as a single placeholder so it's clear where to expand.

### 5. `tests/unit/simulations/<id>/physics.test.ts`
Use `templates/physics.test.ts.template`. Tests live OUTSIDE `src/` — this matches SPEC §6 layout (line 301). Create the directory if it doesn't exist; bash `mkdir -p` is fine via the Bash tool.

If Q4 was `yes`, also create a sibling `tests/unit/simulations/<id>/instruments.test.ts` so the catalogue table gets its own consistency tests (cross-checking `meta.paramSchema` enum values against the `INSTRUMENTS` map). The user fills in apparatus-specific invariants.

## Registry edit — surface, don't apply

After writing the four files, **do not edit** `src/lib/simulations.ts` automatically. Print this exactly to the user:

> One registry edit is needed. I have **not** applied it — confirm and I'll do it:
>
> **`src/lib/simulations.ts`** — add this entry to `simulationRegistry` (alphabetical by id):
> ```ts
> '<id>': () => import('@/simulations/<id>'),
> ```
>
> The folder's `index.tsx` re-exports `default` and `meta` so this dynamic import resolves to a `SimulationModule`. (You may need to adjust if you switch to a barrel `index.ts` later.)
>
> Apply this edit?

Wait for explicit yes before using Edit. Place the entry alphabetically. Note: the registry currently has only a comment — the first real entry just goes inside the empty object.

## Wiring note (mention this once, briefly)

`SimulationModule` requires `default` (the component) and `meta` (the SimulationMeta). The dynamic import `import('@/simulations/<id>')` resolves to whatever `<id>/index.tsx` re-exports. The template's last lines are:

```ts
export { meta } from './meta';
export default Component;
```

Do not move `meta` into `index.tsx`. Keeping it in `meta.ts` lets future tooling read it without parsing the React module.

## After applying (or skipping) the registry edit

End with one sentence listing what was created, then suggest the next step:

> Created `src/simulations/<id>/` (3–4 files: index/physics/meta, plus instruments.ts if Q4 was yes) + matching tests under `tests/unit/simulations/<id>/`. Next: implement the physics, fill `paramSchema` and `defaultParams` in `meta.ts`, populate `instruments.ts` if applicable, and reference the sim from a lab via `simulationId: <id>` in frontmatter.

## What NOT to do

- Do not run `npm test`, `npm run lint`, or `npm run build`.
- Do not import anything from `@/sim-runtime/` — that folder is planned in SPEC §6 but not built. Use plain SVG or HTML inside `index.tsx` for now.
- Do not import from `@/lab-guide/`. Ever. The seam is the whole point.
- Do not generate Danish UI strings, equations, or milestone names — they are TODOs.
- Do not create `playground.tsx`. That's a future dev-harness file (SPEC §6); add it manually if you want one.
