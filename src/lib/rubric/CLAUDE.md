# Rubric engine

Loaded on demand when files under `src/lib/rubric/` are read.

## Bundle hygiene

Never import `@huggingface/transformers` from anywhere under `src/`. The embedder is reached via the `Embedder` interface in [embedder.ts](./embedder.ts); concrete model code lives in `scripts/embed-server.mjs`. The package is in **devDependencies** for exactly this reason — Vite globs `src/` for the client bundle, `scripts/` is invisible to the build, and the boundary is enforced structurally.

## What lives here

- [schema.ts](./schema.ts) — Zod schemas (`RubricSchema`, `CriterionSchema`, …). All `z.object` calls are `.strict()`; `RubricSchema.superRefine` enforces unique criterion ids. Hand-authored JSON typos fail at module-load.
- [engine.ts](./engine.ts) — `parseRubric(unknown)` for load-time validation, `evaluateRubric(text, rubric, embedder, opts?)` for the actual scoring. `evaluateRubric` is total over its argument types and never throws — bad regex → `skipped-bad-regex`, embedder failure → `skipped-embedder`.
- [embedder.ts](./embedder.ts) — `Embedder` interface + `HttpEmbedder` (talks to localhost:8001) + `MockEmbedder` (test-only, direct text → vector lookup).

The engine is pure (sibling of `regression.ts`, `textMatch.ts`). No React, no I/O. Consumers: the dev-only diagnostic component in [src/lab-guide/dev/RubricTester.tsx](../../lab-guide/dev/RubricTester.tsx), and (Phase 2) the future free-text gate kind.

## Literal matching is whole-word (Unicode-aware)

`literal` checks and vetoes match on whole-word boundaries via `\p{L}\p{N}` lookarounds with the `u` flag — so a term `"afhængig"` does *not* fire inside `"uafhængig"`, and Danish letters at boundaries are respected. The match is also case-insensitive. Inflected forms are NOT covered automatically (e.g. `"afhængig"` doesn't match `"afhængige"`); list inflected variants explicitly or reach for `regex` if you need fuzzy matching.
