---
name: new-simulation
description: Scaffold a new simulation under src/simulations/<id>/ — index.tsx (component), physics.ts (pure helpers), meta.ts (SimulationMeta), and a Vitest stub for physics. Surfaces the registry one-liner for confirmation. Use when the user asks to create a simulation (e.g. "/new-simulation dynamometer-g", "scaffold a sim called pendulum").
---

# new-simulation

Scaffold a new simulation under `src/simulations/<id>/` with the canonical four-file split (component / physics / meta / physics test).

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

After the id, ask **one** AskUserQuestion with two questions:

1. **Update model** (single-select) — how does the simulation's visual state advance?
   - `input-driven` — derived from params on input change only. No animation loop. Best for static-ish sims like dynamometer-g (slider changes → spring indicator moves to `m·g` instantly). Recommended starting point.
   - `animated` — runs a `requestAnimationFrame` loop integrating physics over time (pendulum, projectile, oscillator). Adds a `useEffect` rAF setup with `paused` prop wired up.

2. **Emits milestones?** (single-select) — does the sim fire `onProgress({ type: 'milestone', id })` events that gates can read?
   - `yes` — meta gets a populated `milestones: [...]` array with TODO entries; component has a `fireMilestone()` helper stub.
   - `no` — meta gets `milestones: []`; component still receives `onProgress` but doesn't call it.

## Files to create

Use the templates in `templates/` and substitute `__ID__` (the kebab-case id) and `__TITLE__` (a Title-Cased Danish working title — derive from the id by replacing hyphens with spaces and Title-Casing, e.g. `dynamometer-g` → `Dynamometer G`. The user will rewrite this; keep it as a placeholder).

### 1. `src/simulations/<id>/index.tsx`
Use `templates/index-input-driven.tsx.template` or `templates/index-animated.tsx.template` based on Q1.

The component must:
- Default-export a function component typed `React.FC<SimulationProps>` (or accept `SimulationProps` directly).
- Read `initialParams`, merge with defaults from `meta.defaultParams`.
- Wire `onProgress` (and `onParamChange` if it changes params internally).
- Honour the `paused` prop in animated mode.

### 2. `src/simulations/<id>/physics.ts`
Use `templates/physics.ts.template`. Pure functions only — no React, no DOM. This is the file that gets unit-tested.

Always export at least one placeholder function so the test has something to import (the template provides `noop` as a stand-in — replace with real physics later).

### 3. `src/simulations/<id>/meta.ts`
Use `templates/meta.ts.template`. Substitute `__ID__` and `__TITLE__`.

Include `paramSchema: {}` and `defaultParams: {}` as empty objects — the user fills these in. If Q2 was `yes`, leave `milestones: ['todo-rename-me']` as a single placeholder so it's clear where to expand.

### 4. `tests/unit/simulations/<id>/physics.test.ts`
Use `templates/physics.test.ts.template`. Tests live OUTSIDE `src/` — this matches SPEC §6 layout (line 301). Create the directory if it doesn't exist; bash `mkdir -p` is fine via the Bash tool.

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

> Created `src/simulations/<id>/` (4 files) + `tests/unit/simulations/<id>/physics.test.ts`. Next: implement the physics, fill `paramSchema` and `defaultParams` in `meta.ts`, and reference the sim from a lab via `simulationId: <id>` in frontmatter.

## What NOT to do

- Do not run `npm test`, `npm run lint`, or `npm run build`.
- Do not import anything from `@/sim-runtime/` — that folder is planned in SPEC §6 but not built. Use plain SVG or HTML inside `index.tsx` for now.
- Do not import from `@/lab-guide/`. Ever. The seam is the whole point.
- Do not generate Danish UI strings, equations, or milestone names — they are TODOs.
- Do not create `playground.tsx`. That's a future dev-harness file (SPEC §6); add it manually if you want one.
