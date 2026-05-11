# Content authoring

Loaded on demand when files under `src/content/` are read.

## Adding a new lab

1. `src/content/experiments/<topic>/<slug>/` with `theory.mdx`, one `phase-<id>.mdx` per phase, and `index.ts` exporting `{ frontmatter, Theory, phaseBodies }`.
2. New topic? Add `src/content/topics/<slug>.ts` with `frontmatter: TopicFrontmatter` (the `id` field must equal the folder name under `experiments/`).
3. New simulation? Add `src/simulations/<id>/` (default-exported component + `meta`) and register it in `src/lib/simulations.ts`.
4. New MDX widget? Implement in `src/lab-guide/widgets/`, export from `widgets/index.ts`, then add it to the `mdxComponents` map in `src/lab-guide/widgets/mdx.ts` so it's available without explicit imports.

Canonical phase ids are the 7 from SPEC §2 — don't invent new ones.
