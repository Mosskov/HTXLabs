# Simulations

Loaded on demand when files under `src/simulations/` are read.

**Sim Danish lives in the sim folder** (sim-Danish convention): `lab-guide/strings.da.ts` is for lab-shell + widgets only. Sims own their own chrome — display title via `meta.locale.da.title` in `meta.ts`, in-sim labels in a colocated `src/simulations/<id>/strings.da.ts`. Sims do not import from `lab-guide/`. Render the title via `simTitleDa(meta)` from `sim-contract` (falls back to `meta.title`).
