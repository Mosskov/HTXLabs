// Tests for the Tooltip primitive: role/aria wiring, tabIndex injection, and
// the hover / focus / Escape / click behaviors — including the focus-then-click
// tap sequence that a toggling click would break (PL2).
import { Tooltip } from '@/lab-guide/Tooltip';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('Tooltip', () => {
  it('renders a role="tooltip" with the content and links it via aria-describedby', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Forklaring');
    expect(screen.getByText('Udløser')).toHaveAttribute('aria-describedby', tip.id);
  });

  it('gives the trigger tabIndex=0 when the child has none', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    expect(screen.getByText('Udløser')).toHaveAttribute('tabindex', '0');
  });

  it('starts closed', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-open', 'false');
  });

  it('opens on pointer-enter and closes on pointer-leave', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('Udløser');
    const tip = screen.getByRole('tooltip');
    fireEvent.pointerEnter(trigger);
    expect(tip).toHaveAttribute('data-open', 'true');
    fireEvent.pointerLeave(trigger);
    expect(tip).toHaveAttribute('data-open', 'false');
  });

  it('opens on focus and closes on blur', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('Udløser');
    const tip = screen.getByRole('tooltip');
    fireEvent.focus(trigger);
    expect(tip).toHaveAttribute('data-open', 'true');
    fireEvent.blur(trigger);
    expect(tip).toHaveAttribute('data-open', 'false');
  });

  it('closes on Escape while open', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('Udløser');
    const tip = screen.getByRole('tooltip');
    fireEvent.focus(trigger);
    expect(tip).toHaveAttribute('data-open', 'true');
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(tip).toHaveAttribute('data-open', 'false');
  });

  it('click opens and is idempotent — a second click does not close', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('Udløser');
    const tip = screen.getByRole('tooltip');
    fireEvent.click(trigger);
    expect(tip).toHaveAttribute('data-open', 'true');
    fireEvent.click(trigger);
    expect(tip).toHaveAttribute('data-open', 'true');
  });

  it('stays open through a focus-then-click tap sequence (PL2)', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('Udløser');
    const tip = screen.getByRole('tooltip');
    // The touch path: focus fires first (→ open), then click. A toggling click
    // would re-close here — open-idempotent keeps the tooltip visible.
    fireEvent.focus(trigger);
    fireEvent.click(trigger);
    expect(tip).toHaveAttribute('data-open', 'true');
  });
});
