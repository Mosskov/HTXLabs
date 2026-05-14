// Open-book icon for the theory disclosure — sage palette with dark-mode override.
import type { SVGProps } from 'react';

const styles = `
.bk-l{stroke:#6e9484}.bk-f{fill:#d6e5dd}
@media (prefers-color-scheme:dark){.bk-l{stroke:#a3c6b5}.bk-f{fill:#2c3833}}
`;

export function TheoryOpen(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <title>Åben bog</title>
      <style>{styles}</style>
      <path
        className="bk-f bk-l"
        d="M12 6.5C9.5 5 6.5 4.5 4 5v13c2.5-.5 5.5 0 8 1.5Z"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        className="bk-f bk-l"
        d="M12 6.5C14.5 5 17.5 4.5 20 5v13c-2.5-.5-5.5 0-8 1.5Z"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path className="bk-l" d="M12 6.5V19.5" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      <path
        className="bk-l"
        d="M6.5 9.5h3M6.5 12.5h3M14.5 9.5h3M14.5 12.5h3"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </svg>
  );
}
