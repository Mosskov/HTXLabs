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

/**
 * Gate kinds that are only safe in `devOnly: true` (or `tags: ['test']`) labs:
 *   - `rubric-required` depends on the local embed server, which is not shipped
 *     in production builds — a non-devOnly lab using it would silently lock.
 * The `test` tag still short-circuits the validator entirely (see top of
 * `validateAuthorableGates`); devOnly labs are accepted here.
 */
const DEV_ONLY_GATE_KINDS: ReadonlySet<Gate['type']> = new Set<Gate['type']>(['rubric-required']);

const DEV_ONLY_GATE_REASONS: Record<string, string> = {
  'rubric-required': 'requires the local embed server, which is not shipped in production',
};

/** Pattern matches `<RubricResponse ...>` and `<RubricResponse/>` openings in
 *  raw MDX. JSX requires the component reference to appear by name at every
 *  call site, so a substring scan is sufficient — no MDX parser needed. */
const RUBRIC_WIDGET_PATTERN = /<RubricResponse(\s|\/|>)/;

const CANONICAL_PHASE_ID_SET: ReadonlySet<string> = new Set(CANONICAL_PHASE_IDS);

/** A lab tagged `devOnly: true` is unreachable in the production build — used
 * by labs that require the local embed server (rubric engine). The `prod`
 * argument is injectable so the predicate is testable without module reset. */
export function isVisibleInEnv(
  fm: ExperimentFrontmatter,
  prod: boolean = import.meta.env.PROD,
): boolean {
  return !(fm.devOnly && prod);
}

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
      if (DEV_ONLY_GATE_KINDS.has(phase.gate.type) && !fm.devOnly) {
        const reason = DEV_ONLY_GATE_REASONS[phase.gate.type] ?? 'dev-only feature';
        throw new Error(
          `[content] ${ctx.topic}/${ctx.slug} mode "${modeName}" phase "${phase.id}" uses gate kind "${phase.gate.type}", which ${reason}. Set \`devOnly: true\` in frontmatter until a production path lands.`,
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

/** Production-safety check for widgets whose runtime depends on dev-only
 *  infrastructure. Currently only `<RubricResponse>` qualifies: it talks to
 *  the local embed server, which isn't shipped in production. A non-devOnly
 *  lab using the widget would render with `embedderDown: true` and silently
 *  lock any gate (rubric-required, all-satisfied, etc.) that depends on its
 *  `satisfied` bit — exactly the failure mode that `DEV_ONLY_GATE_KINDS`
 *  prevents for the direct `rubric-required` gate. We do this by raw-scanning
 *  MDX phase bodies plus sibling TSX wrappers under `<topic>/<slug>/` (a real
 *  lab can render the widget through a co-located helper component) because
 *  the gate-kind validator can't distinguish which widget an
 *  `all-satisfied`/`all-validated` `widgetIds` entry points to. */
export function validateProductionSafeWidgets(
  fm: ExperimentFrontmatter,
  usesRubricWidget: boolean,
  ctx: { topic: string; slug: string },
): void {
  if (fm.tags?.includes('test')) return;
  if (!usesRubricWidget || fm.devOnly) return;
  throw new Error(
    `[content] ${ctx.topic}/${ctx.slug} uses <RubricResponse>, which ${DEV_ONLY_GATE_REASONS['rubric-required']}. Set \`devOnly: true\` in frontmatter until a production path lands.`,
  );
}

/** Scan raw experiment-local sources for `<RubricResponse>` usage and return
 *  the set of `${topic}/${slug}` keys that reference the widget. Inputs are
 *  paths under `../content/experiments/<topic>/<slug>/` (MDX phase bodies
 *  plus sibling TSX wrappers — both can render the widget directly) keyed
 *  to their raw source. Exported for unit testing; the production call wires
 *  in `import.meta.glob`. */
export function findLabsUsingRubricWidget(sources: Record<string, string>): Set<string> {
  const labs = new Set<string>();
  for (const [path, source] of Object.entries(sources)) {
    const match = path.match(/experiments\/([^/]+)\/([^/]+)\//);
    if (!match) continue;
    const [, topicSlug, experimentSlug] = match;
    if (!topicSlug || !experimentSlug) continue;
    if (RUBRIC_WIDGET_PATTERN.test(source)) {
      labs.add(`${topicSlug}/${experimentSlug}`);
    }
  }
  return labs;
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

/** Raw content source per `<topic>/<slug>`, used by
 *  `validateProductionSafeWidgets` to detect `<RubricResponse>` usage that
 *  the frontmatter-only gate-kind validator can't see (e.g. when wrapped in
 *  `all-satisfied`). We scan both `.mdx` phase bodies and sibling `.tsx`
 *  files under the same `<topic>/<slug>/` folder — a co-located TSX wrapper
 *  imported from MDX would otherwise let a lab smuggle the widget into a
 *  non-devOnly build. The `?raw` query bypasses the MDX/TS rollup plugins
 *  so we get the source string, not the compiled component. */
const rawSourceModules = import.meta.glob<{ default: string }>(
  '../content/experiments/*/*/*.{mdx,tsx}',
  { eager: true, query: '?raw' },
);
const rawSources: Record<string, string> = {};
for (const [path, mod] of Object.entries(rawSourceModules)) {
  rawSources[path] = mod.default;
}
const labsUsingRubricWidget = findLabsUsingRubricWidget(rawSources);

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
  // devOnly labs vanish from the production index entirely — no 404 card,
  // no listTopics entry, no loadExperiment hit. Dev builds always see them.
  if (!isVisibleInEnv(parsed.data)) continue;
  // Reject gate kinds whose widget/sim wiring isn't implemented in this build —
  // otherwise the student gets a silent permanent lock. See AUTHORABLE_GATE_KINDS.
  try {
    validateAuthorableGates(parsed.data, { topic: topicSlug, slug: experimentSlug });
    validateSimGateRefs(parsed.data, simMetasById.get(parsed.data.simulationId), {
      topic: topicSlug,
      slug: experimentSlug,
    });
    validateProductionSafeWidgets(
      parsed.data,
      labsUsingRubricWidget.has(`${topicSlug}/${experimentSlug}`),
      { topic: topicSlug, slug: experimentSlug },
    );
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
    .filter((t) => t.experiments.length > 0)
    .sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}

export function loadTopic(slug: string): LoadedTopic | null {
  const fm = topicsIndex.get(slug);
  if (!fm) return null;
  const experiments = validExperimentsForTopic(slug);
  if (experiments.length === 0) return null;
  return { frontmatter: fm, experiments };
}
