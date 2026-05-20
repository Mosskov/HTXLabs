# Content authoring

Loaded on demand when files under `src/content/` are read.

## Adding a new lab

1. `src/content/experiments/<topic>/<slug>/` with `theory.mdx`, one `phase-<id>.mdx` per phase, and `index.ts` exporting `{ frontmatter, Theory, phaseBodies }`.
2. New topic? Add `src/content/topics/<slug>.ts` with `frontmatter: TopicFrontmatter` (the `id` field must equal the folder name under `experiments/`).
3. New simulation? Add `src/simulations/<id>/` (default-exported component + `meta`) and register it in `src/lib/simulations.ts`.
4. New MDX widget? Implement in `src/lab-guide/widgets/`, export from `widgets/index.ts`, then add it to the `mdxComponents` map in `src/lab-guide/widgets/mdx.ts` so it's available without explicit imports.

Canonical phase ids are the 7 from SPEC §2 — don't invent new ones.

**`theory.mdx` must be sufficient to answer Phase 1.** The `<RubricResponse>` widget's first-tier hint nudges students back to the theory section ("Har du læst teoriafsnittet igennem?"); if a lab's theory leaves a Phase-1 rubric criterion unaddressable, that hint is a dead end.

## Phase text — three layers, three roles

Each phase has an instruction-box, an MDX prose body, and one or more widgets with their own labels. They are **not** three places to say the same thing:

- **Instruction-box** (`steps: string[]` in frontmatter) — owns the *task list*. Framework renders `Fase N – {title}:` header + a/b/c lettering automatically. Use `steps` for almost every phase, even single-task ones (one-item array still gets the header, no `a.` prefix). The legacy `intro: string` is the rare opt-out for a one-sentence phase with no header; schema rejects both fields at once. An object-form step may carry an optional `lockedHint` — tooltip text shown while the step renders `locked`; omit it for the generic `strings.da.ts` default.
- **MDX prose** (the paragraphs around widgets in `phase-<id>.mdx`) — owns *motivation / why this matters / scaffolding questions / operational guidance*. Never restate a step here. If you can't think of motivation worth writing, drop the prose paragraph.
- **Widget label** (the `prompt`, `label`, or item labels on widgets) — owns the *concrete input prompt* (what the student should type or select right now).

The canonical example is `testlabs/template/` — read it before authoring a new lab.
