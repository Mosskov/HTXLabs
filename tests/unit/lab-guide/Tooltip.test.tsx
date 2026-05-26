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

  it('anchors the bubble to the right edge when align="right"', () => {
    render(
      <Tooltip content="Forklaring" align="right">
        <span>Udløser</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('Udløser');
    const tip = screen.getByRole('tooltip');
    fireEvent.pointerEnter(trigger);
    expect(tip).toHaveClass('right-0');
    expect(tip).not.toHaveClass('left-0');
  });

  it('opens below the trigger by default', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('Udløser');
    const tip = screen.getByRole('tooltip');
    fireEvent.pointerEnter(trigger);
    expect(tip).toHaveClass('top-full');
    expect(tip).not.toHaveClass('bottom-full');
  });

  it('flips above the trigger when there is no room below', () => {
    render(
      <Tooltip content="Forklaring">
        <span>Udløser</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('Udløser');
    const tip = screen.getByRole('tooltip');
    const wrapper = trigger.parentElement as HTMLElement;
    const originalInnerHeight = window.innerHeight;

    // jsdom does no layout — feed the placement check a trigger pinned near the
    // viewport bottom and a bubble with real height.
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
    Object.defineProperty(tip, 'offsetHeight', { value: 120, configurable: true });
    wrapper.getBoundingClientRect = () =>
      ({ top: 560, bottom: 590, height: 30, width: 0, left: 0, right: 0, x: 0, y: 560 }) as DOMRect;

    fireEvent.pointerEnter(trigger);
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      configurable: true,
    });
    expect(tip).toHaveClass('bottom-full');
    expect(tip).not.toHaveClass('top-full');
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

  it('caps the open bubble width at 28ch so multi-word messages do not single-word-wrap (C5)', () => {
    render(
      <Tooltip content="En lang forklaring der ville knække til adskillige korte linjer uden bredde-cap">
        <span>Udløser</span>
      </Tooltip>,
    );
    const trigger = screen.getByText('Udløser');
    const tip = screen.getByRole('tooltip');
    fireEvent.pointerEnter(trigger);
    expect(tip).toHaveClass('max-w-[28ch]');
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
