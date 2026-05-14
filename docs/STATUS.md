# Status

A snapshot of current focus and working conventions, for colleagues, IT, and any contributor opening the repo. Updated by hand when something material changes. For the durable design, see [SPEC.md](../SPEC.md). For parked ideas not on the immediate path, see [BACKLOG.md](./BACKLOG.md).

_Last synced: 2026-05-14._

## Current focus

### In flight
- **dynamometer-g lab.** First real lab using the framework. Visuals settled; framework groundwork complete; next step is authoring the MDX content (theory + 7 phase bodies) starting from the template lab.
- **Template lab.** Canonical 7-phase generic example at `testlabs/template`. Pairs with `template-sim` and the DataTable single-knob flip. Used as the starting point when authoring new labs.

### Queued
- **Framework skills roadmap.** `/new-widget` and `/new-simulation` exist. Next: `/review-lab`, `/new-lab`, `/bump-experiment-version`.
- **Student UX backlog.** Four fixes landed; queued: disabled-Next tooltip, within-phase progress indicator, autosave indicator, keyword highlighting in instruction-box.
- **Widget enhancements.** Per-widget "is satisfied" indicator on `FreeTextResponse`, hint-surfacing flexibility (timing/triggers for `tooShortMessage`), per-group hints on keyword-mode `FreeTextResponse`, `textMatch` exact mode, per-lab visual variation.
- **Phase-3 + sim work (next session).** Phase-scope sim-published measurements to phase 3 only; add per-row clear in sim-mode `DataTable` (confirm intent); drop the `Målinger: N` chrome from `template-sim`. Discussed 2026-05-14; not yet committed scope.
- **Landing sim-disclosure (undecided).** On first visit to phase 1 the open sim panel buries the laboratorieguide. Two candidate fixes — default the sim closed, or surface the guide on the landing page — not yet chosen.
- **DataTable undo in sim mode.** No undo for auto-captured rows. Agreed fix is a `data-removed` `ProgressEvent` variant when prioritized.
- **Breadcrumb mode drift.** LabGuide breadcrumb shows the URL mode label even on silent fallback to guided. Revisit when a real lab declares multiple modes.

## Working conventions

Conventions that affect how contributors should work in this repo.

- **Never auto-deploy to GitHub Pages.** Pushing to `main` triggers the live deploy via `.github/workflows/deploy.yml`. Do not push to `main` without an explicit instruction from the maintainer. Local commits and feature branches are fine; the deploy gate is push-to-main.
- **Use only the 7 canonical phase ids** defined in [SPEC.md §2](../SPEC.md). Do not invent new ids (e.g. no `udforsk`). Authoring outside the canonical set will fail Zod validation at dev startup.
- **Author flexibility on student-facing strings.** Any widget that surfaces text to students (placeholders, hint messages, button labels) must accept an optional override prop so a teacher can tailor it per-instance from MDX without touching framework code. Framework defaults live in [`src/lab-guide/strings.da.ts`](../src/lab-guide/strings.da.ts). Reference implementation: `FreeTextResponse` (`placeholder?`, `tooShortMessage?`). See [SPEC §17](../SPEC.md).
- **Visual conventions (set 2026-05-11).** Single content width 768px (`maxWidth.lab` in `tailwind.config.ts`); shared dropdown class string across TheoryPanel and SimulationPanel; `px-4` indent on lab content (use `mx-4` for pre-padded boxes like `instruction-box`); no `lab-card` chrome on lab page content; compact centered `PhaseStepper`. Don't reintroduce per-element `max-w-prose` wrappers or `lab-card` on lab pages.

## Where to look for more

- [SPEC.md](../SPEC.md) — durable design, pedagogy, gate semantics, simulation contract, accessibility.
- [BACKLOG.md](./BACKLOG.md) — parking lot for ideas not on the immediate path.
- [CLAUDE.md](../CLAUDE.md) — repo-level architecture guidance (primary audience is AI assistants, but also informative for humans).
