import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FightResultPanel from './FightResultPanel';

describe('FightResultPanel', () => {
  it('shows a winning decision and fires onNewFight', async () => {
    const user = userEvent.setup();
    const onNewFight = vi.fn();
    render(
      <FightResultPanel
        outcome={{ method: 'decision', round: 3, winner: 'player' }}
        onNewFight={onNewFight}
      />,
    );
    const panel = screen.getByTestId('fight-result');
    expect(panel).toHaveTextContent(/you win/i);
    expect(panel).toHaveTextContent(/decision/i);
    expect(panel).toHaveTextContent(/round 3/i);
    await user.click(screen.getByRole('button', { name: /new fight/i }));
    expect(onNewFight).toHaveBeenCalledTimes(1);
  });

  it('shows a loss by KO', () => {
    render(
      <FightResultPanel
        outcome={{ method: 'KO', round: 4, winner: 'opponent' }}
        onNewFight={() => {}}
      />,
    );
    const panel = screen.getByTestId('fight-result');
    expect(panel).toHaveTextContent(/you lose/i);
    expect(panel).toHaveTextContent(/ko/i);
  });
});
