# Status

A snapshot of current focus and working conventions, for colleagues, IT, and any contributor opening the repo. Updated by hand when something material changes. For the durable design, see [SPEC.md](../SPEC.md). For parked ideas not on the immediate path, see [BACKLOG.md](./BACKLOG.md).

_Last synced: 2026-05-15 (rubric engine Phase 1 + review polish + manual calibration)._

## Current focus

### Recently landed
- **Rubric engine — Phase 1 (2026-05-15, commit `e8ebce8`).** Pure scoring engine for free-form student responses (hypotheses, conclusions, …) at [`src/lib/rubric/`](../src/lib/rubric/). Three check kinds (semantic / regex / literal), evidence (`any`) vs vetoes (`none`), orthogonal misconception regexes, never-throw contract. Semantic checks use a local Node service ([`scripts/embed-server.mjs`](../scripts/embed-server.mjs), `npm run dev:embed`) wrapping `Xenova/multilingual-e5-small` via `@huggingface/transformers` (devDep — bundle hygiene enforced; never imported from `src/`). Dev-only diagnostic UI at [`src/lab-guide/dev/RubricTester.tsx`](../src/lab-guide/dev/RubricTester.tsx) mounted by a testlab at `/emner/testlabs/rubric-test`. **Phase 1 is dev-only** — no widget/gate integration yet. See [SPEC.md §17.A](../SPEC.md).
- **Same-day review polish (2026-05-15, commit `68fef2a`).** Three review-driven fixes on Phase 1 + the sim-state persistence work. Literal checks/vetoes now match on whole-word boundaries via Unicode-aware lookarounds (a term `"afhængig"` no longer false-positives inside `"uafhængig"`; inflected forms must be listed explicitly or use `regex`). `CheckResult.pattern` + criterion-veto `pattern` surfaced so `RubricTester` names the failing pattern on bad-regex skips. `RunnerContext` flushes its 200 ms sim-state debounce on unmount and on `pagehide` so quick reloads no longer drop the latest snapshot.
- **Rubric testlab calibration session (2026-05-15).** Manual five-fixture pass (gold / anti-linear / pendulum off-topic / bare-IV-description / single-char) confirmed semantic-only at threshold 0.6 is unusable for gating — *all five* passed `requiredSatisfied: true`. Tightened the testlab rubric to **v2** (thresholds 0.85, dv literal expanded to `[afhængig, afhængige]`, **relation rebuilt as a mandatory single-clause regex** dropping the over-permissive semantic, misconception regex `(pendul|lod|svinger)` added to iv + relation). Result: pendulum off-topic now gate-blocked with misconception hints, anti-linear correctly distinguishes required-met from all-met, dv inflection fix lands. One residual flaw is intentionally left in the testlab as a teaching artifact (bare `uafhængig` in the relation regex also matches inside "den uafhængige variabel" — fix is `uafhængig` → `uafhængig af` when calibration resumes). Empirical conclusion that informs Phase 2: e5-small at threshold 0.85 has ~0.03 noise on short Danish prose, so semantic-only criteria for *specific-claim* requirements (direction-of-effect, linearity) aren't safely gateable at any threshold; regex/literal clauses end up doing the load-bearing work whenever a claim's *content* matters.

### In flight
- **Template lab — per-phase polish pass.** Multi-session pass to bring `testlabs/template` up to "copyable teaching example" quality. One session per phase (planlaeg → opstil → maal → analyser → diskuter → konkluder → rapporter), each covering (a) framework audit of that phase's gate kind + widgets + sim hooks, (b) develop anything missing or broken (including building the Graph widget during analyser, closing relevant Widget/Student-UX/Phase-3 backlog items), (c) content polish on the MDX. Symbolic framing kept throughout ("størrelse X og Y" — authors fill in physics).
- **dynamometer-g lab.** First real lab using the framework. Visuals settled; framework groundwork complete; gated on the template per-phase pass landing before MDX authoring begins.

### Queued
- **Framework skills roadmap.** `/new-widget` and `/new-simulation` exist. Next: `/review-lab`, `/new-lab`, `/bump-experiment-version`.
- **Student UX backlog.** Four fixes landed; queued: disabled-Next tooltip, within-phase progress indicator, autosave indicator, keyword highlighting in instruction-box. Keyword highlighting expected to be picked up during the `diskuter` phase session.
- **Widget enhancements.** Per-widget "is satisfied" indicator on `FreeTextResponse`, hint-surfacing flexibility (timing/triggers for `tooShortMessage`), per-group hints on keyword-mode `FreeTextResponse`, `textMatch` exact mode, per-lab visual variation. Several of these will be drained by the per-phase template pass (e.g. satisfied indicator during `planlaeg`, exact-mode `textMatch` during `diskuter`).
- **Phase-3 + sim work.** Phase-scope sim-published measurements to phase 3 only; add per-row clear in sim-mode `DataTable` (confirm intent); drop the `Målinger: N` chrome from `template-sim`. Expected to be picked up during the `maal` phase session.
- **Landing sim-disclosure (undecided).** On first visit to phase 1 the open sim panel buries the laboratorieguide. Two candidate fixes — default the sim closed, or surface the guide on the landing page — not yet chosen.
- **DataTable undo in sim mode.** No undo for auto-captured rows. Agreed fix is a `data-removed` `ProgressEvent` variant when prioritized.
- **Breadcrumb mode drift.** LabGuide breadcrumb shows the URL mode label even on silent fallback to guided. Revisit when a real lab declares multiple modes.
- **Rubric engine — Phase 2.** Widget integration (extend `FreeTextResponse` or add a new `<RubricResponse>` widget), new gate kind for required-criteria-met, hint pacing UI decision (immediate / delayed / on-button), semantic misconceptions (anchor-based vetoes), production embedder (in-browser WASM or backend so Phase 2 can ship to GitHub Pages), model-id-aware thresholds. Calibration session above settled threshold expectations and exposed the schema-shape lesson (regex/literal load-bearing for specific-claim criteria); next calibration cycle will be against real student answers from a live lab.

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
