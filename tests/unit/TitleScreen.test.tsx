import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettings } from '../../src/game/settings';
import { TitleScreen } from '../../src/ui/TitleScreen';

describe('TitleScreen', () => {
  beforeEach(() => useSettings.getState().reset());

  it('shows the title and SRD 5.1 attribution', () => {
    render(<TitleScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'The Ember Crown' })).toBeVisible();
    expect(screen.getByText(/System Reference Document 5\.1/)).toBeVisible();
    expect(screen.getByText(/CC-BY-4\.0/)).toBeVisible();
  });

  it('selects a difficulty by click and updates the summary and New Game label', async () => {
    const user = userEvent.setup();
    render(<TitleScreen />);
    expect(screen.getByRole('radio', { name: /Medium/ })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: /Hard/ }));

    expect(screen.getByRole('radio', { name: /Hard/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Medium/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('What Hard changes')).toBeVisible();
    expect(screen.getByText(/150% of the Medium XP budget/)).toBeVisible();
    expect(screen.getByRole('button', { name: /New Game/ })).toHaveTextContent('Hard');
    expect(useSettings.getState().difficulty).toBe('hard');
  });

  it('moves through difficulties with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<TitleScreen />);
    screen.getByRole('radio', { name: /Medium/ }).focus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: /Easy/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Easy/ })).toHaveFocus();

    await user.keyboard('{ArrowLeft}'); // wraps around
    expect(screen.getByRole('radio', { name: /Hard/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('flips the dice and saving switches', async () => {
    const user = userEvent.setup();
    render(<TitleScreen />);
    const sw = screen.getByRole('switch', { name: /click to roll my own dice/ });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('disables Continue and Load Game while there are no saves', () => {
    render(<TitleScreen />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Load Game' })).toBeDisabled();
  });
});
