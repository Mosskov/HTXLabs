import type { ComponentType } from 'react';
import { ExperimentFrontmatter, TopicFrontmatter } from './schema';

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

interface Indexed {
  topicSlug: string;
  experimentSlug: string;
  validated: ExperimentFrontmatter;
  Theory: ComponentType;
  phaseBodies: Record<string, ComponentType>;
}

const experimentsIndex: Indexed[] = [];

for (const [path, mod] of Object.entries(experimentModules)) {
  // path = '../content/experiments/<topic>/<slug>/index.ts'
  const match = path.match(/experiments\/([^/]+)\/([^/]+)\/index\.ts$/);
  if (!match) continue;
  const [, topicSlug, experimentSlug] = match;
  if (!topicSlug || !experimentSlug) continue;
  const parsed = ExperimentFrontmatter.safeParse(mod.frontmatter);
  if (!parsed.success) {
    console.error(`[content] invalid frontmatter at ${path}:`, parsed.error.format());
    throw new Error(`Invalid frontmatter at ${path}`);
  }
  // Cross-validation: every gate's referenced widgetIds & milestones should exist
  // at runtime; we can only check structurally here. Build-time deeper checks
  // are a future enhancement.
  experimentsIndex.push({
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

export function loadExperiment(topic: string, slug: string): LoadedExperiment | null {
  const found = experimentsIndex.find((e) => e.topicSlug === topic && e.experimentSlug === slug);
  if (!found) return null;
  return {
    frontmatter: found.validated,
    topic: found.topicSlug,
    slug: found.experimentSlug,
    Theory: found.Theory,
    phaseBodies: found.phaseBodies,
  };
}

export function listTopics(): LoadedTopic[] {
  return Array.from(topicsIndex.entries())
    .map(([_, frontmatter]) => {
      const experiments = experimentsIndex
        .filter((e) => e.topicSlug === frontmatter.id)
        .map((e) => ({ slug: e.experimentSlug, frontmatter: e.validated }));
      return { frontmatter, experiments };
    })
    .sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}

export function loadTopic(slug: string): LoadedTopic | null {
  const fm = topicsIndex.get(slug);
  if (!fm) return null;
  const experiments = experimentsIndex
    .filter((e) => e.topicSlug === slug)
    .map((e) => ({ slug: e.experimentSlug, frontmatter: e.validated }));
  return { frontmatter: fm, experiments };
}
