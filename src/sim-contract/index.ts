import type React from 'react';

/** Sentinel `simulationId` for theory-only labs that ship no simulation. The
 * runtime registry (`src/lib/simulations.ts`) short-circuits to `undefined`
 * for this id rather than warning about an unknown sim. */
export const NO_SIMULATION = '__none';

export type ParamSchemaEntry =
  | { type: 'range'; min: number; max: number; step: number; unit: string }
  | { type: 'enum'; values: string[] };

export type ParamSchema = Record<string, ParamSchemaEntry>;

export interface SimulationProps {
  width: number;
  height: number;
  initialParams?: Record<string, number | string>;
  paused?: boolean;
  onProgress?: (e: ProgressEvent) => void;
  /** Publishes a snapshot of the sim's runtime state to the runner so that
   * `predicate` gates (which call `module.gates[name](state)`) have something
   * to evaluate. Optional: only sims with predicate-backed gates need to call
   * it. Frequency is up to the sim — once per relevant change is enough. */
  onState?: (state: unknown) => void;
}

export type ProgressEvent =
  | { type: 'milestone'; id: string; payload?: unknown }
  | { type: 'data-collected'; count: number }
  | { type: 'reset' };

/**
 * `display` — read-only renderer driven entirely by `initialParams` from the
 * lab guide. The lab guide owns the parameter controls (sliders, inputs).
 * Use for static-lookup sims like a dynamometer scale viewer. Rare.
 *
 * `interactive` — sim renders its own controls and drives its own animation.
 * MDX widgets focus on observation / data-collection. The expected mode for
 * new sims; pick this unless the sim is a pure read-only display.
 */
export type SimulationMode = 'display' | 'interactive';

/** Per-locale display strings for the sim. Sims own their own chrome rather
 * than pulling from `lab-guide/strings.da.ts` — see CLAUDE.md "Conventions"
 * (sim-Danish convention). Only `da` is shipped today; add more as needed. */
export interface SimulationLocale {
  da: {
    /** Danish display title used in lab pages and the simulation playground. Falls back
     * to `meta.title` when omitted. */
    title?: string;
  };
}

export interface SimulationMeta {
  id: string;
  /** Canonical/internal title — kept stable for code references. The
   * student-facing display string is `locale.da.title` (with this as
   * fallback). */
  title: string;
  mode: SimulationMode;
  defaultParams: Record<string, number | string>;
  paramSchema: ParamSchema;
  milestones: string[];
  /** Optional per-locale display overrides; see `SimulationLocale`. */
  locale?: SimulationLocale;
}

/** Resolve the Danish display title from sim metadata. Use this in any UI
 * that surfaces a sim title to a Danish-speaking student or teacher. */
export function simTitleDa(meta: SimulationMeta): string {
  return meta.locale?.da?.title ?? meta.title;
}

export interface SimulationModule {
  default: React.ComponentType<SimulationProps>;
  meta: SimulationMeta;
  gates?: Record<string, (state: unknown) => boolean>;
}
