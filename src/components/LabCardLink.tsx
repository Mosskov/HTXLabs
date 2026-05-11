// Card-style <Link> used by both the home (topic cards) and topic (lab cards) routes.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  to: string;
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}

/** Shared chrome for the topic/lab card grids on the home and topic routes.
 * The wrapping `<ul>` and its grid columns stay with the caller; this just
 * consolidates the `<li> + <Link> + <h2>` triple plus card hover styling. */
export function LabCardLink({ to, title, eyebrow, children }: Props) {
  return (
    <li className="lab-card before:hidden">
      <Link to={to} className="block p-5 hover:bg-slate-50 rounded-lg">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-widest text-accent mb-1">{eyebrow}</p>
        )}
        <h2 className="text-lg text-navy mb-1">{title}</h2>
        {children}
      </Link>
    </li>
  );
}
