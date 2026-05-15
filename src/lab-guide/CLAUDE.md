# Lab-guide framework

Loaded on demand when files under `src/lab-guide/` are read.

## Lab page anatomy (`LabGuide.tsx`)

A lab page has three stacked sections: **TheoryPanel** (collapsible, **default collapsed**) → **SimulationPanel** (collapsible, default expanded, mounted once for the lab — visibility toggles, state preserved across phases) → **Laboratorieguide** (the gated 7-phase flow; the PhaseStepper is wrapped in a `sticky top-0` bar in `LabGuide.tsx` so phase progress stays visible while the student scrolls). Phase navigation uses URL hash; mode/labMode are query params.

### Phase box semantics — three text layers

Each phase has three distinct text surfaces, and only one of them owns the *task*: the **instruction-box** at the top (light-blue card, fed by `phase.steps` — see SPEC §8). Authoring `steps: string[]` makes `LabGuide.tsx` auto-render a `Fase N – {title}:` header above a `<ol type="lower-alpha">`; a single-item `steps` renders header + plain line (no letter). Use the legacy `intro: string` only for one sentence with no header — schema rejects both at once. The MDX **prose** around widgets is for motivation, scaffolding questions, or operational guidance — **never** restate a step there. **Widget labels** (the `prompt` prop on `<FreeTextResponse>`, `<Quiz>`, etc.) own the concrete input prompt.

## State, persistence, gates

- Runner state (`src/lab-guide/runner.ts`) is persisted to `localStorage['htxlabs:state:${experimentId}']` on every change.
- On mount, `isStateCompatible` checks saved `experimentVersion` against current frontmatter; mismatch → silent wipe + restart (no banner; `console.info` only). Bump `frontmatter.version` whenever phase ids or gate structure change.
- Gates are pure (`gates.ts`) — discriminated union over `always | milestone | data-points | all-correct | all-checked | all-filled | keyword-count | predicate | rubric-required | all-satisfied`. **Open-mode advances are unconditional** (`inquiryFreeAdvance`); guided/semi-guided run the actual gate. Add a new gate kind: extend the Zod `Gate` union in `src/lib/schema.ts`, then add one entry to `GATE_HANDLERS` in `gates.ts` (`{ check, message }`). `AUTHORABLE_GATE_KINDS` is derived from the handler map minus `SIM_DRIVEN_GATE_KINDS`, so a new widget-driven kind needs no further wiring; sim-driven kinds add themselves to the denylist.
- `rubric-required` (widget-driven) reads `{ kind: 'rubric', satisfied }` published by `<RubricResponse>`. The widget computes `satisfied` from the most recent rubric evaluation; editing the text flips a `dirty` derivation that recomputes `satisfied:false`, so the gate re-closes without the widget having to drop the prior result. Embed-server outage keeps the gate closed via the same derivation (literal/regex passes alone are not sufficient).
- `all-satisfied` (widget-driven, heterogeneous) ANDs the kind-aware satisfaction bit across a list of widget ids — `correct` from `'correct'`, `allChecked` from `'checked'`, `filled` from `'filled'`, `satisfied` from `'rubric'`, `foundCount === total` from `'keywords'`. Use it when a phase needs to gate on more than one widget type at once (e.g. a `VariableTable` + a `RubricResponse`); a single-widget case stays on the kind-specific gate. The schema enforces `widgetIds.min(2)` because a one-id `all-satisfied` would be a strictly weaker version of the kind-specific gate.
- **Navigation is asymmetric by design**: forward advance is gate-checked, but completed/current phases are always reachable via the stepper (backward navigation is free). Don't symmetrize `canAdvanceTo` — `PhaseStepper.tsx` relies on the asymmetry to keep completed circles clickable.
- Widgets register live state (`registerWidgetState`) into a ref, not React state, so widget re-renders don't cascade through the runner. A `setTick` forces gate-evaluating subscribers to re-render after registration.

## Widget conventions

- **Danish UI strings & author overrides** (SPEC §17): framework defaults live in `src/lab-guide/strings.da.ts` (templates use `{name}` placeholders, substitute via the exported `format()` helper). **Every student-facing string in a widget must follow the rule:** (a) the default lives in `strings.da.ts`, and (b) the widget accepts an override prop (`checkLabel`, `placeholder`, `tooShortMessage`, `correctMessage`, …). No hardcoded Danish in widget JSX. Pattern: `{prop ?? strings.widgets.<name>.<key>}`.
- **Copy/paste protection** is opt-out, not opt-in. Use `ProtectedInput` / `ProtectedTextarea` for student free-text. The escape hatch is per-lab `frontmatter.allowPaste: true` (SEN accommodation) — propagated as the `allowPaste` prop.
