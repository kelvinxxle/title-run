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

  it('shows a dramatic hero photo keyed by the rolled fighter id + name overlay', () => {
    const state = startDraft('title-run');
    const fighter = getFighter(state.current!.fighterId);
    render(<RolledFighterCard state={state} onKeep={() => {}} />);
    const img = screen.getByTestId('fighter-photo') as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(new RegExp(`fighters/${fighter.id}\\.jpg$`));
    expect(img).toHaveAttribute('alt', fighter.name);
    expect(screen.getByTestId('draft-hero')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: new RegExp(fighter.name, 'i') })).toBeInTheDocument();
  });
});
