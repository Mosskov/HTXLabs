import type React from 'react';

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
  onParamChange?: (params: Record<string, number | string>) => void;
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

export interface SimulationMeta {
  id: string;
  title: string;
  mode: SimulationMode;
  defaultParams: Record<string, number | string>;
  paramSchema: ParamSchema;
  milestones: string[];
}

export interface SimulationModule {
  default: React.ComponentType<SimulationProps>;
  meta: SimulationMeta;
  gates?: Record<string, (state: unknown) => boolean>;
}
