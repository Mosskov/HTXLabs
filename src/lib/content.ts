import type { ComponentType } from 'react';
import { ExperimentFrontmatter, type Gate, TopicFrontmatter } from './schema';

/**
 * Gate kinds whose backing widget/sim wiring is implemented in this build.
 * Authoring a gate of any other kind is rejected at module-load with a
 * descriptive error — see `validateAuthorableGates`. Re-enable a kind here
 * once the corresponding sim hook lands (e.g. `predicate` once a sim exports
 * a `gates` map; `milestone` / `data-points` once a sim fires the matching
 * `ProgressEvent`s).
 */
const AUTHORABLE_GATE_KINDS: ReadonlySet<Gate['type']> = new Set([
  'always',
  'all-filled',
  'all-checked',
  'all-correct',
  'keyword-count',
]);

export function validateAuthorableGates(
  fm: ExperimentFrontmatter,
  ctx: { topic: string; slug: string },
): void {
  const supported = Array.from(AUTHORABLE_GATE_KINDS).join(', ');
  const modeEntries: Array<[string, { phases: { id: string; gate: Gate }[] } | undefined]> = [
    ['guided', fm.modes.guided],
    ['semi-guided', fm.modes['semi-guided']],
    ['open', fm.modes.open],
  ];
  for (const [modeName, modeBlock] of modeEntries) {
    if (!modeBlock) continue;
    for (const phase of modeBlock.phases) {
      if (!AUTHORABLE_GATE_KINDS.has(phase.gate.type)) {
        throw new Error(
          `[content] ${ctx.topic}/${ctx.slug} mode "${modeName}" phase "${phase.id}" uses gate kind "${phase.gate.type}", which requires sim wiring not yet implemented in this build. Supported kinds: ${supported}.`,
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
