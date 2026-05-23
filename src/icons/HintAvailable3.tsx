// Lightbulb emoji + digit for three available hints.
import type { SVGProps } from 'react';

export function HintAvailable3(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <title>Three hints available</title>
      <text x="1" y="19" fontSize="15">
        💡
      </text>
      <text
        x="15"
        y="19"
        fontSize="14"
        fontWeight={700}
        fontFamily="system-ui, sans-serif"
        fill="currentColor"
      >
        3
      </text>
    </svg>
  );
}
