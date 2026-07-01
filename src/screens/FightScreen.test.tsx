import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FightScreen, { advanceFight } from './FightScreen';
import { startFight } from '../domain';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };
const fighter = { name: 'Kelvin', statLine: PLAYER };

function strike() { fireEvent.click(screen.getByTestId('intent-strike')); }

describe('FightScreen (controlled)', () => {
  it('shows the seeded opponent (grappler challenger) on load', () => {
    render(<FightScreen seed="run-42" fightNumber={1} fighter={fighter} onSettled={() => {}} />);
    expect(screen.getByText(/grappler · challenger/i)).toBeInTheDocument();
  });

  it('calls onSettled once with a decision win in round 3 for the seeded vector', () => {
    const onSettled = vi.fn();
    render(<FightScreen seed="run-42" fightNumber={1} fighter={fighter} onSettled={onSettled} />);
    strike(); strike(); strike();
    expect(onSettled).toHaveBeenCalledTimes(1);
    const settled = onSettled.mock.calls[0][0];
    expect(settled.outcome.winner).toBe('player');
    expect(settled.outcome.method).toBe('decision');
    expect(settled.outcome.round).toBe(3);
  });

  it('advanceFight is a no-op once the fight is settled', () => {
    let s = startFight({ seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER, carryInDamage: 0 });
    s = advanceFight(s, 'strike');
    s = advanceFight(s, 'strike');
    s = advanceFight(s, 'strike');           // settled here (decision round 3)
    const again = advanceFight(s, 'strike');  // no-op
    expect(again).toBe(s);
  });
});
