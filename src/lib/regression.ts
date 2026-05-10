/** Ordinary-least-squares regression. Returns slope, intercept, R². */
export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
}

export function linearRegression(points: Array<[number, number]>): RegressionResult {
  const n = points.length;
  if (n < 2) return { slope: Number.NaN, intercept: Number.NaN, r2: Number.NaN };
  const sumX = points.reduce((s, [x]) => s + x, 0);
  const sumY = points.reduce((s, [, y]) => s + y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of points) {
    const dx = x - meanX;
    const dy = y - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return { slope: Number.NaN, intercept: Number.NaN, r2: Number.NaN };
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2 };
}
