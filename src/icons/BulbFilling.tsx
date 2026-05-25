// Filling-bulb icon — countdown HintBucket state. Yellow fill rises from the
// bottom of the bulb body as `fillPct` (0..100) grows; in the real HintBucket
// the value is recomputed each tick from `msUntilNext / replenishMs`. Empty
// portion = light gray so the outline stays readable on the slate-100 button
// shell. Yellow is `#FCD34D` at 0.4 opacity to match the no-targets faint
// yellow — countdown + no-targets share one muted yellow tint.
//
// Uses React's `useId()` for the interior clipPath id so multiple instances
// on a page don't collide.
import { type SVGProps, useId } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  /** Fill level 0–100. Clamped if out of range. */
  fillPct: number;
}

export function BulbFilling({ fillPct, ...props }: Props) {
  const clipId = useId();
  // Bulb body interior runs roughly y≈3 (top of dome) to y≈17 (bottom edge
  // where it meets the base). Fill from bottom up.
  const bodyTop = 3;
  const bodyBottom = 17;
  const fillY = bodyBottom - ((bodyBottom - bodyTop) * Math.max(0, Math.min(100, fillPct))) / 100;
  const bulbPath =
    'M12 2.5 C8.5 2.5 5.5 5.3 5.5 8.8 c0 2.4 1.3 4.4 2.9 5.7 L8.8 17 h6.4 l0.4 -2.5 c1.6 -1.3 2.9 -3.3 2.9 -5.7 C18.5 5.3 15.5 2.5 12 2.5 z';
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <title>Hint genopfyldes</title>
      <defs>
        <clipPath id={clipId}>
          <path d={bulbPath} />
        </clipPath>
      </defs>
      {/* Empty interior */}
      <path d={bulbPath} fill="#F3F4F6" stroke="none" />
      {/* Faint-yellow fill clipped to the bulb interior */}
      <rect
        x="0"
        y={fillY}
        width="24"
        height={24 - fillY}
        fill="#FCD34D"
        opacity="0.4"
        clipPath={`url(#${clipId})`}
      />
      {/* Outline last so contour stays crisp over the fill */}
      <path d={bulbPath} fill="none" stroke="#9CA3AF" strokeWidth={1} />
      {/* Metal base */}
      <line
        x1="8.8"
        y1="18.2"
        x2="15.2"
        y2="18.2"
        stroke="#57534E"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <line
        x1="9.4"
        y1="20"
        x2="14.6"
        y2="20"
        stroke="#57534E"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <line
        x1="10.5"
        y1="21.7"
        x2="13.5"
        y2="21.7"
        stroke="#57534E"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}
