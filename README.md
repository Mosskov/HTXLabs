# HTX Labs

Static educational website for Danish HTX physics students. See [SPEC.md](./SPEC.md) for the full design. For current focus and working conventions, see [docs/STATUS.md](./docs/STATUS.md).

## Stack

Vite + React 18 + TypeScript + Tailwind CSS 3 + MDX + react-router. Static-only (deploys to GitHub Pages). Full rationale in [SPEC.md §6](./SPEC.md).

## Quick start

```sh
npm install
npm run dev          # Vite dev server with HMR
npm run build        # static export → ./dist
npm run preview      # serve ./dist locally
npm test             # Vitest in watch mode
npm run lint         # Biome lint+format check
```

Open the local URL printed by `npm run dev`. The home page lists topics, each topic page lists experiments, and each experiment URL is a full lab guide.

## Authoring a new lab

1. Create a folder `src/content/experiments/<topic>/<slug>/`.
2. Drop `theory.mdx` and one `phase-<id>.mdx` per phase.
3. Create `index.ts` exporting `frontmatter` (validated against `ExperimentFrontmatter` from `src/lib/schema.ts`), `Theory`, and `phaseBodies`.
4. Save. Vite picks it up via `import.meta.glob` and the lab appears under its topic.

If you need a simulation, drop one under `src/simulations/<id>/` and register it in `src/lib/simulations.ts`.

## Authoring a new topic

Create `src/content/topics/<slug>.ts` exporting a `frontmatter: TopicFrontmatter`. That's all.

## Repository layout

See SPEC.md §7 for the full layout. Highlights:

- `src/lab-guide/` — the framework: runner, gates, stepper, footer, simulation panel, widgets.
- `src/sim-contract/` — the simulation interface; the only thing simulations import from outside themselves.
- `src/content/` — MDX content + frontmatter for topics and experiments.
- `src/simulations/` — one folder per simulation; pure physics in `physics.ts`, React component in `index.tsx`.
- `src/lib/` — shared helpers: content loader, Zod schemas, regression, DK numbers, hashing.

## Deployment

GitHub Actions workflow in `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to `main`. For a project page (e.g. `username.github.io/htxlabs/`), the build sets `BASE_URL` to `/<repo>/` automatically.

For a custom domain, drop a `CNAME` file in `public/` and clear `BASE_URL` in the workflow.

## Spec

The full design lives in [SPEC.md](./SPEC.md). Anything ambiguous in this README — defer to the spec.
