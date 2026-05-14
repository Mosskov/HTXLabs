// Pendulum-at-rest icon for the simulation disclosure — slate-blue palette with dark-mode override.
import type { SVGProps } from 'react';

const styles = `
.pd-l{stroke:#7c8ab0}.pd-f{fill:#d9dff0}.pd-d{fill:#7c8ab0}
@media (prefers-color-scheme:dark){.pd-l{stroke:#aab7db}.pd-f{fill:#2f3648}.pd-d{fill:#aab7db}}
`;

export function SimulationClosed(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <title>Pendul i hvile</title>
      <style>{styles}</style>
      <path
        className="pd-l"
        d="M7 5h10M12 5v10"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle className="pd-d" cx="12" cy="5" r="1" />
      <circle className="pd-f pd-l" cx="12" cy="18" r="3" strokeWidth="1.5" />
    </svg>
  );
}
