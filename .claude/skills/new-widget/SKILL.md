---
name: new-widget
description: Scaffold a new LabGuide MDX widget — component file + Vitest stub, plus the two registry one-liners surfaced for confirmation before applying. Use when the user asks to create a widget (e.g. "/new-widget Quiz", "scaffold a NumericAnswer widget").
---

# new-widget

Scaffold a LabGuide MDX widget under `src/lab-guide/widgets/`.

This skill is **pure structure**: it stamps out the contract (imports, `useRunner`, `registerWidgetState`, prop interface, default export) but leaves the actual logic and Danish copy as `TODO`. Do not invent physics content or Danish strings.

## Inputs

The user types `/new-widget <Name>` (PascalCase, e.g. `Quiz`, `NumericAnswer`, `LinearFit`). If they don't supply a name, ask for it.

After you have the name, ask **one** AskUserQuestion with two questions:

1. **Widget kind** (single-select) — what `WidgetState` does this widget report to the runner so gates can read it?
   - `correct` — batch-checked (Quiz, NumericAnswer, VariableIdentification). Used by `all-correct` gate.
   - `checked` — checklist (MaterialsList tjekliste). Used by `all-checked` gate.
   - `filled` — free-text presence (Reflection, ConclusionStatement). Used by `all-filled` gate.
   - `keywords` — keyword-count (HypothesisInput). Used by `keyword-count` gate.
   - `data-points` — table validity (DataTable). Used by `data-points` gate.
   - `none` — display-only widget (KeyEquation, Plot for read-only viewing). No state registration.

2. **Free-text input?** (single-select) — does the widget collect typed student text?
   - `yes` — use `ProtectedTextarea` / `ProtectedInput` (copy/paste protection per CLAUDE.md).
   - `no` — no protected input needed.

## Files to create

### 1. `src/lab-guide/widgets/<Name>.tsx`

Use the template in `templates/widget-<kind>.tsx.template` from this skill folder as the starting point. Substitute `__NAME__` with the widget name.

For all kinds **except `none`**, the component must:
- Import `useEffect` from `react` and `useRunner` from `../RunnerContext`.
- Read its persisted value (if any) from `state.widgetValues[id]`.
- Call `registerWidgetState(id, { kind: '<kind>', ...})` inside a `useEffect`, returning `registerWidgetState(id, null)` on cleanup.
- Accept an `id: string` prop minimum.

For `correct` / `keywords` / `data-points` widgets, the user will need a "check" action. **Do not** assume a `registerFooterButton` runner API exists — it doesn't yet (SPEC §13, not implemented). Render an inline `<button>` inside the widget body with a `// TODO(SPEC §13): migrate to phase-footer button registration when runner API lands` comment above it.

For free-text widgets, use `ProtectedTextarea` from `./ProtectedInput` — never raw `<textarea>`. Single-line goes through `ProtectedInput`.

Reference the existing widgets `Reflection.tsx` and `ConclusionStatement.tsx` for the `filled` shape; they are the canonical examples.

### 2. `tests/unit/lab-guide/widgets/<Name>.test.tsx`

Tests live under `tests/unit/<mirror>` to match the repo-wide convention
(gate tests in `tests/unit/lab-guide/`, sim tests in `tests/unit/simulations/`).
Create `tests/unit/lab-guide/widgets/` if it doesn't exist yet. Use the `@/`
alias to import the source widget — relative paths from this depth are noisy.

```ts
import { describe, expect, it } from 'vitest';
import * as Mod from '@/lab-guide/widgets/<Name>';

describe('<Name>', () => {
  it('exports the component', () => {
    expect(Mod.<Name>).toBeDefined();
    expect(typeof Mod.<Name>).toBe('function');
  });

  it.todo('registers widget state with kind <kind> on mount');
  it.todo('persists value via setWidgetValue');
  // TODO: full DOM tests need @testing-library/react + jsdom installed.
  //   npm i -D @testing-library/react @testing-library/jest-dom jsdom
  // Then add `test: { environment: 'jsdom', setupFiles: [...] }` to vite.config.ts.
});
```

For `kind: 'none'`, omit the registration `it.todo`.

## Registry edits — surface, don't apply

After writing the two files, **do not edit** `src/lab-guide/widgets/index.ts` or `src/routes/experiment.tsx` automatically. Print this exactly to the user:

> Two registry edits are needed. I have **not** applied them — confirm and I'll do it:
>
> **`src/lab-guide/widgets/index.ts`** — add this line in alphabetical order:
> ```ts
> export { <Name> } from './<Name>';
> ```
>
> **`src/routes/experiment.tsx`** — add this line to the `mdxComponents` object:
> ```ts
> <Name>: widgets.<Name>,
> ```
>
> Apply both?

Wait for explicit yes before using Edit on those files. If yes, place each export in alphabetical order with the existing entries.

## After applying (or skipping) the registry edits

End with a one-line summary listing what was created, then suggest the next step:

> Created `<Name>.tsx` + test stub. Next: implement the body, then add a phase MDX example like `<<Name> id="..." ... />` and wire a gate referencing `widgetIds: ['<that-id>']`.

Do not invent the Danish prop copy or the gate parameters — the user writes those.

## What NOT to do

- Do not run `npm test`, `npm run lint`, or `npm run build` — let the user verify on their own time.
- Do not create an MDX usage example file. Keep scope to the widget + test.
- Do not edit `src/lib/schema.ts` even if the widget kind suggests a new gate type. New gate kinds are a separate, deliberate change (CLAUDE.md "Adding a new gate kind" section).
- Do not skip the "kind" question by guessing from the widget name. `Quiz` could be `correct` *or* `none` (if it's an ungated practice quiz). Always ask.
