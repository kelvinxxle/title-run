import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FightScreen from './FightScreen';

describe('FightScreen', () => {
  it('keeps the screen test id for navigation', () => {
    render(<FightScreen seed="run-42" />);
    expect(screen.getByTestId('screen-fight')).toBeInTheDocument();
  });

  it('shows the seeded opponent and round header on load', () => {
    render(<FightScreen seed="run-42" />);
    expect(screen.getByText('Hideo "Granite" Stone')).toBeInTheDocument();
    expect(screen.getByText(/round 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByTestId('intent-panel')).toBeInTheDocument();
  });

  it('plays the baked strike bout to a decision win and starts a new, harder fight', async () => {
    const user = userEvent.setup();
    render(<FightScreen seed="run-42" />);

    await user.click(screen.getByTestId('intent-strike'));
    await user.click(screen.getByTestId('intent-strike'));
    await user.click(screen.getByTestId('intent-strike'));

    const result = screen.getByTestId('fight-result');
    expect(result).toHaveTextContent(/you win/i);
    expect(result).toHaveTextContent(/decision/i);
    expect(screen.queryByTestId('intent-panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /new fight/i }));

    expect(screen.getByText(/fight 2/i)).toBeInTheDocument();
    expect(screen.getByText(/round 1 of 3/i)).toBeInTheDocument();
    expect(screen.queryByText('Hideo "Granite" Stone')).not.toBeInTheDocument();
    expect(screen.getByTestId('intent-panel')).toBeInTheDocument();
  });
});
