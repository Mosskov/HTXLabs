// Swinging-pendulum icon for the simulation disclosure — slate-blue palette with dark-mode override.
import type { SVGProps } from 'react';

const styles = `
.pd-l{stroke:#7c8ab0}.pd-f{fill:#d9dff0}.pd-d{fill:#7c8ab0}
@media (prefers-color-scheme:dark){.pd-l{stroke:#aab7db}.pd-f{fill:#2f3648}.pd-d{fill:#aab7db}}
`;

export function SimulationOpen(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <title>Svingende pendul</title>
      <style>{styles}</style>
      <path className="pd-l" d="M7 5h10" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      <circle className="pd-d" cx="12" cy="5" r="1" />
      <path
        className="pd-l"
        d="M5.5 15.5q6.5 4.5 13 0"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.45"
        strokeDasharray="2 2"
      />
      <path
        className="pd-l"
        d="M12 5 7.66 13.21"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.3"
      />
      <path
        className="pd-l"
        d="M12 5l4.34 8.21"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle className="pd-f pd-l" cx="17.6" cy="15.6" r="2.7" strokeWidth="1.5" />
    </svg>
  );
}
