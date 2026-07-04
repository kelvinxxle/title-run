import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RolledFighterCard from './RolledFighterCard';
import { startDraft, keepStat, suggestedStatId, getFighter } from '../domain/combat';

describe('RolledFighterCard', () => {
  it('shows the current fighter and keeps a stat on click', async () => {
    const onKeep = vi.fn();
    const state = startDraft('title-run');
    // Derive the expected fighter from the domain so this test is robust to
    // roster changes (a literal name couples the test to the RNG/roster snapshot).
    const expectedName = getFighter(state.current!.fighterId).name;
    render(<RolledFighterCard state={state} onKeep={onKeep} />);
    expect(screen.getByRole('heading', { name: expectedName })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('suggested-stat'));
    expect(onKeep).toHaveBeenCalledWith(suggestedStatId(state));
  });

  it('renders already-filled slots as non-interactive', () => {
    const state = keepStat(startDraft('title-run'), 'submissions');
    render(<RolledFighterCard state={state} onKeep={() => {}} />);
    expect(screen.getByTestId('filled-stat-submissions')).toBeInTheDocument();
  });

  it('renders a fighter avatar with aria-label matching the fighter name', () => {
    const state = startDraft('title-run');
    const fighter = getFighter(state.current!.fighterId);
    render(<RolledFighterCard state={state} onKeep={() => {}} />);
    expect(screen.getByTestId('fighter-avatar')).toBeInTheDocument();
    expect(screen.getByLabelText(`${fighter.name} portrait`, { exact: true })).toBeInTheDocument();
  });
});
