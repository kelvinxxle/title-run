import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { startFight } from '../domain';
import FightScreen, { advanceFight } from './FightScreen';

describe('FightScreen', () => {
  it('keeps the screen test id for navigation', () => {
    render(<FightScreen seed="run-42" />);
    expect(screen.getByTestId('screen-fight')).toBeInTheDocument();
  });

  it('shows the seeded opponent and round header on load', () => {
    render(<FightScreen seed="run-42" />);
    expect(screen.getByText('Hideo "Granite" Stone')).toBeInTheDocument();
    expect(screen.getByText(/grappler · challenger/i)).toBeInTheDocument();
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
    expect(result).toHaveTextContent(/round 3/i);
    expect(screen.queryByTestId('intent-panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /new fight/i }));

    expect(screen.getByText(/fight 2/i)).toBeInTheDocument();
    expect(screen.getByText(/round 1 of 3/i)).toBeInTheDocument();
    expect(screen.queryByText('Hideo "Granite" Stone')).not.toBeInTheDocument();
    expect(screen.getByTestId('intent-panel')).toBeInTheDocument();
  });

  it('advanceFight is a no-op once the fight is settled (guards double-clicks)', () => {
    const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER });
    s = advanceFight(s, 'strike');
    s = advanceFight(s, 'strike');
    s = advanceFight(s, 'strike');
    expect(s.status).not.toBe('in-progress');
    const again = advanceFight(s, 'strike');
    expect(again).toBe(s);
  });
});
