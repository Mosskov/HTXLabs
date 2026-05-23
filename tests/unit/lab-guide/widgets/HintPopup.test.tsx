import { HintPopup, type HintPopupEntry } from '@/lab-guide/widgets/HintPopup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

describe('HintPopup', () => {
  it('does not render a popup on focus when entries is empty', async () => {
    const user = userEvent.setup();
    render(
      <HintPopup entries={[]}>
        <input data-testid="t" />
      </HintPopup>,
    );
    await user.click(screen.getByTestId('t'));
    // No popup section appears regardless of focus state.
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('preserves the consumer-provided aria-describedby when adding its own', async () => {
    const user = userEvent.setup();
    const entries: HintPopupEntry[] = [{ key: 'a', text: 'hint A', tone: 'hint' }];
    render(
      <>
        <div id="help-text">word count help</div>
        <HintPopup entries={entries}>
          <input data-testid="t" aria-describedby="help-text" />
        </HintPopup>
      </>,
    );
    await user.click(screen.getByTestId('t'));
    const describedBy = screen.getByTestId('t').getAttribute('aria-describedby') ?? '';
    // Both ids present — the original help text MUST survive when the popup
    // attaches its own description.
    expect(describedBy.split(/\s+/)).toContain('help-text');
    expect(describedBy.split(/\s+/).length).toBeGreaterThanOrEqual(2);
  });

  it('opens on focus and closes on blur when entries is non-empty', async () => {
    const user = userEvent.setup();
    const entries: HintPopupEntry[] = [{ key: 'a', text: 'hint A', tone: 'hint' }];
    render(
      <>
        <HintPopup entries={entries}>
          <input data-testid="t" />
        </HintPopup>
        <button type="button" data-testid="elsewhere">
          elsewhere
        </button>
      </>,
    );
    // Closed before focus.
    expect(screen.queryByText('hint A')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('t'));
    expect(screen.getByText('hint A')).toBeInTheDocument();

    // Move focus away → popup closes.
    await user.click(screen.getByTestId('elsewhere'));
    expect(screen.queryByText('hint A')).not.toBeInTheDocument();
  });
});
