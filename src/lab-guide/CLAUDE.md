# Lab-guide framework

Loaded on demand when files under `src/lab-guide/` are read.

## Lab page anatomy (`LabGuide.tsx`)

A lab page has three stacked sections: **TheoryPanel** (collapsible, **default collapsed**) → **SimulationPanel** (collapsible, default expanded, mounted once for the lab — visibility toggles, state preserved across phases) → **Laboratorieguide** (the gated 7-phase flow; the PhaseStepper is wrapped in a `sticky top-0` bar in `LabGuide.tsx` so phase progress stays visible while the student scrolls). Phase navigation uses URL hash; mode/labMode are query params.

## State, persistence, gates

- Runner state (`src/lab-guide/runner.ts`) is persisted to `localStorage['htxlabs:state:${experimentId}']` on every change.
- On mount, `isStateCompatible` checks saved `experimentVersion` against current frontmatter; mismatch → silent wipe + restart (no banner; `console.info` only). Bump `frontmatter.version` whenever phase ids or gate structure change.
- Gates are pure (`gates.ts`) — discriminated union over `always | milestone | data-points | all-correct | all-checked | all-filled | keyword-count | predicate`. **Open-mode advances are unconditional** (`inquiryFreeAdvance`); guided/semi-guided run the actual gate. Add a new gate kind: extend the Zod `Gate` union in `src/lib/schema.ts`, then add one entry to `GATE_HANDLERS` in `gates.ts` (`{ check, message }`). `AUTHORABLE_GATE_KINDS` is derived from the handler map minus `SIM_DRIVEN_GATE_KINDS`, so a new widget-driven kind needs no further wiring; sim-driven kinds add themselves to the denylist.
- **Navigation is asymmetric by design**: forward advance is gate-checked, but completed/current phases are always reachable via the stepper (backward navigation is free). Don't symmetrize `canAdvanceTo` — `PhaseStepper.tsx` relies on the asymmetry to keep completed circles clickable.
- Widgets register live state (`registerWidgetState`) into a ref, not React state, so widget re-renders don't cascade through the runner. A `setTick` forces gate-evaluating subscribers to re-render after registration.

## Widget conventions

- **Danish UI strings & author overrides** (SPEC §17): framework defaults live in `src/lab-guide/strings.da.ts` (templates use `{name}` placeholders, substitute via the exported `format()` helper). **Every student-facing string in a widget must follow the rule:** (a) the default lives in `strings.da.ts`, and (b) the widget accepts an override prop (`checkLabel`, `placeholder`, `tooShortMessage`, `correctMessage`, …). No hardcoded Danish in widget JSX. Pattern: `{prop ?? strings.widgets.<name>.<key>}`.
- **Copy/paste protection** is opt-out, not opt-in. Use `ProtectedInput` / `ProtectedTextarea` for student free-text. The escape hatch is per-lab `frontmatter.allowPaste: true` (SEN accommodation) — propagated as the `allowPaste` prop.
