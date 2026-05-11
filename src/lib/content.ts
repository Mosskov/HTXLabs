import { GATE_KINDS, SIM_DRIVEN_GATE_KINDS } from '@/lab-guide/gates';
import { NO_SIMULATION, type SimulationMeta } from '@/sim-contract';
import type { ComponentType } from 'react';
import {
  CANONICAL_PHASE_IDS,
  ExperimentFrontmatter,
  type Gate,
  type Phase,
  TopicFrontmatter,
} from './schema';

/**
 * Gate kinds available to any author by default — i.e. on theory-only labs
 * (`simulationId === NO_SIMULATION`). Sim-driven kinds (`SIM_DRIVEN_GATE_KINDS`)
 * require a wired simulation; `validateAuthorableGates` admits them as soon as
 * the lab declares a non-`__none` `simulationId`. The `test` tag still
 * short-circuits validation entirely so the framework testbed can exercise
 * sim-driven kinds against an ad-hoc sim regardless of wiring conventions.
 */
const AUTHORABLE_GATE_KINDS: ReadonlySet<Gate['type']> = new Set(
  GATE_KINDS.filter((k) => !(SIM_DRIVEN_GATE_KINDS as readonly Gate['type'][]).includes(k)),
);

const CANONICAL_PHASE_ID_SET: ReadonlySet<string> = new Set(CANONICAL_PHASE_IDS);

function modeEntries(fm: ExperimentFrontmatter): Array<[string, { phases: Phase[] } | undefined]> {
  return [
    ['guided', fm.modes.guided],
    ['semi-guided', fm.modes['semi-guided']],
    ['open', fm.modes.open],
  ];
}

export function validateAuthorableGates(
  fm: ExperimentFrontmatter,
  ctx: { topic: string; slug: string },
): void {
  if (fm.tags?.includes('test')) return;
  // Sim-driven gate kinds are available once the lab wires a real sim — their
  // handlers are fully implemented and `validateSimGateRefs` cross-checks
  // milestone ids. Theory-only labs stay restricted so a stray `data-points`
  // gate can't create a permanent lock.
  const hasSim = fm.simulationId !== NO_SIMULATION;
  const allowedKinds: ReadonlySet<Gate['type']> = hasSim
    ? new Set<Gate['type']>(GATE_KINDS)
    : AUTHORABLE_GATE_KINDS;
  const supported = Array.from(allowedKinds).join(', ');
  for (const [modeName, modeBlock] of modeEntries(fm)) {
    if (!modeBlock) continue;
    for (const phase of modeBlock.phases) {
      if (!allowedKinds.has(phase.gate.type)) {
        throw new Error(
          `[content] ${ctx.topic}/${ctx.slug} mode "${modeName}" phase "${phase.id}" uses gate kind "${phase.gate.type}", which requires sim wiring not yet implemented in this build. Supported kinds: ${supported}.`,
        );
      }
      if (!CANONICAL_PHASE_ID_SET.has(phase.id)) {
        console.warn(
          `[content] ${ctx.topic}/${ctx.slug} mode "${modeName}" uses non-canonical phase id "${phase.id}". SPEC §2 defines: ${CANONICAL_PHASE_IDS.join(', ')}. Tag the lab with "test" to silence.`,
        );
      }
    }
  }
}

/** Cross-check that every `milestone` gate references an id the resolved sim
 * has declared in `meta.milestones`. Catches typos like `m11` for `m1` that
 * would otherwise silently never satisfy. Runs for any lab that has a sim
 * with declared milestones; safe to skip when either is missing. */
export function validateSimGateRefs(
  fm: ExperimentFrontmatter,
  simMeta: SimulationMeta | undefined,
  ctx: { topic: string; slug: string },
): void {
  if (!simMeta) return;
  const declared = new Set(simMeta.milestones);
  for (const [modeName, modeBlock] of modeEntries(fm)) {
    if (!modeBlock) continue;
    for (const phase of modeBlock.phases) {
      if (phase.gate.type !== 'milestone') continue;
      if (!declared.has(phase.gate.requires)) {
        const known = simMeta.milestones.length ? simMeta.milestones.join(', ') : '(none declared)';
        throw new Error(
          `[content] ${ctx.topic}/${ctx.slug} mode "${modeName}" phase "${phase.id}" requires milestone "${phase.gate.requires}", which sim "${simMeta.id}" does not declare. Known milestones: ${known}.`,
        );
      }
    }
  }
}

export interface LoadedExperiment {
  frontmatter: ExperimentFrontmatter;
  topic: string;
  slug: string;
  Theory: ComponentType;
  phaseBodies: Record<string, ComponentType>;
}

export interface LoadedTopic {
  frontmatter: TopicFrontmatter;
  experiments: Array<{ slug: string; frontmatter: ExperimentFrontmatter }>;
}

/**
 * Each experiment lives at src/content/experiments/<topic>/<slug>/index.ts
 * exporting { frontmatter, Theory, phaseBodies }. We collect them eagerly via
 * import.meta.glob and validate frontmatter with Zod at module-load time so a
 * malformed lab fails the build/dev startup, not the runtime.
 */
type ExperimentModule = {
  frontmatter: unknown;
  Theory: ComponentType;
  phaseBodies: Record<string, ComponentType>;
};

const experimentModules = import.meta.glob<ExperimentModule>(
  '../content/experiments/*/*/index.ts',
  { eager: true },
);

const topicModules = import.meta.glob<{ frontmatter: unknown }>('../content/topics/*.ts', {
  eager: true,
});

/** Eagerly indexed sim metadata, keyed by `meta.id`. Used to cross-check lab
 * `milestone` gate ids against the resolved sim's declared milestones at
 * module-load (see `validateSimGateRefs`). The component itself stays lazy via
 * `simulationRegistry`; only the small `meta` export is eager. */
const simMetaModules = import.meta.glob<{ meta: SimulationMeta }>('../simulations/*/meta.ts', {
  eager: true,
});
const simMetasById = new Map<string, SimulationMeta>();
for (const mod of Object.values(simMetaModules)) {
  if (mod.meta?.id) simMetasById.set(mod.meta.id, mod.meta);
}

type IndexedEntry =
  | {
      ok: true;
      topicSlug: string;
      experimentSlug: string;
      validated: ExperimentFrontmatter;
      Theory: ComponentType;
      phaseBodies: Record<string, ComponentType>;
    }
  | {
      ok: false;
      topicSlug: string;
      experimentSlug: string;
      error: string;
    };

const experimentsIndex: IndexedEntry[] = [];

for (const [path, mod] of Object.entries(experimentModules)) {
  // path = '../content/experiments/<topic>/<slug>/index.ts'
  const match = path.match(/experiments\/([^/]+)\/([^/]+)\/index\.ts$/);
  if (!match) continue;
  const [, topicSlug, experimentSlug] = match;
  if (!topicSlug || !experimentSlug) continue;
  const parsed = ExperimentFrontmatter.safeParse(mod.frontmatter);
  if (!parsed.success) {
    console.error(`[content] invalid frontmatter at ${path}:`, parsed.error.format());
    experimentsIndex.push({
      ok: false,
      topicSlug,
      experimentSlug,
      error: `Ugyldig frontmatter:\n${JSON.stringify(parsed.error.format(), null, 2)}`,
    });
    continue;
  }
  // Reject gate kinds whose widget/sim wiring isn't implemented in this build —
  // otherwise the student gets a silent permanent lock. See AUTHORABLE_GATE_KINDS.
  try {
    validateAuthorableGates(parsed.data, { topic: topicSlug, slug: experimentSlug });
    validateSimGateRefs(parsed.data, simMetasById.get(parsed.data.simulationId), {
      topic: topicSlug,
      slug: experimentSlug,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[content] ${topicSlug}/${experimentSlug} disabled:`, message);
    experimentsIndex.push({ ok: false, topicSlug, experimentSlug, error: message });
    continue;
  }
  experimentsIndex.push({
    ok: true,
    topicSlug,
    experimentSlug,
    validated: parsed.data,
    Theory: mod.Theory,
    phaseBodies: mod.phaseBodies,
  });
}

const topicsIndex = new Map<string, TopicFrontmatter>();
for (const [path, mod] of Object.entries(topicModules)) {
  const match = path.match(/topics\/([^/]+)\.ts$/);
  if (!match) continue;
  const slug = match[1];
  if (!slug) continue;
  const parsed = TopicFrontmatter.safeParse(mod.frontmatter);
  if (!parsed.success) {
    console.error(`[content] invalid topic at ${path}:`, parsed.error.format());
    throw new Error(`Invalid topic frontmatter at ${path}`);
  }
  topicsIndex.set(slug, parsed.data);
}

/** Result of loading a single experiment by topic+slug. `null` = no such folder
 * was indexed (404). `{ error }` = the lab exists but failed validation, so
 * other labs aren't blocked but this one renders an error card. Otherwise the
 * normal `LoadedExperiment` payload. */
export type LoadExperimentResult = LoadedExperiment | { error: string };

export function loadExperiment(topic: string, slug: string): LoadExperimentResult | null {
  const found = experimentsIndex.find((e) => e.topicSlug === topic && e.experimentSlug === slug);
  if (!found) return null;
  if (!found.ok) return { error: found.error };
  return {
    frontmatter: found.validated,
    topic: found.topicSlug,
    slug: found.experimentSlug,
    Theory: found.Theory,
    phaseBodies: found.phaseBodies,
  };
}

function validExperimentsForTopic(
  topicSlug: string,
): Array<{ slug: string; frontmatter: ExperimentFrontmatter }> {
  return experimentsIndex.flatMap((e) =>
    e.ok && e.topicSlug === topicSlug ? [{ slug: e.experimentSlug, frontmatter: e.validated }] : [],
  );
}

export function listTopics(): LoadedTopic[] {
  return Array.from(topicsIndex.entries())
    .map(([_, frontmatter]) => ({
      frontmatter,
      experiments: validExperimentsForTopic(frontmatter.id),
    }))
    .sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}

export function loadTopic(slug: string): LoadedTopic | null {
  const fm = topicsIndex.get(slug);
  if (!fm) return null;
  return { frontmatter: fm, experiments: validExperimentsForTopic(slug) };
}
