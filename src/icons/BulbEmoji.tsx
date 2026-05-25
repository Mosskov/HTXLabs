// 💡 emoji wrapped in an SVG container so it sits alongside the hand-rolled
// bulb variants in the icon gallery at consistent sizes. Not used as a real
// component anywhere — the emoji is rendered directly as text in production
// (`HintBucket`). This wrapper exists purely so the gallery can stack it
// next to `BulbCracked` and `BulbFilling` for visual comparison.
import type { SVGProps } from 'react';

export function BulbEmoji(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <title>Glødepære (emoji)</title>
      <text
        x="12"
        y="20"
        fontSize="20"
        textAnchor="middle"
        style={{
          filter: 'grayscale(1) saturate(0.45) opacity(0.7)',
        }}
      >
        💡
      </text>
    </svg>
  );
}
