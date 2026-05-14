# Sim contract

This module is the framework ↔ sim boundary (see "Three seams" in the root `CLAUDE.md`).

**Do not extend `index.ts` without discussion** — every sim depends on its shape, and growing the contract erodes the isolation that lets sims be developed and tested independently.

Precedent for additions: `initialState?: unknown` was added once for sim-state persistence (the runner replays the last `onState` payload here on remount; SPEC §10 documents the round-trip). The bar for similar additions: a real user-visible bug that can't be solved within the existing contract, AND an opt-in shape so sims that ignore the new field behave as before.
