import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App shell', () => {
  it('renders the top app bar and defaults to the championship hub', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent(/title run/i);
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
  });

  it('navigates to the draft screen when the Draft nav button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /draft/i }));
    expect(screen.getByTestId('screen-draft')).toBeInTheDocument();
    expect(
      screen.queryByTestId('screen-championship-hub'),
    ).not.toBeInTheDocument();
  });

  it('marks the active nav button with aria-current', async () => {
    const user = userEvent.setup();
    render(<App />);
    const fightButton = screen.getByRole('button', { name: /fight/i });
    await user.click(fightButton);
    expect(fightButton).toHaveAttribute('aria-current', 'page');
  });
});
