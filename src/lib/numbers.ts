// DK number conventions: comma decimal separator, accept both ',' and '.' on input,
// warn on mixed-style entry across a session.

const dkFormatter = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 6 });

export function formatDK(n: number, fractionDigits?: number): string {
  if (typeof fractionDigits === 'number') {
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n);
  }
  return dkFormatter.format(n);
}

export type DecimalStyle = 'comma' | 'point' | 'none';

export function detectDecimalStyle(input: string): DecimalStyle {
  if (input.includes(',')) return 'comma';
  if (input.includes('.')) return 'point';
  return 'none';
}

/** Parse a Danish-or-international number string. Returns NaN if unparseable. */
export function parseDK(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') return Number.NaN;
  const normalised = trimmed.replace(/\s/g, '').replace(',', '.');
  const n = Number(normalised);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Tolerance can be '5%', '0.05', or '±0.1'. */
export function withinTolerance(value: number, target: number, tolerance: string): boolean {
  if (Number.isNaN(value) || Number.isNaN(target)) return false;
  const t = tolerance.trim();
  if (t.endsWith('%')) {
    const pct = Number(t.slice(0, -1)) / 100;
    if (!Number.isFinite(pct)) return false;
    return Math.abs(value - target) <= Math.abs(target) * pct;
  }
  const abs = Number(t.replace('±', '').replace(',', '.'));
  if (!Number.isFinite(abs)) return false;
  return Math.abs(value - target) <= abs;
}

export function relativeDifference(measured: number, reference: number): number {
  if (reference === 0) return Number.NaN;
  return (measured - reference) / reference;
}
