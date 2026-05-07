import type { ReactNode } from 'react';

/** Boxed callout for the lab's defining equation. */
export function KeyEquation({ children }: { children: ReactNode }) {
  return <div className="callout-equation my-4">{children}</div>;
}
