import { useMemo } from 'react';
import type { SimulationProps } from '@/sim-contract';
import { meta } from './meta';
// Pure helpers go in ./physics — keep this component free of math.
// import { ... } from './physics';

/**
 * dynamometer-g — input-driven simulation.
 * Visual state is derived from `params` on every render; no animation loop.
 *
 * Seam: do NOT import from '@/lab-guide'. Cross-talk happens via props.onProgress
 * and props.initialParams only.
 */
function DynamometerG_Component({
  width,
  height,
  initialParams,
  onProgress: _onProgress,
  onParamChange: _onParamChange,
}: SimulationProps) {
  const params = useMemo(
    () => ({ ...meta.defaultParams, ...(initialParams ?? {}) }),
    [initialParams],
  );

  // TODO: derive visual quantities from `params` here.
  // Example: const force = forceFor(params.mass as number, 9.82);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={meta.title}
    >
      {/* TODO: draw the simulation. */}
    </svg>
  );
}

export { meta } from './meta';
export default DynamometerG_Component;
