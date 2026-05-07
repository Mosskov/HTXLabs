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
}

export type ProgressEvent =
  | { type: 'milestone'; id: string; payload?: unknown }
  | { type: 'data-collected'; count: number }
  | { type: 'reset' };

export interface SimulationMeta {
  id: string;
  title: string;
  defaultParams: Record<string, number | string>;
  paramSchema: ParamSchema;
  milestones: string[];
}

export interface SimulationModule {
  default: React.ComponentType<SimulationProps>;
  meta: SimulationMeta;
  gates?: Record<string, (state: unknown) => boolean>;
}
