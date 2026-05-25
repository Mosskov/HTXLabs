// Cracked-bulb icon — depleted HintBucket state. The bulb is drawn in two
// physically separated pieces with a jagged horizontal break across the body;
// the top dome tilts ~14° as if toppling off the base. No yellow — gray body
// reads as "broken / used up". Illustrative palette (hardcoded fills), not
// currentColor.
import type { SVGProps } from 'react';

export function BulbCracked(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <title>Tom hint-pulje</title>
      {/* Top dome — tilted ~14° so it reads as broken off and tipping. Pivot
       *  at the left-edge break point so the right side swings up and away. */}
      <g transform="rotate(-14 7 12) translate(0.5 -0.5)">
        <path
          d="M12 2.5
             C8.5 2.5 5.5 5.3 5.5 8.8
             C5.5 9.9 5.8 10.9 6.4 11.7
             L7.5 11.2
             L9 12.1
             L10.5 11.3
             L12 12.2
             L13.5 11.3
             L15 12.1
             L16.5 11.2
             L17.6 11.7
             C18.2 10.9 18.5 9.9 18.5 8.8
             C18.5 5.3 15.5 2.5 12 2.5 z"
          fill="#F3F4F6"
          stroke="#9CA3AF"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </g>
      {/* Bottom remnant — jagged top mirrors the dome's break, shifted down
       *  so the two pieces read as pulled apart. */}
      <path
        d="M6.4 13.6
           L7.5 13.1
           L9 14
           L10.5 13.2
           L12 14.1
           L13.5 13.2
           L15 14
           L16.5 13.1
           L17.6 13.6
           L15.2 17
           H8.8
           z"
        fill="#F3F4F6"
        stroke="#9CA3AF"
        strokeWidth={1}
        strokeLinejoin="round"
      />
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
