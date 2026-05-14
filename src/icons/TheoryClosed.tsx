// Closed-book icon for the theory disclosure — sage palette with dark-mode override.
import type { SVGProps } from 'react';

const styles = `
.bk-l{stroke:#6e9484}.bk-f{fill:#d6e5dd}.bk-d{fill:#6e9484}
@media (prefers-color-scheme:dark){.bk-l{stroke:#a3c6b5}.bk-f{fill:#2c3833}.bk-d{fill:#a3c6b5}}
`;

export function TheoryClosed(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <title>Bog</title>
      <style>{styles}</style>
      <rect className="bk-d" x="6.5" y="4.5" width="3" height="15" rx="1" />
      <path
        className="bk-f bk-l"
        d="M9.5 4.5H16a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H9.5Z"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        className="bk-l"
        d="M12.5 11.75H15.5"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
    </svg>
  );
}
