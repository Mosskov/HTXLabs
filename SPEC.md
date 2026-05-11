# SPEC.md — HTXLabs-style Physics Lab Platform

> This is the spec. After plan approval, the first execution step is to copy this file to `SPEC.md` at the project root.

---

## 1. Overview

A static, GitHub-Pages-hosted educational website for Danish HTX physics students, modelled visually on htxlabs.dk. Each "lab" is a multi-phase guided experience that combines short theory, an interactive simulation, data collection, analysis, and reflection. Every lab inherits a generic **LabGuide framework** that the author composes via MDX content + a per-lab simulation. Designed and authored by a single physics teacher with graduate-level Python/NumPy experience but limited frontend background; must remain approachable for a colleague or school IT to take over.

### Goals
1. **Build intuition before measurement.** Students play with a simulation to surface relevant variables, then verify on real equipment.
2. **One framework, many labs.** A new lab = one MDX file + one simulation folder. No framework changes per lab.
3. **Honest physics measurement.** Students read analog instruments visually, manage decimal conventions, compute relative differences against known constants.
4. **Run on GitHub Pages.** No backend, no database, no auth at MVP. All client-side.
5. **Replaceable maintainer.** Stack + conventions documented; a colleague with similar skill can take over.

### Non-goals (MVP)
- User accounts / cloud-saved progress
- Class-level analytics or teacher dashboards
- Class-time assignment / deadlines / grading
- Multilingual (Danish only)
- Mobile-/phone-first design (laptop is primary; tablets work)

---

## 2. Pedagogical model

A lab page has three stacked sections: **Theory** (Formål, Teori, Nøgleligning) → **Simulation** (collapsible, persistent across phases) → **Laboratorieguide** (the 7-phase guided flow). The theory and simulation are not phases — they are reference resources the student can consult at any time. The laboratorieguide is where progression and gating happen.

The 7 phases:

| # | Phase (DK)  | Purpose                                                                                                         |
|---|-------------|-----------------------------------------------------------------------------------------------------------------|
| 1 | Planlæg     | Identify variables (independent/dependent/constants), form a hypothesis. Validates against expected answers.    |
| 2 | Opstil      | Materials checklist (from equipment library), setup sketch, self-check tjekliste of preparation steps.          |
| 3 | Mål         | Data collection. Constants table + measurements table. Validation: minimum N "valid" measurements + filled constants. |
| 4 | Analysér    | Pick x/y axes, plot, optionally show linear regression / R² / force-through-zero. Compare to theoretical value. |
| 5 | Diskutér    | Long-form discussion: do results match the hypothesis, sources of error, what would you change. Multiple reflection questions live here. |
| 6 | Konkludér   | One short conclusion statement. Forces students to compress the lab to its essence — not the place for elaboration. |
| 7 | Rapportér   | Output curation. Student selects which sections (theory, hypothesis, data, plot, discussion, conclusion) to include in their personal lab-journal export (PDF + CSV). |

Phases are **gated**: progression is blocked until each gate is satisfied. Gates can require: a batch-check button passed (variable identification), keyword-count threshold (hypothesis), milestone from the simulation, N valid data points, all reflections answered, or a custom predicate. Backwards navigation is always free; forwards is gated. Some phases use **explicit "Tjek X" buttons** (batch validation) rather than live-as-you-type checking — this matches how a student would actually pause and ask the framework "did I get it right?"

Three **inquiry modes** layered onto the same lab — the framework treats `mode` as a top-level dimension that can vary phases, gates, and content:

- **Guided** (MVP focus) — full scaffolding, instructions, hint progressions
- **Semi-guided** (later) — fewer hints, more open hypothesis prompts
- **Open** (later) — minimal scaffolding, student determines method, gates loosened to "phase visited"

Each lab also has a **virtual / real-lab toggle** that changes which content surfaces in the equipment-and-procedure phases:
- **Virtual**: phase 2 (Opstil) hides the materials checklist and setup sketch — there is no physical apparatus to lay out. Phase 3 (Mål) takes measurements from the simulation.
- **Real**: phase 2 shows the materials checklist (sourced from the equipment library) and the setup sketch. Phase 3 follows the real-equipment procedure; the simulation remains visible above the guide as a reference.

Phases 1, 4, 5, 6, and 7 are identical across virtual and real modes.

---

## 3. User personas

| Persona | Notes |
|---|---|
| **HTX student (primary)** | 16–19 yr old, on personal laptop or Mac, Danish-speaking, varying physics ability. Uses the lab during a class period or at home. |
| **Physics teacher (you, the author)** | Owns the repo. Authors content in MDX. Configures equipment in JSON. Pulls in colleagues occasionally. |
| **Future colleague / school IT (maintainer)** | Inherits the project. Familiar with React conventions. Should not need to learn a custom DSL. |

---

## 4. User journeys

### J1 — Student does a guided lab (happy path)
1. Lands on `/` → sees topic cards (Mekanik, Energi, …)
2. Clicks Mekanik → clicks "Bestemmelse af g med dynamometer"
3. Lab page loads. Reads theory (Formål, Centrale begreber, Nøgleligning, Teori) at the top of the page.
4. Plays with the simulation (collapsible card below the theory). Adjusts mass slider, switches dynamometer, types readings. Discovers experimentally that the 50 N range is too coarse for small masses.
5. Scrolls to **Laboratorieguide** below the simulation. (Defaults to Guided; mode is set via the `?mode=` URL param — no in-page picker UI in MVP.)
6. **Phase 1 — Planlæg**: fills 9 variable-identification fields (Uafhængig variabel: masse / m / kg, etc.). Clicks "Tjek variable" → "Korrekte svar: 7 / 9" + orange hint reveals. Adjusts and clicks again → 9/9, fields turn green. Writes hypothesis in textarea. Clicks "Tjek hypotese" → "Nøgleord fundet: 2 / 2". "Næste fase" enables.
7. **Phase 2 — Opstil**: ticks materials and tjekliste checkboxes; "Næste fase" enables.
8. **Phase 3 — Mål**: types known constants into Konstanter table; types measurements (m, F) into Målinger table while reading the simulation's spring scale. Auto-validation: rows with both m and F filled count as "gyldige". "Gyldige målinger: 5 / 6". "Næste fase" enables once min threshold and constants are filled.
9. **Phase 4 — Analysér**: picks masse as x-axis, kraft as y-axis; ticks "Vis lineær regression" + "Tving gennem nul"; reads slope; types it into "Din målt værdi" → framework shows comparison to "Teoretisk værdi: 9,82 m/s²".
10. **Phase 5 — Diskutér**: writes long-form answers to the 4 discussion questions (hypothesis match, sources of error, repeat-improvements). Try to paste a chunk from somewhere → blocked, toast "Indsæt er deaktiveret".
11. **Phase 6 — Konkludér**: writes one short conclusion sentence. Clicks "Næste fase".
12. **Phase 7 — Rapportér**: ticks which sections to include (theory snippet, hypothesis, data table, plot, discussion answers, conclusion). Clicks "Download som PDF" (print stylesheet) and/or "Download data som CSV". Clicks "Afslut guide".
13. Closes tab. Next day reopens → resumes at last phase (localStorage).

### J2 — Student in real-lab mode
Same as J1, but in step 8 the lab shows the equipment list (with future image support) and procedure instead of the simulation. Student types real measurements into the same table. Phase 5 onwards is identical.

### J3 — Teacher updates a lab while students have progress
Teacher fixes a typo in phase 2 (no structural change) → students unaffected.
Teacher renames a quiz id `q1` → `hypotese-1` → on next visit, framework detects unknown phase/quiz IDs in saved state, silently restarts that lab's progress (auto-detect-and-restart per your decision).

### J4 — Maintainer takes over
Clones repo. Runs `npm install && npm run dev`. Opens `src/lab-guide/` and `src/simulations/dynamometer-g/`. Adds a new lab by copying an existing one and editing the MDX + the simulation folder.

---

## 5. Information architecture

### URLs (all static, GitHub-Pages-friendly)
```
/                                                   home
/emner                                              all topics
/emner/:topic                                       topic landing (e.g. /emner/mekanik)
/emner/:topic/:experiment                           lab page
/emner/:topic/:experiment?mode=guided               mode is URL-controlled (guided | semi-guided | open; defaults to guided)
                                                    ?lab=virtual|real designed-for, not yet wired (revisit when <Equipment> lands)
/simulationer                                       standalone sim playground index
/simulationer/:simulationId                         standalone sim harness
/about                                              optional
```

Phase navigation within a lab uses the URL **hash**: `…/dynamometer-g#fase=hypotese`. Mode and lab-mode are query parameters so they're shareable in a link.

### Content model
```
src/content/
  topics/
    mekanik.mdx                      # topic landing copy
    energi.mdx
    …
  experiments/
    mekanik/
      dynamometer-g.mdx              # one MDX file per lab; frontmatter declares phases
      …
  equipment/
    library.json                     # shared equipment library
    images/                          # optional: equipment photos
```

### Frontmatter schema (Zod)
```ts
const Gate = z.discriminatedUnion('type', [
  z.object({ type: z.literal('always') }),
  z.object({ type: z.literal('milestone'), requires: z.string() }),
  z.object({ type: z.literal('data-points'), min: z.number().int() }),
  z.object({ type: z.literal('all-correct'), widgetIds: z.array(z.string()) }),    // batch-check widgets all passed
  z.object({ type: z.literal('all-checked'), widgetIds: z.array(z.string()) }),    // checklist widgets all ticked
  z.object({ type: z.literal('all-filled'), widgetIds: z.array(z.string()) }),     // reflections / inputs all non-empty
  z.object({
    type: z.literal('keyword-count'),
    widgetId: z.string(),
    /** Threshold of matched keyword-groups required. `'all'` means the widget
     * must report `foundCount === total` (every group hit at least once);
     * a numeric value enables partial credit (e.g. 3 of 5 groups). */
    min: z.union([z.number().int(), z.literal('all')]),
  }),
  z.object({
    type: z.literal('predicate'),
    name: z.string(),
    /** Author override for the locked-phase message (§27). Falls back to the
     * generic Danish prompt when omitted. */
    message: z.string().optional(),
  }),
]);

const Phase = z.object({
  id: z.string(),
  title: z.string(),
  intro: z.string().optional(),       // text shown in the light-blue instruction box at the top of the phase
  gate: Gate.default({ type: 'always' }),
});

const ExperimentFrontmatter = z.object({
  version: z.number().int().default(1),
  title: z.string(),
  topic: z.string(),
  simulationId: z.string(),

  // Per-lab override of the simulation's default starting values.
  // Used when a teacher wants a different opening mass for one lab without changing the simulation source.
  simulationOverrides: z.object({
    defaultParams: z.record(z.number()).optional(),
  }).optional(),

  learningObjectives: z.array(z.string()).min(1),
  keyConcepts: z.array(z.string()),
  difficulty: z.enum(['intro','core','advanced']).default('core'),

  // Inquiry modes — each mode declares its own phase list. Guided is required for MVP.
  modes: z.object({
    guided: z.object({ phases: z.array(Phase).min(1) }),
    'semi-guided': z.object({ phases: z.array(Phase).min(1) }).optional(),
    open: z.object({ phases: z.array(Phase).min(1) }).optional(),
  }),

  // Lab mode — virtual is default; real is opt-in.
  labModes: z.object({
    virtual: z.object({ enabled: z.boolean().default(true) }),
    real: z.object({
      enabled: z.boolean().default(false),
      equipment: z.array(z.string()).optional(),
      procedure: z.string().optional(),
    }).optional(),
  }),

  tags: z.array(z.string()).default([]),
});
```

A second module-load validation (`validateAuthorableGates` in [src/lib/content.ts](./src/lib/content.ts)) rejects gate kinds whose widget/sim wiring isn't implemented in this build — currently the authorable allowlist is `{always, all-correct, all-checked, all-filled, keyword-count}`. The unimplemented kinds (`milestone`, `data-points`, `predicate`) stay in the Zod union and the gate engine — flipping one from "experimental" to "authorable" is a one-line edit once the corresponding sim hook (`ProgressEvent`, `gates` map) lands. Future iteration: per-sim capability matching (consult the resolved `SimulationModule.gates` / `meta.milestones`) and an equipment-ID cross-check against `library.json`.

---

## 6. Tech stack

| Concern | Choice | Why for this project |
|---|---|---|
| **Build/runtime** | **Vite + React 18 + TypeScript** | Tiny config, fast dev server, simple mental model. Better than Next.js here because (a) GitHub Pages is static-only, (b) you don't need SSR, (c) Vite's mental model is closer to the Python/Vite world a numerical scientist already half-knows. Easier for a colleague to inherit than App Router's nuances. |
| **Routing** | **react-router v6** | Standard, well-documented. Nested routes match the topic→experiment hierarchy. |
| **Content** | **MDX** via `@mdx-js/rollup` + `gray-matter` for frontmatter + **Zod** for validation | Markdown-with-React. Build-time validated. Free. Version-controlled. |
| **Math rendering** | **KaTeX** (`rehype-katex` + `remark-math`) | LaTeX in MDX (`$F = m \cdot g$`). |
| **Styling** | **Tailwind CSS v3** + **shadcn/ui** | Match htxlabs.dk's clean card style. shadcn gives accessible primitives (Card, NavigationMenu, Tabs, Dialog) you copy into the repo (no npm dep) — easy to customise. v3 is preferred over v4 for stability and broader colleague familiarity; migration to v4 is a single config-file change if/when the ecosystem fully catches up. |
| **Plotting** | **uPlot** | Tiny (~40 KB), fast, sufficient for scatter + line of fit. Alternative: visx if you need more flexibility later. |
| **Linear regression** | Hand-rolled in `src/lib/regression.ts` (~30 LOC) | No dep needed. OLS slope/intercept/R² is trivial. |
| **Hashing** | Web Crypto API (`crypto.subtle.digest('SHA-256', …)`) | Built-in browser API. No dep. Used for light obfuscation of MCQ answers. |
| **Tests** | **Vitest** (unit) + **Playwright** (E2E) | Vitest for `physics.ts` and `gates.ts`; Playwright for end-to-end gating + persistence smoke. |
| **Lint/format** | **Biome** | Single binary, faster than ESLint+Prettier, less config. |
| **CI/CD** | **GitHub Actions** → `gh-pages` branch | Free. One workflow file. |
| **Analytics** | **Plausible** (free hobby tier) or none initially | Cookie-less. GDPR-fine. Optional. |

### What I am NOT recommending and why
- **Next.js** — App Router static-export has sharp edges; routing and image conventions add complexity you don't need on GH Pages.
- **Astro** — fine, but its islands story for stateful sims has friction, and the user base is smaller (worse for "colleague takes over").
- **Monorepo (pnpm workspaces / Turborepo)** — overkill for a solo author. Folders > packages here. Re-evaluate if/when a second app appears.
- **A heavy physics engine** — your numerical background means hand-written ODE integration is clearer and lighter than matter-js for this domain.
- **A headless CMS** — MDX-in-repo is what you chose; CMS adds operational cost with no payoff for a single author.
- **Auth / database** — explicitly out of scope. Designed-around but not built.

---

## 7. Repository structure

```
htxlabs/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx                          # router setup
│   ├── routes/
│   │   ├── home.tsx
│   │   ├── topics/index.tsx
│   │   ├── topics/[topic].tsx
│   │   ├── topics/[topic]/[experiment].tsx
│   │   └── simulationer/[simId].tsx     # standalone sim playground
│   ├── lab-guide/                       # ★ THE FRAMEWORK
│   │   ├── LabGuide.tsx                 # top-level component
│   │   ├── PhaseStepper.tsx             # numbered-circle progress
│   │   ├── PhaseFooter.tsx              # Forrige/Næste + gate message
│   │   ├── ModeSwitcher.tsx             # Guided/Semi/Open + Virtual/Real
│   │   ├── runner.ts                    # state machine, localStorage
│   │   ├── gates.ts                     # pure gate evaluation
│   │   ├── version.ts                   # version-mismatch detection
│   │   ├── widgets/
│   │   │   ├── KeyEquation.tsx          # lavender callout for the Nøgleligning section
│   │   │   ├── VariableIdentification.tsx  # phase 1 — uafhængig/afhængig/konstanter form
│   │   │   ├── HypothesisInput.tsx      # phase 1 — keyword-counted free-text
│   │   │   ├── MaterialsList.tsx        # phase 2 — equipment-library-sourced checklist
│   │   │   ├── SetupSketch.tsx          # phase 2 — diagram of the experimental setup
│   │   │   ├── PreparationChecklist.tsx # phase 2 — self-check tjekliste
│   │   │   ├── ConstantsTable.tsx       # phase 3 — known-constants table
│   │   │   ├── DataTable.tsx            # phase 3 — measurements table; manual entry only
│   │   │   ├── Reading.tsx              # paired with LinearScale in sim
│   │   │   ├── Plot.tsx                 # phase 4 — scatter + axis selectors + regression toggles
│   │   │   ├── NumericAnswer.tsx        # phase 4 — numeric input + tolerance
│   │   │   ├── Reflection.tsx           # phase 5 Diskutér — guided free-text question
│   │   │   ├── ConclusionStatement.tsx  # phase 6 Konkludér — char-limited single textarea
│   │   │   ├── ReportComposer.tsx       # phase 7 Rapportér — section-picker + PDF/CSV export
│   │   │   ├── ShowSolution.tsx         # optional model-answer reveal (Diskutér)
│   │   │   ├── CSVExport.tsx            # standalone CSV button (used inside ReportComposer)
│   │   │   ├── Equipment.tsx            # equipment cards (real-lab mode)
│   │   │   ├── ProtectedInput.tsx       # input primitive with copy/paste blocking
│   │   │   ├── ProtectedTextarea.tsx    # textarea primitive with copy/paste blocking
│   │   │   └── index.ts                 # mdx component registry
│   │   └── slots.ts                     # standard phase types
│   ├── sim-contract/
│   │   └── index.ts                     # SimulationProps, SimulationModule, ProgressEvent
│   ├── sim-runtime/
│   │   ├── useAnimationLoop.ts          # rAF hook
│   │   ├── LinearScale.tsx              # SVG vertical spring-scale primitive (tick marks, red indicator)
│   │   ├── HangingMass.tsx              # hook + block visual with value badge
│   │   ├── Slider.tsx                   # styled numeric slider with min/max + DK-formatted value
│   │   ├── DynamometerSelect.tsx        # dropdown sourced from equipment library
│   │   ├── CollapsiblePanel.tsx         # "Skjul simulation" toggle wrapper
│   │   ├── ResetButton.tsx
│   │   └── math.ts                      # vectors, integrators
│   ├── simulations/
│   │   └── dynamometer-g/
│   │       ├── index.tsx                # default export = sim component
│   │       ├── physics.ts               # pure functions (unit-tested)
│   │       ├── meta.ts                  # SimulationMeta + milestones
│   │       └── playground.tsx           # optional per-sim harness (not used today — route-level /simulationer covers it)
│   ├── content/
│   │   ├── topics/mekanik.mdx
│   │   └── experiments/
│   │       └── mekanik/dynamometer-g.mdx
│   ├── equipment/
│   │   ├── library.json
│   │   └── images/                      # optional, future
│   ├── lib/
│   │   ├── content.ts                   # MDX loader + Zod
│   │   ├── simulations.ts               # registry: id -> dynamic import
│   │   ├── hash.ts                      # sha256(text)
│   │   ├── regression.ts                # OLS slope/intercept/R²
│   │   ├── numbers.ts                   # DK decimal parsing/formatting
│   │   └── csv.ts                       # client-side CSV builder
│   └── styles/
│       └── globals.css                  # Tailwind base, shadcn vars
├── tests/
│   ├── unit/
│   │   ├── gates.test.ts
│   │   ├── regression.test.ts
│   │   ├── numbers.test.ts
│   │   └── simulations/dynamometer-g/physics.test.ts
│   └── e2e/
│       └── dynamometer-g.spec.ts
├── .github/workflows/deploy.yml
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── biome.json
├── package.json
└── SPEC.md                              # this file
```

---

## 8. The LabGuide framework

A single `<LabGuide>` component composes everything. Every lab page is shallow:

```tsx
// src/routes/topics/[topic]/[experiment].tsx
import { LabGuide } from '@/lab-guide/LabGuide';
import { loadExperiment } from '@/lib/content';
import { simulationRegistry } from '@/lib/simulations';

export default function ExperimentRoute({ params }) {
  const exp = loadExperiment(params.topic, params.experiment);  // build-time validated
  const Sim = simulationRegistry[exp.simulationId];             // lazy dynamic import
  return <LabGuide experiment={exp} simulation={Sim} />;
}
```

`<LabGuide>` is the entire lab page. It composes three vertically-stacked sections:

1. **Theory section** — renders the leading MDX content (Formål, Centrale begreber, Nøgleligning, Teori). Always visible at the top of the page. Not a phase; not gated; never collapses.
2. **Simulation panel** (`<SimulationPanel>`) — collapsible card with "Skjul simulation" header. The simulation is **mounted once** for the whole lab and stays mounted across phase changes; only its visibility toggles. Per-lab `simulationOverrides` from frontmatter are passed in.
3. **Laboratorieguide section** — heading "Laboratorieguide", then:
   - **Phase stepper** (`<PhaseStepper>`) — numbered circles 1–5 connected by lines. Completed = ✓ in filled blue circle. Current = number in filled blue circle. Future = number in grey circle. Locked phases show no extra icon (just grey) and clicks are no-ops with a tooltip explaining what's missing.
   - **Instruction box** — light-blue rounded card at the top of each phase's body, showing the phase's `intro` text (1–3 numbered steps, authored in frontmatter).
   - **Phase content** — full-width MDX rendered with widgets in scope.
   - **Phase footer** (`<PhaseFooter>`) — three regions:
     - Left: "← Forrige fase" link (always available except phase 1, where it's replaced by "← Skift undersøgelsesform").
     - Middle: phase-specific batch-check buttons (e.g. "Tjek variable", "Tjek hypotese") that the widgets register.
     - Right: "Næste fase →" (or "Afslut guide" on the final phase). Disabled until gate passes; tooltip explains why.
4. **Persistence** — `runner.ts` writes state to `localStorage['htxlabs:state:${experimentId}']` on every change.
5. **Version + structure check** — on mount, framework validates saved state against current frontmatter; mismatch → wipe that lab's storage silently and start fresh (`console.info`, no banner).

### Inheritance / extension
A typical lab does **not** customise the framework — pure MDX is enough.
For the rare lab that needs custom widgets:
```tsx
<LabGuide
  experiment={exp}
  simulation={Sim}
  components={{ MyCustomWidget: CustomWidget }}    // available in MDX
  phaseRenderers={{ derivation: DerivationPhase }} // override a phase by id
/>
```

---

## 9. Phase model & gates

### State
```ts
type RunnerState = {
  experimentId: string;                     // `${topic}/${slug}`
  experimentVersion: number;
  mode: 'guided' | 'semi-guided' | 'open';
  labMode: 'virtual' | 'real';
  currentPhaseId: string;
  visitedPhaseIds: Set<string>;
  firedMilestones: Record<string, Set<string>>; // sim ProgressEvent('milestone') sink, phase-scoped
  dataPointCount: Record<string, number>;       // sim ProgressEvent('data-collected') sink, phase-scoped
  widgetValues: Record<string, unknown>;    // per-widget freeform value bag
                                            // (widgets MAY use `${id}:<suffix>` sibling
                                            //  keys for ephemeral state, e.g. Quiz's
                                            //  `${id}:checked`); see runner.ts
  dataTables: Record<string, DataRow[]>;    // <DataTable> rows, keyed by table id
  attemptCounts: Record<string, number>;    // for retry-limited widgets
};
```

Persisted to `localStorage['htxlabs:state:${experimentId}']`. Wiped silently if `experimentVersion` differs from frontmatter (auto-detect-and-restart per §14).

### Gate evaluation (pure)
Widgets register live state into a ref-backed `GateCtx.widgets` map (kind-tagged: `correct | checked | filled | keywords`); the gate engine reads from there rather than from React state, so widget edits don't cascade through the runner.

```ts
type GateCtx = {
  widgets: Record<string, WidgetState>;     // kind-tagged live snapshot
  simulationStateRef: { current: unknown }; // for predicate gates
};

function isGateSatisfied(gate: Gate, s: RunnerState, mod: SimulationModule | undefined, ctx: GateCtx, phaseId: string): boolean {
  // Open mode: gates are unconditionally satisfied (inquiry-mode convention;
  // authors don't repeat themselves). Guided / semi-guided run the actual gate.
  if (s.mode === 'open') return true;

  // Sim-driven `milestone` and `data-points` gates evaluate against the
  // *current phase's* bucket so free-play exploration on phase A can't pre-tick
  // a gate on phase B. `predicate` stays global — it reads instantaneous sim
  // state, not history.
  switch (gate.type) {
    case 'always':        return true;
    case 'milestone':     return s.firedMilestones[phaseId]?.has(gate.requires) ?? false;
    case 'data-points':   return (s.dataPointCount[phaseId] ?? 0) >= gate.min;
    case 'all-correct':   return gate.widgetIds.every(id => ctx.widgets[id]?.kind === 'correct'  && ctx.widgets[id].correct);
    case 'all-checked':   return gate.widgetIds.every(id => ctx.widgets[id]?.kind === 'checked'  && ctx.widgets[id].allChecked);
    case 'all-filled':    return gate.widgetIds.every(id => ctx.widgets[id]?.kind === 'filled'   && ctx.widgets[id].filled);
    case 'keyword-count': {
      const w = ctx.widgets[gate.widgetId];
      if (w?.kind !== 'keywords') return false;
      return gate.min === 'all' ? w.foundCount === w.total : w.foundCount >= gate.min;
    }
    case 'predicate':     return mod?.gates?.[gate.name]?.(ctx.simulationStateRef.current) ?? false;
  }
}

function canAdvanceTo(targetPhaseId: string, phases: Phase[], s: RunnerState, mod: SimulationModule | undefined, ctx: GateCtx): boolean {
  const targetIdx = phases.findIndex(p => p.id === targetPhaseId);
  const currentIdx = phases.findIndex(p => p.id === s.currentPhaseId);
  if (targetIdx < 0 || currentIdx < 0) return false;

  // Backward / current: always reachable (free backward navigation).
  if (targetIdx <= currentIdx) return true;

  // Forward: every gate from current up to (but not including) target must
  // pass right now. A previously-satisfied gate that flipped back to false
  // (e.g. student emptied a required answer) re-locks any leap over it.
  for (const p of phases.slice(currentIdx, targetIdx)) {
    if (!isGateSatisfied(p.gate, s, mod, ctx)) return false;
  }

  // Visited future phase → free leap (the work is preserved). Unvisited →
  // only the immediate next phase, no leap-frogging past intermediate steps.
  if (s.visitedPhaseIds.has(targetPhaseId)) return true;
  return targetIdx === currentIdx + 1;
}
```

Open-mode gates are loosened to `{ type: 'always' }` automatically (it's the inquiry-mode convention; authors don't repeat themselves).

### Locked-phase tooltip text
The tooltip on a locked stepper circle and the inline gate message under "Næste fase" use a small message map so authors don't repeat themselves:
- `milestone` → "Du skal gennemføre forsøget mindst én gang for at fortsætte."
- `data-points` → "Indsamle mindst {min} gyldige målinger før næste fase."
- `all-correct` → "Klik 'Tjek X' og opnå alle korrekte svar."
- `all-checked` → "Sæt flueben ved alle punkter på tjeklisten."
- `all-filled` → "Besvar alle spørgsmål for at fortsætte."
- `keyword-count` → "Find mindst {min} nøgleord."
- `predicate` → author-provided message in frontmatter.

---

## 10. Simulation contract

```ts
// src/sim-contract/index.ts
export interface SimulationProps {
  width: number;
  height: number;
  initialParams?: Record<string, number>;
  paused?: boolean;
  onProgress?: (e: ProgressEvent) => void;
}

export type ProgressEvent =
  | { type: 'milestone'; id: string; payload?: unknown }
  | { type: 'data-collected'; count: number }
  | { type: 'reset' };

export type SimulationMode = 'display' | 'interactive';

export interface SimulationMeta {
  id: string;
  title: string;
  mode: SimulationMode;                    // see "Sim mode" below
  defaultParams: Record<string, number>;
  paramSchema: ParamSchema;
  milestones: string[];                    // declared milestone ids (for build-time gate check)
}

export interface SimulationModule {
  default: React.ComponentType<SimulationProps>;
  meta: SimulationMeta;
  gates?: Record<string, (state: unknown) => boolean>;  // optional escape-hatch predicates
}
```

**The simulation never imports from `lab-guide`** — only from `sim-contract` and `sim-runtime`. This is the seam that keeps simulations independently developable.

#### Sim mode

`meta.mode` declares whether the sim renders its own controls. **`interactive` is the default; `display` is the explicit exception.**

- `interactive` — the sim owns its parameter controls (sliders, dropdowns, buttons) and drives its own animation if applicable. The lab-guide MDX focuses on observation and data-collection widgets (NumericAnswer, MultipleChoice). Expected for pendul, projektil, RC-circuit, decay, induction, photoelectric, etc.
- `display` — read-only renderer driven entirely by `initialParams` from the lab guide; the lab guide owns the parameter controls. Static-lookup sims like `dynamometer-g`, where the apparatus just shows `m·g` for whatever mass the lab supplies.

If a third mode starts to feel necessary, raise it before adding — extending the union has cross-cutting consequences for the lab guide's rendering responsibilities.

### Per-simulation testing
- **Pure physics** in `physics.ts` is unit-tested with Vitest. No DOM.
- **Component** is exercised via the `/simulationer/:simId` route — a standalone playground that mounts the sim with a milestone-event log panel and parameter sliders. Reachable from the `/emner` landing page so teachers/students can demo a sim outside a lab.

---

## 11. Standard widgets

Authored as MDX components. All widgets register themselves with the runner via context, so frontmatter gates can reference them by id. Widgets that perform batch validation register a "Tjek X" button into the phase footer.

### `<VariableIdentification>` — uafhængig/afhængig/konstanter (phase 1)
```mdx
<VariableIdentification id="variable">
  <Independent name="masse"            symbol="m" unit="kg" />
  <Dependent   name="kraft|tyngdekraft" symbol="F|F_t" unit="N" />
  <Constant    name="tyngdeacceleration" symbol="g" unit="m/s²" />
</VariableIdentification>
```
- Renders three cards (Uafhængig variabel / Afhængig variabel / Konstanter), each with three text inputs (Fysisk størrelse / Symbol / Enhed).
- Author-provided answers can have alternates separated by `|` (case-insensitive, whitespace-trimmed). Symbol cells accept LaTeX-ish input (`F_t`, `F^2`).
- Registers a **"Tjek variable"** button into the phase footer. Click → field-by-field validation:
  - Correct fields → green border + counted
  - Incorrect fields → red border + an orange progressive hint reveals (next attempt: deeper hint)
  - Score "Korrekte svar: X / 9" displayed live
  - "N forsøg tilbage" attempt counter (default 3; configurable via `attempts` prop)
- Gate-compatible via `{ type: 'all-correct', widgetIds: ['variable'] }`.

### `<HypothesisInput>` — keyword-counted free-text (phase 1)
```mdx
<HypothesisInput id="hypotese"
  placeholder="Fx. Det forventes, at ... og at hældningstallet bliver ..."
  keywords={[
    { any: ['proportional', 'lineær', 'ret linje'] },
    { any: ['tyngdeacceleration', 'g', 'hældning'] }
  ]}
  hint="Hvilke to fysiske størrelser undersøger du sammenhængen mellem? Og hvad forventer du vil ske?" />
```
- Multi-line textarea. Textarea content persisted to runner.
- Keywords are an array of "groups"; each group has `any: [...]` — student must mention at least one word from each group to score that keyword. Counter shown as "Nøgleord fundet: 0 / 2".
- Registers a **"Tjek hypotese"** button.
- Gate-compatible via `{ type: 'keyword-count', widgetId: 'hypotese', min: 2 }`.
- Why `any:` groups instead of a flat list: a flat list rewards verbose-but-empty hypotheses; groups force the student to cover *concepts*, not just sprinkle vocabulary.

### `<MaterialsList>` — checklist sourced from equipment library (phase 2)
```mdx
<MaterialsList id="materialer" items={[
  'lineal',
  { id: 'digitalvaegt', notes: '0,1 g præcision' },
  'dynamometer-2N',
  'lodholder-slidslodder-10x10g',
  'stativfod', 'stativstang', 'stativmuffe',
]} />
```
- Each item is either an equipment id (looked up in `library.json`) or `{ id, notes }`.
- Renders as checkboxes with item name + notes; image popover on hover (when image present in library).
- Gate-compatible via `{ type: 'all-checked', widgetIds: ['materialer'] }`.

### `<SetupSketch>` — diagram of the experimental setup (phase 2)
```mdx
<SetupSketch src="/setups/dynamometer-g.svg" alt="Skitse af dynamometer-opstilling" />
```
- Renders an image. Falls back to dashed-border "Skitse af forsøgsopstilling" placeholder if `src` omitted (matches mockup).
- Not gating; purely informational.

### `<PreparationChecklist>` — self-check tjekliste (phase 2)
```mdx
<PreparationChecklist id="tjekliste">
  <Item>Jeg har fundet alle materialer frem</Item>
  <Item>Jeg har opstillet mit forsøg, som vist på skitsen</Item>
  <Item>Jeg har sikret mig, at udstyret virker</Item>
  <Item>Jeg ved, hvordan jeg måler de variable jeg har planlagt</Item>
  <Item>Jeg har taget et billede af forsøgsopstillingen</Item>
</PreparationChecklist>
```
- Plain checkboxes; values persisted to runner.
- Gate-compatible via `{ type: 'all-checked', widgetIds: ['tjekliste'] }` — but you may want to leave this *non-gating* (see Improvements below).

### `<ConstantsTable>` — known constants for the analysis (phase 3)
```mdx
<ConstantsTable id="konstanter" rows={[
  { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' },
]} />
```
- Renders a small table with one input column for the value.
- For most labs (including dynamometer-g) this section is omitted — there are no other constants needed for the analysis. Use only when relevant.
- Gate-compatible via `{ type: 'all-filled', widgetIds: ['konstanter'] }`.

### `<DataTable>` — manual data entry (phase 3)
```mdx
<DataTable id="m" columns={[
  { key: 'm', label: 'masse', symbol: 'm', unit: 'kg' },
  { key: 'F', label: 'kraft', symbol: 'F', unit: 'N' },
]} minRows={6} />
```
- Multi-line column headers (label on top, `symbol (unit)` below in italic), matching mockup.
- All cells manually entered. Each row gets a × delete button. "+ Tilføj måling" link below the table.
- A row is **gyldig (valid)** when all required cells are non-empty and parse as numbers in their unit.
- Live counter "Gyldige målinger: X / Y" matches mockup wording.
- Persists to runner state.
- Gate-compatible via `{ type: 'data-points', min: 4 }` — only valid rows count toward `dataPointCount`.
- Future: optional uncertainty columns and per-lab column extension hooks (designed-for, not built MVP).

### `<Plot>` — scatter with student-chosen axes + regression toggles (phase 4)
```mdx
<Plot dataId="m"
  options={{ regression: true, r2: true, forceThroughZero: true }} />
```
- Reads from `<DataTable id="m">`.
- X-axis and Y-axis dropdowns (forces students to think about independent vs dependent variables).
- Three checkboxes (per the mockup):
  - "Vis lineær regression" — overlay OLS line and equation
  - "Vis R²-værdi" — display R² alongside the equation
  - "Tving gennem nul" — fit `y = a · x` (no intercept). Important for physics where the line should pass through origin.
- Plot rendered with uPlot. Auto-axes when no data, clamp to data bounds when present.
- Phase 4 typically pairs `<Plot>` with a `<NumericAnswer>` for the student's measured value, plus the framework's "Teoretisk værdi" line.

### `<NumericAnswer>` — student types a value with optional tolerance
```mdx
<NumericAnswer id="g-meas" target={9.82} tolerance="10%" unit="m/s²" />
```
- Accepts both `,` and `.` decimal separators; warns on mixed-style entry.
- `tolerance` accepts `5%`, `0.05`, or `±0.1`. If omitted, the widget just records the value without grading.
- When paired with a known target, the framework can compute and display the relative difference inline.
- Persists value + correctness flag.

### `<FreeTextResponse>` — generic free-text input (phases 5 Diskutér, 6 Konkludér, anywhere)
```mdx
{/* Reflection-style: floor on word count, no ceiling */}
<FreeTextResponse id="r1" prompt="Stemmer dine resultater overens med hypotesen?" minWords={20} />

{/* Conclusion-style: hard character cap with live counter */}
<FreeTextResponse id="konklusion"
  prompt="Skriv én kort konklusion (1–2 sætninger)."
  maxChars={300} />

{/* Author-tailored chrome: override placeholder + below-threshold hint per instance */}
<FreeTextResponse id="hypotese-aapen"
  prompt="Hvad forventer du der vil ske?"
  minWords={5}
  placeholder="Jeg forventer at..."
  tooShortMessage="Brug mindst 5 ord, gerne med en kort begrundelse." />
```
- Multi-line textarea, persisted to runner. No correctness grading.
- **Optional quantity constraints**: `minWords` (floor — amber hint when below; gate stays unfilled) and `maxChars` (ceiling — hard cap with live `X / Y` counter).
- **Optional author overrides** (per the convention in §17): `placeholder` and `tooShortMessage` replace the framework defaults from `strings.da.ts`. Use sentence-starters or richer pedagogical hints when generic chrome doesn't fit the prompt.
- Gate-compatible via `{ type: 'all-filled', widgetIds: ['r1', ...] }`.
- Inherits global copy/paste protection (see §16).

> Earlier drafts of this spec listed `<Reflection>` and `<ConclusionStatement>` as separate widgets. They were unified into `FreeTextResponse` once it became clear the only difference was opposing quantity constraints. Future semantic wrappers (e.g. `<Reflection>`, `<Konklusion>`) can be thin presets over this primitive if author ergonomics warrant.

### `<ReportComposer>` — output curation (phase 7 Rapportér)
```mdx
<ReportComposer id="rapport" sections={[
  { key: 'theory',     label: 'Teori-uddrag', defaultIncluded: false },
  { key: 'hypothesis', label: 'Min hypotese', defaultIncluded: true,  source: 'hypotese' },
  { key: 'data',       label: 'Datatabel',     defaultIncluded: true,  source: 'm' },
  { key: 'plot',       label: 'Graf med regression', defaultIncluded: true, source: 'm' },
  { key: 'discussion', label: 'Diskussion',     defaultIncluded: true,  source: ['r1','r2','r3','r4'] },
  { key: 'conclusion', label: 'Konklusion',     defaultIncluded: true,  source: 'konklusion' },
]}>
  <Export format="pdf" label="Download som PDF" />
  <Export format="csv" label="Download data som CSV" />
</ReportComposer>
```
- Renders one checkbox per section showing label + a small live preview snippet ("Du har skrevet 124 ord").
- "Download som PDF" applies a print stylesheet that hides everything except the selected sections, then calls `window.print()`. Browser's "Save as PDF" handles the actual file generation — no JS lib needed (per §6 stack note: avoid heavy PDF libraries).
- "Download data som CSV" exports just the raw data table + constants.
- The framework injects the lab title at the top of the PDF. (Student name injection is future work — no name-entry UI in MVP.)
- This phase replaces the previous standalone `<CSVExport>` widget. `CSVExport` remains available for other uses if a lab wants it inline elsewhere.

### `<NumericAnswer>` — typed number with tolerance
```mdx
<NumericAnswer id="g-meas" target={9.82} tolerance="5%" unit="m/s²" />
```
- Accepts both `,` and `.` as decimal separators in input.
- **Decimal-consistency check**: if the same student types one value with `,` and another with `.` in the same lab, framework warns: "Brug ',' eller '.' konsekvent — ikke begge."
- `tolerance` accepts `5%`, `0.05`, or `±0.1`. Default 5%.
- Unit, if provided, must be typed (or pickable from a dropdown depending on the `requireUnit` prop).
- Persists value + correctness flag.

### `<Reading>` — paired with simulation scale (used in phase 3)
```mdx
<Reading id="m100-F" instrument="dynamometer-10N" question="Hvad viser dynamometeret?" unit="N" />
```
- Renders an input box adjacent to the simulation.
- The simulation's `<LinearScale>` exposes its current "true" reading via context; this widget compares with tolerance derived from the scale's resolution (the half-minor-tick rule — e.g. ±0,1 N for a 0–10 N scale with 0,2 N minor ticks).
- Stores the reading into the active row of `<DataTable>` if one is present.

### `<DataTable>` — manual data entry
```mdx
<DataTable id="measurements" columns={[
  { key: 'm', label: 'Masse', unit: 'kg' },
  { key: 'F', label: 'Kraft', unit: 'N' },
]} minRows={5} />
```
- All cells manually entered (no auto-fill — your pedagogical choice).
- Add/remove rows.
- DK decimal-comma display; consistency check across cells.
- Frontmatter can set a future `uncertainty` column extension; not built MVP but column shape is parameterisable.
- Persists to runner state.

### `<Plot>` — scatter with student-chosen axes
```mdx
<Plot dataId="measurements" />
```
- Reads from the same `id` as a `<DataTable>`.
- Renders dropdowns for x-axis and y-axis (forces students to think about independent vs dependent variables).
- Scatter plot via uPlot. No automatic fit.

### `<LinearFit>` — student-triggered regression
```mdx
<LinearFit dataId="measurements" />
```
- Student clicks "Vis lineær tilpasning"; framework computes OLS slope, intercept, R²; overlays line on plot.
- Displays the equation in the form `F = a · m + b` with values.
- **Does not auto-fill any answer field** — student reads the equation and types the slope into a `<NumericAnswer>`.

### `<CompareToReference>` — relative-difference gate
```mdx
<CompareToReference id="g-comparison" reference={9.82} unit="m/s²" referenceLabel="g (kendt)" sourceId="g-meas" />
```
- Reads the student's value from `<NumericAnswer id="g-meas">`.
- Computes `(measured - reference) / reference * 100%` and displays formatted ("Relativ afvigelse: 2,1 %").
- Can be a gate target via `{ type: 'predicate', name: 'compared' }` (sim-side gate) or by being completed at all (`'milestone'`).

### `<CSVExport>` — download student work
```mdx
<CSVExport dataId="measurements" filename="dynamometer-g.csv" includeReflections />
```
- Generates CSV client-side (no server). Optional reflections appended as commented rows.
- Future: full PDF export (out of scope MVP but designed-for).

### Free-text — see `<FreeTextResponse>` above
The legacy `<Reflection>` listing here predates the FreeTextResponse unification. Use `<FreeTextResponse id="error-sources" prompt="..." minWords={20} />` for the same behaviour.

### `<KeyEquation>` — boxed callout for the lab's defining equation
```mdx
<KeyEquation>$F_t = m \cdot g$</KeyEquation>
```
- Renders the equation centred inside a light-lavender bordered card (matching your draft).
- KaTeX inline. Used in the standard "Nøgleligning" section of the Introduktion phase.
- Single-line by convention; multi-equation derivations use plain math blocks.

### `<Formaal>` / `<CentraleBegreber>` — semantic intro sections (optional)
The Introduktion phase has a canonical structure: **Formål → Centrale begreber → Nøgleligning → Teori**. Authors can write these as plain markdown headings (`### Formål`) or use semantic components if we want to enforce styling consistency. MVP: plain headings styled via the prose stylesheet. Components can be added later if drift becomes a problem.

### `<Equipment>` — real-lab mode
```mdx
<Equipment ids={['dynamometer-10N', 'mass-set-100g', 'stand']} />
```
- Looks up each ID in `equipment/library.json`.
- Renders cards with name, description, image (if present), notes.
- Only visible in real lab mode (`labMode === 'real'`).

---

## 12. Equipment system

### Library file
```json
// src/equipment/library.json
[
  {
    "id": "dynamometer-1N",
    "name": "Dynamometer 0–1 N",
    "scale": { "min": 0, "max": 1, "unit": "N", "minorTick": 0.02, "majorTick": 0.1 },
    "image": "images/dynamometer-1n.jpg",
    "notes": "Velegnet til små masser (op til ~100 g)."
  },
  {
    "id": "dynamometer-10N",
    "name": "Dynamometer 0–10 N",
    "scale": { "min": 0, "max": 10, "unit": "N", "minorTick": 0.2, "majorTick": 1 },
    "image": "images/dynamometer-10n.jpg",
    "notes": "Standard — op til ~1 kg."
  },
  {
    "id": "dynamometer-100N",
    "name": "Dynamometer 0–100 N",
    "scale": { "min": 0, "max": 100, "unit": "N", "minorTick": 2, "majorTick": 10 }
  },
  {
    "id": "mass-set-100g",
    "name": "Massesæt 100 g (10 lodder)",
    "image": "images/mass-set-100g.jpg"
  }
]
```

### Per-lab override
A lab's frontmatter can extend or override entries:
```yaml
labModes:
  real:
    enabled: true
    equipment: ['dynamometer-10N', 'mass-set-100g', 'stand']
    equipmentOverrides:
      dynamometer-10N:
        notes: "Brug det med rød streg — det andet er kalibreret om."
```

### Future: external equipment database
The shape of `library.json` is intentionally close to what a real database row would look like. When you build an external equipment DB later, replace the JSON with a build-time fetch that produces the same shape. No widget code changes.

---

## 13. Inquiry modes

Each lab declares phase lists per mode in frontmatter:
```yaml
modes:
  guided:
    phases:
      - { id: introduktion, title: Introduktion, gate: { type: always } }
      - { id: hypotese,     title: Hypotese,     gate: { type: all-correct, widgetIds: [hypotese] } }
      - { id: forsoeg,      title: Forsøg,       gate: { type: milestone, requires: tre-aflæsninger } }
      - { id: maaling,      title: Måling,       gate: { type: data-points, min: 5 } }
      - { id: data,         title: Databehandling, gate: { type: all-filled, widgetIds: [g-meas] } }
      - { id: konklusion,   title: Konklusion,   gate: { type: always } }
  open:
    phases:
      - { id: maal,         title: Mål }
      - { id: undersoegelse, title: Undersøgelse }
      - { id: rapport,      title: Rapport }
```

Open and semi-guided modes default gates to `{ type: 'always' }` and the runner records `visitedPhaseIds` instead. MDX bodies can use `{mode === 'open' ? <RawJournal/> : <ScaffoldedQuiz id="..."/>}` to swap content per mode (sparingly).

**MVP only ships Guided.** The frontmatter schema accepts the others so they're noop-safe.

---

## 14. Persistence & versioning

### Storage
- `localStorage[`htxlabs:state:${experimentId}`]` = `RunnerState` JSON.
- `localStorage[`htxlabs:index`]` = `{ [experimentId]: { lastVisited: ISO, mode, labMode, currentPhaseId } }` (used for a future "continue" surface).

### Version mismatch behaviour (auto-detect-and-restart)
On mount, `isStateCompatible` ([src/lab-guide/runner.ts](./src/lab-guide/runner.ts)) validates the loaded state:
1. `state.experimentVersion === frontmatter.version` — if not, wipe and start fresh.
2. `state.currentPhaseId` exists in the current mode's phase list — if not, wipe.

Wipes are silent; a `console.info` is logged for the maintainer's benefit. Bump `frontmatter.version` whenever phase ids or gate structure change so existing students get the restart on next visit. Finer-grained partial restoration (e.g. strip orphaned `widgetValues` keys, reset just a `<DataTable>` whose column shape changed) is not implemented — the spec previously described it as planned, but the trade-off lands on simplicity: full restart on any structural change.

### Privacy
Nothing leaves the device. No cookies. No analytics in MVP. If Plausible is added later, configure it to respect `Do Not Track` and document the privacy posture in `/about`.

---

## 15. Cheat resistance (light obfuscation)

- **MCQ correct option**: at build time, the MDX plugin replaces `<Option correct>...` with a hashed marker: `data-hash="<sha256>"`. The plaintext "this is correct" never ships to the client.
- **Numeric answers**: tolerance bands defeat hashing, so target value ships in plaintext. This is acceptable — students determined enough to inspect DevTools have already learned the value isn't secret (g = 9,82). The intent is to defeat casual cheating, not assessment-grade security.
- **Quiz answer hashing helper**: `src/lib/hash.ts` exports `sha256(text)`. The build plugin uses it; the Quiz widget uses the same function on student input.
- A future server-side path is left open by isolating all answer-checking inside widget components — replacing `client-hash compare` with `fetch('/api/check')` is one widget-level change.

---

## 16. Copy/paste protection on input fields

All `<input>`, `<textarea>` and contenteditable surfaces in the framework block paste, cut, drag-drop, and middle-click paste. Implemented via a single `<ProtectedInput>` / `<ProtectedTextarea>` primitive that all widgets use. The student types every answer themselves.

**Blocked events:**
- `paste` (clipboard paste)
- `drop` + `dragover` (drag-drop text into the field)
- `auxclick` (middle-click paste on Linux)
- `cut` (so they can't cut from one input and paste into another)

**Allowed:**
- Typing
- Copying the student's *own* text out of the input (e.g. to look something up). Blocking outbound copy would break legitimate use without preventing the cheating path.
- Browser autofill is unaffected (it doesn't use the paste event).

**On blocked paste:** show a small toast — "Indsæt er deaktiveret — skriv selv dit svar." — and shake the input briefly. Toast auto-dismisses after 2 s. Toast text is overridable via `globals.css` for future translation.

**Where this is enforced:**
- Every framework widget that takes typed input (`<NumericAnswer>`, `<HypothesisInput>`, `<Reflection>`, `<ConclusionStatement>`, `<DataTable>` cells, `<VariableIdentification>` fields, `<ConstantsTable>` cells)
- `<ShowSolution>` model-answer text additionally has `user-select: none` and `oncopy={preventDefault}` so students can't grab the model answer to paste somewhere off-site

**What this does NOT do (honest acknowledgement):**
- Determined students can disable JavaScript in DevTools or use browser extensions to bypass.
- Students can re-type from another window — typing speed is the only friction.
- Students on iPad with a keyboard can use the OS-level "Replace" function in some inputs.
- This is **light deterrence**, not strong cheat-prevention. The intent is to remove the trivial-friction "Vis facit → copy → paste" path, not to make cheating impossible.

**Accessibility tradeoff acknowledged:**
- Some assistive tech (e.g. word-prediction tools, voice-to-text editors) emits paste events. We provide a per-lab `allowPaste: true` frontmatter override for SEN students or labs where paste is legitimate. Default off.

---

## 17. DK localization conventions

- **Decimal comma**: all displayed numbers formatted as `4,91` via `Intl.NumberFormat('da-DK')`. Numeric inputs accept both `,` and `.`. Mixed-style entry triggers a soft warning (per your "students must be consistent" requirement).
- **Units**: a `<Unit>` component handles SI display: `<Unit>m·s⁻²</Unit>`. Internally renders with proper Unicode (`·`, `⁻²`) and an `aria-label="meter per sekund i anden"` for screen readers.
- **Dates**: weekdays/months in Danish via `Intl.DateTimeFormat('da-DK')`.
- **Strings**: Danish-only. Framework-default UI strings live in `src/lab-guide/strings.da.ts` (templates use `{name}` placeholders, substituted via the `format()` helper in the same file) so a future translation layer is a one-file change.
- **Author override convention**: any widget that exposes student-facing chrome — placeholders, hint messages, button labels — must also expose an optional override prop (e.g. `placeholder`, `tooShortMessage`) so a teacher can tailor per-instance from MDX without touching framework code. Defaults stay generic; overrides let a specific lab reach for richer pedagogical phrasing. This applies retroactively when new widgets land and forward-looking when introducing new inquiry-form variants.

---

## 18. Visual design

Match htxlabs.dk's style closely. From your draft:

- **Headings**: dark navy / near-black, semi-bold, sans-serif. No serif (Garamond-ish look in the screenshot is the page's default rendering, not custom; treat as Inter/system stack).
- **Body**: dark slate text, comfortable line height, ~70-character measure.
- **Bullets**: filled blue dots (the accent colour), tight indent.
- **Accent colour**: a single saturated blue (similar to htxlabs.dk's primary). Used for active stepper circle, slider track/thumb, link colour, blue-dot bullets, hanging-mass value badge, slider live-value text.
- **Callouts**: light lavender / pale-blue background, thin border, centred KaTeX content (used by `<KeyEquation>`).
- **Cards**: white background, subtle 1px border, rounded-lg corners (matches "Skjul simulation" and topic cards).
- **Math**: KaTeX everywhere, inline `$…$` and display `$$…$$`.
- **Numbers**: DK comma in displayed values; consistency-warning logic on input.
- **Layout**:
  - Topic/experiment grids → cards
  - Lab page is **vertically stacked** (single column with ~768–960 px max content width):
    1. Theory section (Formål, Centrale begreber, Nøgleligning, Teori) inside a card with "Vis teori" / "Skjul teori" header — collapsible, **default collapsed**, mirroring the simulation-panel chrome. Theory content still appears in print regardless of on-screen collapse state.
    2. Simulation panel inside a card with "Skjul simulation" header — collapsible, default expanded. Internally two columns: scale visualization on the left, controls (dropdown + slider) on the right.
    3. Laboratorieguide section: serif heading "Laboratorieguide", then horizontal stepper (1—2—3—4—5) **pinned to viewport top via `sticky top-0`** so phase progress stays visible while scrolling, then the phase's instruction box (light-blue rounded card), then phase content full-width, then footer.
  - Stepper visual: filled blue circle with ✓ for completed, filled blue circle with number for current, grey circle with number for future. Connected by horizontal lines that are blue for done segments, light-grey for upcoming.
  - Phase footer: three regions — left ("← Forrige fase" or "← Skift undersøgelsesform" on phase 1), middle (batch-check buttons like "Tjek variable", "Tjek hypotese", "Vis facit"), right ("Næste fase →" or "Afslut guide" on the last phase).
- **Motion**: subtle phase-transition fade; respect `prefers-reduced-motion`.

Use shadcn/ui defaults as the starting point; tweak `globals.css` (CSS variables for the accent colour, callout background, navy heading colour) once. Tailwind v4 handles the rest. No custom fonts MVP — system stack is fine.

---

## 19. Build & deployment

### Local dev
```
npm install
npm run dev       # Vite dev server with HMR; /simulationer/:simId routes available
npm test          # Vitest in watch mode
npm run test:e2e  # Playwright
npm run build     # static output to ./dist
npm run preview   # serve ./dist locally
```

### GitHub Pages deploy
`.github/workflows/deploy.yml`:
- On push to `main`: install, lint, test, build with `BASE_URL=/repo-name/` (or root if custom domain), publish `./dist` to `gh-pages` branch.
- Custom domain via a `CNAME` file in `public/`.
- Vite config: `base: process.env.BASE_URL ?? '/'`.

GitHub Pages serves the SPA; `404.html` is a copy of `index.html` so client-side routes resolve.

---

## 20. Lab #1 — "Måling af g med dynamometer"

Concrete design grounding the framework. Title: **"Bestemmelse af tyngdeacceleration g med dynamometer"**.

### Learning goals (layered through phases)
1. Mass-independence intuition: `g` is a property of Earth, not of the hanging mass — same slope across all student measurements.
2. Verify `F = m · g` is linear in m.
3. Determine g experimentally and compare to 9,82 m/s² with relative difference.

### Simulation: `dynamometer-g`

Visual layout (per mockup): two-column. **Left**: vertical linear-scale dynamometer with hatched ceiling, tick marks (e.g. 0, 10, 20, 30, 40, 50 N major + minors), red indicator arrow at the current force, hook + hanging-mass block at the bottom showing "0,027 kg" in a blue badge. A "Skjul simulation" header lets the student collapse the whole simulation if they want more reading room. **Right**: control panel with a "Dynamometer" dropdown and a "Masse m" slider showing the live value in blue and `0` / `0,1` end labels.

**Inputs (visible to student):**
- Slider: hanging mass m, range **0–0,1 kg**, step 0,001 kg (1 g resolution). Live value displayed to the right of the label in DK format (`0,027 kg`).
- Dynamometer dropdown sourced from equipment library — `1 N`, `5 N`, `10 N`, `50 N` (final list to be confirmed; matches mockup).
- Optional: reset button.

**Outputs (visual only — no numeric readout):**
- The vertical spring-scale's red indicator arrow rests at `F = m · g_true` (with `g_true = 9,82 m/s²`), positioned along the scale according to the dropdown's range.
- Tick marks reflect the selected dynamometer's `minorTick` / `majorTick` from the equipment library.
- A hanging-mass block hangs from the scale's hook with its mass value rendered as a blue badge.
- The student must type their reading in the adjacent `<Reading>` widget.
- If the chosen dynamometer is too coarse for the mass (e.g. 50 N range for 27 g → indicator near 0), no error is shown — the student is *meant* to discover that the reading is unreadably small and switch to a finer scale. This is the pedagogical point.
- If the chosen dynamometer is too small (e.g. 1 N range for 100 g), the indicator pegs at max with a small "uden for skala" tag.

**Milestones emitted via `onProgress`:**
- `'first-load'` — first time a non-zero mass produces a reading on a sensibly-chosen dynamometer
- `'tre-aflæsninger'` — three different masses have been read with valid in-scale configurations
- `'data-collected'` events — each accepted reading

**Param schema:**
```ts
{ mass:        { type: 'range', min: 0, max: 0.1, step: 0.001, unit: 'kg' },
  dynamometer: { type: 'enum',  values: ['dynamometer-1N','dynamometer-5N','dynamometer-10N','dynamometer-50N'] } }
```

### MDX skeleton
```mdx
---
version: 1
title: Bestemmelse af g med dynamometer
topic: mekanik
simulationId: dynamometer-g

# This lab tightens the simulation's mass range to fit the school's mass set.
simulationOverrides:
  defaultParams:
    mass: 0.05

learningObjectives:
  - Forstå at tyngdeaccelerationen er en konstant uafhængig af den hængende masse
  - Verificere at F = m · g er lineær i m
  - Bestemme g eksperimentelt og sammenligne med kendt værdi 9,82 m/s²
keyConcepts: [tyngdekraft, masse, dynamometer, lineær regression, måleusikkerhed]

modes:
  guided:
    phases:
      - id: planlaeg
        title: Planlæg
        intro: |
          1. Identificér de variable du skal arbejde med.
          2. Formulér en hypotese ud fra teorien.
          3. Overvej hvilke målinger der kan be- eller afkræfte hypotesen.
        gate: { type: all-correct, widgetIds: [variable, hypotese] }
      - id: opstil
        title: Opstil
        intro: |
          1. Saml dine materialer og tjek, at alt er klar.
          2. Gør dig selv bekendt med måleudstyr og målemetoder.
          3. Planlæg hvordan du registrerer data systematisk.
        gate: { type: always }   # tjekliste is non-gating per Improvement #4
      - id: maal
        title: Mål
        intro: |
          Indsamle et passende antal målinger. Hvis et felt kan beregnes automatisk,
          udfyldes det af sig selv.
        gate: { type: data-points, min: 4 }
      - id: analyser
        title: Analysér
        intro: Sammenlign dine målinger med den teoretiske værdi.
        gate: { type: all-filled, widgetIds: [g-meas] }
      - id: diskuter
        title: Diskutér
        intro: |
          1. Sammenlign resultatet med din hypotese.
          2. Diskutér mulige fejlkilder og hvordan de påvirker resultatet.
          3. Overvej hvordan forsøget kunne forbedres.
        gate: { type: all-filled, widgetIds: [r1, r2, r3, r4] }
      - id: konkluder
        title: Konkludér
        intro: Skriv én kort konklusion (1–2 sætninger).
        gate: { type: all-filled, widgetIds: [konklusion] }
      - id: rapporter
        title: Rapportér
        intro: Vælg hvilke afsnit der skal med i din rapport, og download.
        gate: { type: always }

labModes:
  virtual: { enabled: true }
  real:
    enabled: true
    equipment: [lineal, digitalvaegt, dynamometer-2N, lodholder-slidslodder-10x10g, stativfod, stativstang, stativmuffe]
tags: [mekanik, kraft, masse, lineær-regression]
---

# Bestemmelse af tyngdeacceleration g

## Formål
At undersøge sammenhængen mellem masse og tyngdekraft, og bestemme tyngdeaccelerationen ud fra data.

## Centrale begreber
- Tyngdekraft og vægt
- Sammenhæng mellem masse og kraft
- Eksperimentel bestemmelse af tyngdeaccelerationen

## Nøgleligning
<KeyEquation>$F_t = m \cdot g$</KeyEquation>

## Teori
Et lod, med massen $m$, der hænger i et dynamometer, er påvirket af Jordens tyngdekraft $F_t$.
Når loddet hænger stille, måler dynamometeret en kraft, der er lige så stor som tyngdekraften
på loddet. Denne kraft kaldes også loddets vægt.

Der er en direkte proportionalitet mellem tyngdekraften og massen. Sammenhængen kan skrives som
$$F_t = m \cdot g$$
hvor kraften måles i newton, $\mathrm{N}$, og massen måles i kilogram, $\mathrm{kg}$.
Proportionalitetskonstanten $g$ kaldes tyngdeaccelerationen. I Danmark er den ca. $9{,}82~\mathrm{m/s^2}$.

I forsøget tilføjes forskellige masser til dynamometeret, og den tilhørende kraft aflæses.
Når resultaterne afbildes i en graf med massen på $x$-aksen og kraften på $y$-aksen, forventes
målepunkterne at ligge tæt på en ret linje gennem begyndelsespunktet. Linjens hældning svarer
til tyngdeaccelerationen $g$.

{/* SimulationPanel auto-rendered here by LabGuide */}

## Laboratorieguide

### Phase: Planlæg {#planlaeg}

**Identificér dine variable:**

<VariableIdentification id="variable" attempts={3}>
  <Independent name="masse"            symbol="m"   unit="kg"   />
  <Dependent   name="kraft|tyngdekraft" symbol="F|F_t" unit="N"  />
  {/* No additional constants for this lab */}
</VariableIdentification>

**Min hypotese:**

<HypothesisInput id="hypotese"
  placeholder="Fx. Det forventes, at ... og at hældningstallet bliver ..."
  keywords={[
    { any: ['proportional', 'lineær', 'ret linje'] },
    { any: ['tyngdeacceleration', 'g', 'hældning'] }
  ]}
  hint="Hvilke to fysiske størrelser undersøger du sammenhængen mellem? Og hvad forventer du vil ske?" />

### Phase: Opstil {#opstil}

<MaterialsList id="materialer" items={[
  'lineal',
  { id: 'digitalvaegt', notes: '0,1 g' },
  'dynamometer-2N',
  'lodholder-slidslodder-10x10g',
  'stativfod', 'stativstang', 'stativmuffe',
]} />

<SetupSketch src="/setups/dynamometer-g.svg" alt="Skitse af dynamometer-opstilling" />

**Tjekliste:**

<PreparationChecklist id="tjekliste">
  <Item>Jeg har fundet alle materialer frem</Item>
  <Item>Jeg har opstillet mit forsøg, som vist på skitsen</Item>
  <Item>Jeg har sikret mig, at udstyret virker</Item>
  <Item>Jeg ved, hvordan jeg måler de variable jeg har planlagt</Item>
  <Item>Jeg har taget et billede af forsøgsopstillingen</Item>
</PreparationChecklist>

### Phase: Mål {#maal}

<DataTable id="m" columns={[
  { key: 'm', label: 'masse', symbol: 'm', unit: 'kg' },
  { key: 'F', label: 'kraft', symbol: 'F', unit: 'N' },
]} minRows={6} />

### Phase: Analysér {#analyser}

<Plot dataId="m" options={{ regression: true, r2: true, forceThroughZero: true }} />

**Teoretisk værdi:** $9{,}82~\mathrm{m/s^2}$

<NumericAnswer id="g-meas" target={9.82} tolerance="10%" unit="m/s²"
  label="Din målt værdi:" placeholder="Indtast din beregnede værdi" />

### Phase: Diskutér {#diskuter}

<Reflection id="r1" prompt="Stemmer dine resultater overens med hypotesen? Beskriv hvilke mønstre du observerede." />
<Reflection id="r2" prompt="Beregn eller aflæs nøgleparametren ud fra dine data. Hvordan passer det med den teoretiske værdi?" />
<Reflection id="r3" prompt="Hvilke mulige fejlkilder kunne påvirke dit forsøg? Hvordan ville de ændre resultaterne?" />
<Reflection id="r4" prompt="Hvis du skulle gentage forsøget, hvad ville du gøre anderledes for at forbedre præcisionen?" />

### Phase: Konkludér {#konkluder}

<ConclusionStatement id="konklusion"
  prompt="Skriv én kort konklusion (1–2 sætninger) der opsummerer det vigtigste fra forsøget."
  maxChars={300} />

### Phase: Rapportér {#rapporter}

<ReportComposer id="rapport" sections={[
  { key: 'theory',     label: 'Teori-uddrag',          defaultIncluded: false },
  { key: 'hypothesis', label: 'Min hypotese',          defaultIncluded: true,  source: 'hypotese' },
  { key: 'data',       label: 'Datatabel',             defaultIncluded: true,  source: 'm' },
  { key: 'plot',       label: 'Graf med regression',   defaultIncluded: true,  source: 'm' },
  { key: 'discussion', label: 'Diskussion',            defaultIncluded: true,  source: ['r1','r2','r3','r4'] },
  { key: 'conclusion', label: 'Konklusion',            defaultIncluded: true,  source: 'konklusion' },
]}>
  <Export format="pdf" label="Download som PDF" />
  <Export format="csv" label="Download data som CSV" />
</ReportComposer>
```

### Open questions for lab #1 (resolve during build, not blocking spec)
- Default dynamometer choices — final list (1 N, 5 N, 10 N, 50 N is what mockup shows; confirm what's actually in your school equipment).
- Tolerance on g answer — proposed 10% (generous, accounts for reading error). Consider tightening to 5%.
- Hint texts for `<VariableIdentification>` — write the per-attempt hint progression in the widget's prop or via `<Hint>` children.
- "Vis facit" model answers — author when content is ready.
- Whether the Opstil tjekliste should *gate* progression or be advisory only (see Improvements §22).

---

## 21. Test strategy

### Unit (Vitest)
- `gates.ts` — every gate type, the "all-earlier-gates-satisfied" rule, the open-mode loosening, the predicate-returns-undefined fallback.
- `regression.ts` — known datasets (e.g. y = 2x + 1) producing slope=2, intercept=1, R²≈1.
- `numbers.ts` — DK parsing (`'4,91'` → `4.91`), mixed-style detection, formatting.
- `simulations/dynamometer-g/physics.ts` — `forceFor(m, g) = m·g`; pegging logic for over-scale.

### Component (Vitest + Testing Library)
- `<Quiz>`: hint reveal sequence, correct hashed answer satisfies gate, attempt counter persists.
- `<NumericAnswer>`: tolerance band, decimal-style consistency warning, unit requirement.
- `<DataTable>`: add/remove rows, persist to runner, DK number formatting on display, raw value retained internally.
- `<LinearFit>` + `<Plot>`: integration with a fixed dataset.
- `runner.ts`: version mismatch wipe, phase advance on milestone, replay from localStorage.

### E2E (Playwright)
- `dynamometer-g.spec.ts`: full happy path from home → topic → lab → through all 6 phases with simulated user inputs; assert `Næste fase` disabled when expected, enabled after gating action.
- Refresh-resilience: advance to phase 4, refresh, assert resume.
- Version bump: pre-seed localStorage with `version: 1`, change frontmatter to `version: 2`, reload, assert state wiped.

### Performance budgets (Lighthouse)
- Topic index: Performance ≥ 95
- Lab page first load: Performance ≥ 90
- Initial JS bundle (home): < 100 KB gzipped
- Per-lab simulation chunk: < 50 KB gzipped (excluding shared `sim-runtime`)

### Accessibility budget
- WCAG 2.1 AA on all non-simulation surfaces.
- Phase changes announce via `aria-live="polite"`.
- Locked-phase tooltip keyboard-reachable.
- Simulation has labelled controls, but the canvas itself is exempt from full WCAG (with documented rationale and an alt summary text).
- `prefers-reduced-motion` pauses simulation animation.

---

## 22. Roadmap / phasing

### Phase 0 — Framework skeleton (~1 week, solo, with AI help)
1. Vite + React + TS + Tailwind + shadcn scaffold
2. `sim-contract`, `sim-runtime` with `AnalogGauge`, `Slider`, `useAnimationLoop`
3. `lab-guide` skeleton: `LabGuide`, `PhaseStepper`, `PhaseFooter`, `runner.ts`, `gates.ts`, version check
4. MDX content pipeline with Zod validation
5. Routing for home/topic/experiment/playground
6. GitHub Actions deploy
**Exit criterion:** an empty lab with one trivial phase renders, deploys, and persists state across refreshes.

### Phase 1 — Core widgets + Lab #1 (~2–3 weeks)
1. Widgets: `Quiz`, `NumericAnswer`, `Reading`, `DataTable`, `Plot`, `LinearFit`, `CompareToReference`, `CSVExport`, `Reflection`
2. Equipment library + `Equipment` widget
3. Build the `dynamometer-g` simulation (physics + analog gauge + milestone wiring)
4. Author the MDX for "Måling af g med dynamometer"
5. End-to-end test
6. **Use it with a real class.** This is the validation gate before scaling.

### Phase 2 — Second + third lab (~2 weeks)
After validating with one class, add 2 more labs (one in Mekanik, one in another topic) to flush out framework assumptions before they fossilise.

### Phase 3 — Inquiry modes (semi-guided, open) (~1 week)
Implement the mode-aware phase resolver and write open-mode variants for the existing labs.

### Phase 4 — Real-lab mode + equipment images (~1 week)
Real-lab procedure widget; add equipment images. Connect to the future equipment database when it exists.

### Phase 5 — Forward-looking
- Class-level analytics (Cloudflare Worker; minimal)
- PDF export of student work
- Curriculum tagging (DK læreplan)
- Uncertainty handling per-lab (`σF` columns, error bars on plot)
- Symbolic answers (math.js)
- Translation layer (English mirror)

---

## 23. Improvements (decisions reached during interview)

You agreed to all six suggestions except #3 — for that you went stronger, applying copy/paste protection across all input fields (see §16) instead of gating "Vis facit" specifically. The final list:

1. ✅ **`<HypothesisInput>` keyword groups (`any:`) instead of a flat keyword list.** A flat list rewards students who sprinkle vocabulary. Groups force expression of *both* a relationship concept AND a quantity concept.

2. ✅ **`<VariableIdentification>` accepts answer alternates.** "kraft" and "tyngdekraft" both pass for the dependent variable via `name="kraft|tyngdekraft"`.

3. 🔁 **Replaced with site-wide copy/paste protection** (§16). Stronger than the original suggestion: it removes the cheating path on every input field, not just `<ShowSolution>`. Honest tradeoffs documented — light deterrence, not strong prevention.

4. ✅ **Phase 2 (Opstil) tjekliste does NOT gate progression.** Lab #1 schema sets phase 2 gate to `{ type: 'always' }`; the checklist remains as a non-gating self-check.

5. ✅ **`<ConstantsTable>` is optional / omittable.** Lab #1 omits it (g is the unknown, not a known constant for the analysis).

6. ✅ **Stepper circles are clickable for completed phases.** Forward jumps still gated; backward jumps free.

---

## 24. Risks and tradeoffs explicitly accepted

- **Solo author, limited frontend experience**: simplified stack (Vite over Next.js, single repo over monorepo), AI-pair-programming friendly, but you should expect 2–3× longer than a senior frontend dev.
- **GitHub Pages constraint**: cannot add real auth or server-side answer checking later without leaving the platform. Acceptable now; revisit if class analytics become a hard requirement.
- **Quiz answer leakage**: light hashing only. A determined student can reverse-engineer with sufficient effort. Accepted as formative-not-summative tradeoff.
- **No mobile-first design**: phone users have a degraded experience. Acceptable; physics labs on a 5" screen are awkward anyway.
- **Open inquiry mode designed-but-not-built**: hooks exist; behaviour confirmed only after first guided labs validate the rest of the framework.
- **Equipment-database integration is structural-only**: actual DB doesn't exist; the JSON shape is forward-compatible.

---

## 25. Open questions to resolve during build

1. Final accent colour and typography (mock with shadcn defaults first, refine after lab #1 ships)
2. Whether to include Plausible analytics from day one
3. Mass slider granularity for lab #1 (50 g vs 100 g)
4. Tolerance for the experimentally-determined g (5%, 10%, or scale-based)
5. Hint texts for each quiz (drafted, will refine with classroom testing)
6. Whether `<Reflection>` widgets count toward the gate (proposal: no — soft `minWords` warning only)
7. Whether to surface "in progress" labs on the home page (deferred until ≥2 labs exist)

---

## 26. Verification plan (post-implementation)

1. `npm test -- --run` → all unit + component tests pass
2. `npm run test:e2e` → Playwright smoke passes
3. `npm run build` → static export succeeds; bundle budgets met
4. Deploy to a staging URL (`gh-pages` on a branch) and run Lighthouse → ≥ 90 Performance/A11y/Best-Practices
5. Manual run-through of "Måling af g med dynamometer" end-to-end on a Mac and a Chromebook
6. Refresh-resilience: advance to phase 4, refresh, confirm resume
7. Version-bump: change `version: 1` → `2` in frontmatter, reload, confirm wipe with no error
8. Use it in a real class period; collect informal feedback; iterate

---

End of spec.
