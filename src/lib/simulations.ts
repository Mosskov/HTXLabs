import { NO_SIMULATION, type SimulationModule } from '@/sim-contract';

/**
 * Simulation registry — id → lazy importer. Lab pages dynamic-import via this
 * map so each simulation is its own JS chunk (only loaded when its lab opens).
 *
 * Add a new simulation: drop a folder under src/simulations/<id>/ exporting a
 * default React component + meta, then register it here.
 */
export const simulationRegistry: Record<string, () => Promise<SimulationModule>> = {
  'dynamometer-g': () => import('@/simulations/dynamometer-g'),
  'template-sim': () => import('@/simulations/template-sim'),
  testbed: () => import('@/simulations/testbed'),
};

export async function loadSimulation(id: string): Promise<SimulationModule | undefined> {
  if (id === NO_SIMULATION) return undefined;
  const loader = simulationRegistry[id];
  if (!loader) {
    console.warn(`[simulations] unknown id: ${id}`);
    return undefined;
  }
  return loader();
}
